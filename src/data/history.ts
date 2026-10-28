// Historical border snapshots (historical-basemaps). Lazy-loaded per snapshot and indexed with
// bounding boxes so "which polity is at this point at time T" is a handful of ring tests.
import { geoArea, geoCentroid } from 'd3-geo'
import { pointInPolygon } from '../geo/sphere'

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
export type Snapshot = { year: number; polities: Polity[] }
type Index = { snapshots: { year: number; features: number; bytes: number }[] }

let indexPromise: Promise<number[]> | null = null
const cache = new Map<number, Snapshot>()
const pending = new Map<number, Promise<Snapshot>>()
const listeners = new Set<() => void>()

export const historyYears: number[] = []

export function loadHistoryIndex(): Promise<number[]> {
  indexPromise ??= fetch('/data/history/index.json')
    .then((r) => r.json() as Promise<Index>)
    .then((j) => {
      historyYears.splice(0, historyYears.length, ...j.snapshots.map((s) => s.year).sort((a, b) => a - b))
      listeners.forEach((l) => l())
      return historyYears
    })
  return indexPromise
}

export function onHistoryChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Index of the latest snapshot at or before t, -1 if none */
export function snapshotIndexAt(t: number): number {
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
    p = fetch(`/data/history/${year}.json`)
      .then((r) => r.json())
      .then((g: GeoJSON.FeatureCollection) => {
        const polities: Polity[] = []
        g.features.forEach((f, i) => {
          const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
          if (!geom) return
          const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates) as number[][][][]
          let minX = 180, minY = 90, maxX = -180, maxY = -90
          for (const poly of polys)
            for (const [x, y] of poly[0]) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          // label at the centroid of the largest part
          // rings are RFC 7946 (counter-clockwise) but d3-geo expects clockwise, so it measures the
          // complement: areas come out as 4π - a and centroids as antipodes. Correct for both.
          let best = polys[0]
          let bestA = -1
          let flipped = false
          for (const poly of polys) {
            const raw = geoArea({ type: 'Polygon', coordinates: poly })
            const a = raw > 2 * Math.PI ? 4 * Math.PI - raw : raw
            if (a > bestA) {
              bestA = a
              best = poly
              flipped = raw > 2 * Math.PI
            }
          }
          const c = geoCentroid({ type: 'Polygon', coordinates: best }) as [number, number]
          const label: [number, number] = flipped ? [c[0] > 0 ? c[0] - 180 : c[0] + 180, -c[1]] : c
          let area = 0
          for (const poly of polys) {
            const raw = geoArea({ type: 'Polygon', coordinates: poly })
            area += raw > 2 * Math.PI ? 4 * Math.PI - raw : raw
          }
          const props = f.properties ?? {}
          polities.push({
            id: `${year}:${i}`,
            name: props.NAME,
            subjectTo: props.SUBJECTO && props.SUBJECTO !== props.NAME ? props.SUBJECTO : null,
            partOf: props.PARTOF && props.PARTOF !== props.NAME ? props.PARTOF : null,
            precision: props.BORDERPRECISION ?? 1,
            polys,
            bbox: [minX, minY, maxX, maxY],
            area,
            label,
          })
        })
        const snap = { year, polities }
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
