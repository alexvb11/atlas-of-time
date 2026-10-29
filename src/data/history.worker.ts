// Fetches and parses a history snapshot off the main thread and builds its border line segments.
// Bounding boxes, areas and label points are precomputed at build time, so nothing here is spherical
// geometry beyond densifying edges.
import { ringsToSegments } from '../geo/segments'
import type { Polity } from './history'

export type Parsed = { year: number; polities: Polity[]; segments: Float32Array }

self.onmessage = async (e: MessageEvent<{ year: number; url: string }>) => {
  const { year, url } = e.data
  const g = (await (await fetch(url)).json()) as GeoJSON.FeatureCollection
  const polities: Polity[] = []
  const rings: number[][][] = []
  g.features.forEach((f, i) => {
    const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
    if (!geom) return
    const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates) as number[][][][]
    for (const poly of polys) rings.push(...poly)
    const props = f.properties ?? {}
    polities.push({
      id: `${year}:${i}`,
      name: props.NAME,
      subjectTo: props.SUBJECTO && props.SUBJECTO !== props.NAME ? props.SUBJECTO : null,
      partOf: props.PARTOF && props.PARTOF !== props.NAME ? props.PARTOF : null,
      precision: props.BORDERPRECISION ?? 1,
      polys,
      bbox: props._b,
      area: props._a,
      label: props._l,
    })
  })
  const segments = ringsToSegments(rings)
  const out: Parsed = { year, polities, segments }
  ;(self as unknown as Worker).postMessage(out, [segments.buffer])
}
