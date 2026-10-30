// Historical border snapshots: historical-basemaps before 1886, then CShapes 2.0, whose every dated
// change is its own snapshot (built in the worker from one shared topology). Lazy-loaded per
// snapshot and indexed with bounding boxes so "which polity is here at time T" is a few ring tests.
import { pointInPolygon } from '../geo/sphere'
import type { Parsed } from './history.worker'

export type Polity = {
  id: string
  name: string
  subjectTo: string | null
  partOf: string | null
  precision: number
  polys: number[][][][]
  bbox: [number, number, number, number]
  /** steradians */
  area: number
  label: [number, number]
}
/** segments: border lines on the unit sphere, built in the worker */
export type Snapshot = { year: number; polities: Polity[]; segments: Float32Array }
type Index = { snapshots: { year: number; features: number; bytes: number }[]; cshapes?: { url: string; from: number; keys: number[] } }

let indexPromise: Promise<number[]> | null = null
const cache = new Map<number, Snapshot>()
const pending = new Map<number, Promise<Snapshot>>()
const listeners = new Set<() => void>()
// parsing and border line building run in a worker
let worker: Worker | null = null
const resolvers = new Map<number, (p: Parsed) => void>()

export const historyYears: number[] = []
const cshapesKeys = new Set<number>()
let cshapesUrl = ''

export function loadHistoryIndex(): Promise<number[]> {
  indexPromise ??= fetch('/data/history/index.json')
    .then((r) => r.json() as Promise<Index>)
    .then((j) => {
      const years = j.snapshots.map((s) => s.year)
      if (j.cshapes) {
        cshapesUrl = new URL(`/data/history/${j.cshapes.url}`, location.href).href
        for (const k of j.cshapes.keys) cshapesKeys.add(k)
        years.push(...j.cshapes.keys)
      }
      historyYears.splice(0, historyYears.length, ...years.sort((a, b) => a - b))
      listeners.forEach((l) => l())
      return historyYears
    })
  return indexPromise
}

export function onHistoryChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

// Snapshots that must not be carried forward to the next one: the 123,000 BCE map shows
// Neanderthals and Homo erectus, who were gone by about 40,000 years ago.
const VALID_UNTIL: Record<number, number> = { [-122999]: 2026 - 40000 }

/** Index of the latest snapshot at or before t, -1 if none */
export function snapshotIndexAt(t: number): number {
  const i = latestAtOrBefore(t)
  if (i >= 0 && VALID_UNTIL[historyYears[i]] !== undefined && t > VALID_UNTIL[historyYears[i]]) return -1
  return i
}

function latestAtOrBefore(t: number): number {
  let lo = 0
  let hi = historyYears.length - 1
  let ans = -1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (historyYears[m] <= t) {
      ans = m
      lo = m + 1
    } else hi = m - 1
  }
  return ans
}

export const getSnapshot = (year: number) => cache.get(year)

export function loadSnapshot(year: number): Promise<Snapshot> {
  const have = cache.get(year)
  if (have) return Promise.resolve(have)
  let p = pending.get(year)
  if (!p) {
    if (!worker) {
      worker = new Worker(new URL('./history.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<Parsed>) => resolvers.get(e.data.year)?.(e.data)
    }
    p = new Promise<Parsed>((resolve) => {
      resolvers.set(year, resolve)
      worker!.postMessage(
        cshapesKeys.has(year) ? { year, url: cshapesUrl, cshapes: true } : { year, url: new URL(`/data/history/${year}.json`, location.href).href },
      )
    })
      .then(({ polities, segments }) => {
        resolvers.delete(year)
        const snap = { year, polities, segments }
        cache.set(year, snap)
        pending.delete(year)
        listeners.forEach((l) => l())
        return snap
      })
    pending.set(year, p)
  }
  return p
}

export function polityAt(snap: Snapshot, lon: number, lat: number): Polity | null {
  let hit: Polity | null = null
  for (const p of snap.polities) {
    const [a, b, c, d] = p.bbox
    if (lon < a || lon > c || lat < b || lat > d) continue
    for (const poly of p.polys) {
      if (pointInPolygon(lon, lat, poly)) {
        // nested polygons: prefer the smallest containing one
        if (!hit || p.area < hit.area) hit = p
        break
      }
    }
  }
  return hit
}

/** Snapshot pair around t for crossfading: current (<= t) and next, with progress 0..1 */
export function snapshotPair(t: number): { cur: number | null; next: number | null; f: number } {
  const i = snapshotIndexAt(t)
  if (i < 0) return { cur: null, next: historyYears[0] ?? null, f: 0 }
  const cur = historyYears[i]
  const next = historyYears[i + 1] ?? null
  const f = next === null ? 0 : (t - cur) / (next - cur)
  return { cur, next, f }
}

/** True for snapshots built from CShapes: precise borders, dated to the day, de facto control */
export const isPreciseSnapshot = (year: number) => cshapesKeys.has(year)
