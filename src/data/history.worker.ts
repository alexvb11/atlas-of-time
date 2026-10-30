// Fetches and parses a history snapshot off the main thread and builds its border line segments.
// Bounding boxes, areas and label points are precomputed at build time, so nothing here is spherical
// geometry beyond densifying edges.
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { ringsToSegments } from '../geo/segments'
import type { Polity } from './history'

export type Parsed = { year: number; polities: Polity[]; segments: Float32Array }

// CShapes (1886 onward): one topology for every dated piece, fetched once; a snapshot is the pieces
// alive at its date. Properties: n [[from, name, ruler]], f from, e to (null = today), b/a/l.
type CsProps = { n: [number, string, string | null][]; f: number; e: number | null; b: [number, number, number, number]; a: number; l: [number, number] }
let cshapes: Promise<Topology> | null = null

function fromCShapes(topo: Topology, year: number): GeoJSON.FeatureCollection {
  const layer = topo.objects[Object.keys(topo.objects)[0]] as GeometryCollection<CsProps>
  const alive = layer.geometries.filter((g) => {
    const p = g.properties as CsProps
    return p.f <= year + 1e-6 && (p.e === null || year < p.e - 1e-6)
  })
  const fc = feature(topo, { type: 'GeometryCollection', geometries: alive }) as GeoJSON.FeatureCollection<GeoJSON.Geometry, CsProps>
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const p = f.properties
      const [, name, ruler] = p.n.filter(([t]) => t <= year + 1e-6).pop() ?? p.n[0]
      return { ...f, properties: { NAME: name, SUBJECTO: ruler, BORDERPRECISION: 3, _b: p.b, _a: p.a, _l: p.l } }
    }),
  }
}

self.onmessage = async (e: MessageEvent<{ year: number; url: string; cshapes?: boolean }>) => {
  const { year, url } = e.data
  const g = e.data.cshapes
    ? fromCShapes(await (cshapes ??= fetch(url).then((r) => r.json() as Promise<Topology>)), year)
    : ((await (await fetch(url)).json()) as GeoJSON.FeatureCollection)
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
