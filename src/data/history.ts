// Historical border snapshots: historical-basemaps before 3400 BCE, Cliopatria from 3400 BCE to 1885
// (every year a border changed, with historical-basemaps peoples filling the places it leaves
// empty), then CShapes 2.0, whose every dated change is its own snapshot. Cliopatria and CShapes
// snapshots are assembled in the worker from shared topologies. Lazy-loaded per
// snapshot and indexed with bounding boxes so "which polity is here at time T" is a few ring tests.
import { pointInPolygon } from '../geo/sphere'
import type { Hold, Parsed, Request, TimelineReply } from './history.worker'
export type { Hold }

export type Polity = {
  id: string
  name: string
  subjectTo: string | null
  partOf: string | null
  /** 3 dated to the day (CShapes), 2 researched at regional scale (Cliopatria), 1 or 0 approximate */
  precision: number
  /** Wikipedia title and Wikidata id given by the source (Cliopatria) */
  wiki: string | null
  qid: string | null
  source: 'cshapes' | 'cliopatria' | 'basemaps'
  polys: number[][][][]
  bbox: [number, number, number, number]
  /** steradians */
  area: number
  label: [number, number]
}
/** A grouping of polities (the Holy Roman Empire over its member states): a label, not a border */
export type GroupLabel = { name: string; label: [number, number]; area: number; wiki: string | null }
/** segments: border lines on the unit sphere, built in the worker; soft: the approximate ones */
export type Snapshot = { year: number; polities: Polity[]; groups: GroupLabel[]; segments: Float32Array; soft: Float32Array; softDist: Float32Array }
type Index = {
  snapshots: { year: number; features: number; bytes: number }[]
  cshapes?: { url: string; from: number; keys: number[] }
  cliopatria?: { from: number; to: number; keys: number[]; chunks: { from: number; to: number; url: string }[] }
}

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
let clio: Index['cliopatria'] | null = null
const basemapYears: number[] = []

export function loadHistoryIndex(): Promise<number[]> {
  indexPromise ??= fetch('/data/history/index.json')
    .then((r) => r.json() as Promise<Index>)
    .then((j) => {
      const years = j.snapshots.map((s) => s.year)
      basemapYears.push(...years.sort((a, b) => a - b))
      if (j.cliopatria) {
        clio = j.cliopatria
        years.push(...j.cliopatria.keys)
      }
      if (j.cshapes) {
        cshapesUrl = new URL(`/data/history/${j.cshapes.url}`, location.href).href
        for (const k of j.cshapes.keys) cshapesKeys.add(k)
        years.push(...j.cshapes.keys)
      }
      historyYears.splice(0, historyYears.length, ...[...new Set(years)].sort((a, b) => a - b))
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
    p = new Promise<Parsed>((resolve) => {
      resolvers.set(year, resolve)
      ensureWorker().postMessage(requestFor(year))
    })
      .then(({ polities, groups, segments, soft, softDist }) => {
        resolvers.delete(year)
        const snap = { year, polities, groups, segments, soft, softDist }
        cache.set(year, snap)
        pending.delete(year)
        listeners.forEach((l) => l())
        return snap
      })
    pending.set(year, p)
  }
  return p
}

const timelineResolvers = new Map<number, (h: Hold[]) => void>()
let timelineId = 0
const ensureWorker = () => {
  if (!worker) {
    worker = new Worker(new URL('./history.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<Parsed | TimelineReply>) =>
      'timeline' in e.data ? timelineResolvers.get(e.data.timeline)?.(e.data.holds) : resolvers.get(e.data.year)?.(e.data)
  }
  return worker
}

/** Every polity that held the point (lon, lat), in time order, from all border sources */
const timelines = new Map<string, Promise<Hold[]>>()
export function timelineAt(lon: number, lat: number): Promise<Hold[]> {
  const key = `${lon.toFixed(3)},${lat.toFixed(3)}`
  let p = timelines.get(key)
  if (!p) timelines.set(key, (p = queryTimeline(lon, lat)))
  return p
}

async function queryTimeline(lon: number, lat: number): Promise<Hold[]> {
  await loadHistoryIndex()
  const id = ++timelineId
  const basemaps = basemapYears.map((y, i) => ({ from: y, to: Math.min(basemapYears[i + 1] ?? 1886, VALID_UNTIL[y] ?? Infinity, 1886), url: abs(`${y}.json`) }))
  return new Promise<Hold[]>((resolve) => {
    timelineResolvers.set(id, (h) => {
      timelineResolvers.delete(id)
      resolve(h)
    })
    ensureWorker().postMessage({ timeline: id, lon, lat, clio: clio?.chunks.map((c) => abs(c.url)) ?? [], cshapes: cshapesUrl || null, basemaps })
  })
}

const abs = (file: string) => new URL(`/data/history/${file}`, location.href).href

function requestFor(year: number): Request {
  if (cshapesKeys.has(year)) return { year, url: cshapesUrl, cshapes: true }
  const chunk = clio && year >= clio.from && year < clio.to ? clio.chunks.find((c) => year >= c.from && year < c.to) : undefined
  if (chunk) {
    // the historical-basemaps map in force at this year fills the places Cliopatria leaves empty
    const fill = [...basemapYears].reverse().find((y) => y <= year)
    return { year, clio: abs(chunk.url), fill: fill !== undefined ? abs(`${fill}.json`) : undefined }
  }
  return { year, url: abs(`${year}.json`) }
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

/** Which border source draws the map at t */
export function borderSourceAt(t: number): 'cshapes' | 'cliopatria' | 'basemaps' | null {
  const i = snapshotIndexAt(t)
  if (i < 0) return null
  const y = historyYears[i]
  if (cshapesKeys.has(y)) return 'cshapes'
  return clio && y >= clio.from && y < clio.to ? 'cliopatria' : 'basemaps'
}

/** True for snapshots built from CShapes: precise borders, dated to the day, de facto control */
export const isPreciseSnapshot = (year: number) => cshapesKeys.has(year)

/**
 * Polities whose borders touch this one on the same map (outlines in neighbouring half-degree
 * cells, so within roughly 50–100 km), largest first. Outlines are sampled, so tiny neighbours
 * can be missed.
 */
export function neighboursOf(snap: Snapshot, p: Polity, max = 8): Polity[] {
  const CELL = 0.5
  const grid = new Set<string>()
  const sample = (q: Polity, n: number) => {
    const pts: number[][] = []
    const total = q.polys.reduce((a, poly) => a + poly[0].length, 0)
    const step = Math.max(1, Math.floor(total / n))
    for (const poly of q.polys) for (let i = 0; i < poly[0].length; i += step) pts.push(poly[0][i])
    return pts
  }
  for (const [x, y] of sample(p, 1500)) grid.add(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`)
  const [a, b, c, d] = p.bbox
  const out: Polity[] = []
  for (const q of snap.polities) {
    if (q === p || q.name === p.name || !q.name) continue
    const [qa, qb, qc, qd] = q.bbox
    if (qa > c + 1 || qc < a - 1 || qb > d + 1 || qd < b - 1) continue
    // a point of q's outline in a cell next to p's outline counts as touching
    const touches = sample(q, 600).some(([x, y]) => {
      const cx = Math.floor(x / CELL)
      const cy = Math.floor(y / CELL)
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (grid.has(`${cx + i},${cy + j}`) ) return true
      return false
    })
    if (touches && !out.some((o) => o.name === q.name)) out.push(q)
  }
  return out.sort((x, y) => y.area - x.area).slice(0, max)
}
