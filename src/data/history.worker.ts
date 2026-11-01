// Fetches and parses a history snapshot off the main thread and builds its border line segments.
// Bounding boxes, areas and label points are precomputed at build time, so nothing here is spherical
// geometry beyond densifying edges.
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { pointInPolygon, ringsToSegments } from '../geo/segments'
import type { Polity, GroupLabel } from './history'

export type Parsed = { year: number; polities: Polity[]; groups: GroupLabel[]; segments: Float32Array; soft: Float32Array; softDist: Float32Array }
export type Request = { year: number; url?: string; cshapes?: boolean; clio?: string; fill?: string }
/** Everything that held one point, across every source: answers "who ruled here, when?" */
export type TimelineRequest = { timeline: number; lon: number; lat: number; clio: string[]; cshapes: string | null; basemaps: { from: number; to: number; url: string }[] }
export type Hold = { from: number; to: number; name: string; partOf: string | null; under: string | null; wiki: string | null; precision: number }
export type TimelineReply = { timeline: number; holds: Hold[] }

// CShapes (1886 onward): one topology for every dated piece, fetched once; a snapshot is the pieces
// alive at its date. Properties: n [[from, name, ruler]], f from, e to (null = today), b/a/l.
type CsProps = { n: [number, string, string | null][]; f: number; e: number | null; b: [number, number, number, number]; a: number; l: [number, number] }
// Cliopatria (3400 BCE to 1885), one topology per era: n name, f from, e to (exclusive), w
// Wikipedia title, q Wikidata id, m the grouping it is part of, g 1 for a grouping (label only)
type ClioProps = { n: string; f: number; e: number; w?: string; q?: string; m?: string; g?: 1; b: [number, number, number, number]; a: number; l: [number, number] }

const topos = new Map<string, Promise<Topology>>()
const getTopo = (url: string) => {
  let p = topos.get(url)
  if (!p) topos.set(url, (p = fetch(url).then((r) => r.json() as Promise<Topology>)))
  return p
}

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

function fromCliopatria(topo: Topology, year: number) {
  const layer = topo.objects[Object.keys(topo.objects)[0]] as GeometryCollection<ClioProps>
  const alive = layer.geometries.filter((g) => {
    const p = g.properties as ClioProps
    return p.f <= year && year < p.e
  })
  const fc = feature(topo, { type: 'GeometryCollection', geometries: alive }) as GeoJSON.FeatureCollection<GeoJSON.Geometry, ClioProps>
  const groups: GroupLabel[] = []
  const features: GeoJSON.Feature[] = []
  for (const f of fc.features) {
    const p = f.properties
    if (p.g) groups.push({ name: p.n, label: p.l, area: p.a, wiki: p.w ?? null })
    // Cliopatria borders are researched but drawn at regional scale: precision 2
    else features.push({ ...f, properties: { NAME: p.n, PARTOF: p.m ?? null, BORDERPRECISION: 2, WIKI: p.w ?? null, QID: p.q ?? null, SOURCE: 'cliopatria', _b: p.b, _a: p.a, _l: p.l } })
  }
  return { features, groups }
}

const polysOf = (geom: GeoJSON.Geometry | null) =>
  !geom ? [] : ((geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []) as number[][][][])

const inside = (lon: number, lat: number, geom: GeoJSON.Geometry | null, b?: number[]) =>
  (!b || (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3])) && polysOf(geom).some((poly) => pointInPolygon(lon, lat, poly))

async function timeline({ lon, lat, clio, cshapes, basemaps }: TimelineRequest): Promise<Hold[]> {
  const holds: Hold[] = []
  // Cliopatria: each shape has its own years, so one pass over each era finds every holder
  const seen = new Set<string>()
  for (const url of clio) {
    const topo = await getTopo(url)
    const layer = topo.objects[Object.keys(topo.objects)[0]] as GeometryCollection<ClioProps>
    for (const g of layer.geometries) {
      const p = g.properties as ClioProps
      if (p.g || !g.type) continue
      const b = p.b
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue
      const key = `${p.n}|${p.f}`
      if (seen.has(key)) continue
      if (!inside(lon, lat, (feature(topo, g) as GeoJSON.Feature).geometry)) continue
      seen.add(key)
      holds.push({ from: p.f, to: p.e, name: p.n, partOf: p.m ?? null, under: null, wiki: p.w ?? null, precision: 2 })
    }
  }
  if (cshapes) {
    const topo = await getTopo(cshapes)
    const layer = topo.objects[Object.keys(topo.objects)[0]] as GeometryCollection<CsProps>
    for (const g of layer.geometries) {
      const p = g.properties as CsProps
      const b = p.b
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3] || !inside(lon, lat, (feature(topo, g) as GeoJSON.Feature).geometry)) continue
      const end = p.e ?? Infinity
      p.n.forEach(([from, name, ruler], i) => {
        const to = Math.min(end, p.n[i + 1]?.[0] ?? Infinity)
        holds.push({ from: Math.max(from, p.f), to, name, partOf: null, under: ruler, wiki: null, precision: 3 })
      })
    }
  }
  // historical-basemaps: before Cliopatria, and wherever Cliopatria records nobody
  const clioSpans = holds.filter((h) => h.precision === 2).map((h) => [h.from, h.to] as const)
  for (const bm of basemaps) {
    const g = (await (await fetch(bm.url)).json()) as GeoJSON.FeatureCollection
    const f = g.features.find((x) => x.properties?.NAME && inside(lon, lat, x.geometry, x.properties._b))
    if (!f) continue
    // cut out the years Cliopatria covers
    let pieces: [number, number][] = [[bm.from, bm.to]]
    for (const [a, b] of clioSpans) pieces = pieces.flatMap(([x, y]): [number, number][] => (b <= x || a >= y ? [[x, y]] : [...(a > x ? [[x, a] as [number, number]] : []), ...(b < y ? [[b, y] as [number, number]] : [])]))
    const fp = f.properties!
    for (const [x, y] of pieces) if (y - x >= 1) holds.push({ from: x, to: y, name: fp.NAME, partOf: fp.PARTOF && fp.PARTOF !== fp.NAME ? fp.PARTOF : null, under: f.properties!.SUBJECTO && f.properties!.SUBJECTO !== f.properties!.NAME ? f.properties!.SUBJECTO : null, wiki: null, precision: Math.min(1, f.properties!.BORDERPRECISION ?? 1) })
  }
  // one row per continuous hold: merge touching rows with the same name and overlord
  holds.sort((a, b) => a.from - b.from || a.to - b.to)
  const out: Hold[] = []
  for (const h of holds) {
    const last = out.find((o) => o.name === h.name && o.under === h.under && o.partOf === h.partOf && h.from <= o.to + 1e-6 && h.from >= o.from)
    if (last) last.to = Math.max(last.to, h.to)
    else out.push({ ...h })
  }
  return out.sort((a, b) => a.from - b.from)
}

self.onmessage = async (e: MessageEvent<Request | TimelineRequest>) => {
  if ('timeline' in e.data) {
    const reply: TimelineReply = { timeline: e.data.timeline, holds: await timeline(e.data) }
    ;(self as unknown as Worker).postMessage(reply)
    return
  }
  const { year } = e.data
  let features: GeoJSON.Feature[]
  let groups: GroupLabel[] = []
  if (e.data.cshapes) features = fromCShapes(await getTopo(e.data.url!), year).features
  else if (e.data.clio) {
    const c = fromCliopatria(await getTopo(e.data.clio), year)
    features = c.features
    groups = c.groups
    // where no state is recorded, show the historical-basemaps peoples and cultures (approximate)
    if (e.data.fill) {
      const hb = (await (await fetch(e.data.fill)).json()) as GeoJSON.FeatureCollection
      const states = features.map((f) => ({ b: f.properties!._b as number[], polys: polysOf(f.geometry) }))
      const covered = ([lon, lat]: number[]) =>
        states.some(({ b, polys }) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3] && polys.some((poly) => pointInPolygon(lon, lat, poly)))
      for (const f of hb.features) {
        if (!f.properties?.NAME) continue
        // sample the label point and points along the outline: keep the shape only where most of
        // it lies outside every Cliopatria state, so the two sources never draw the same place twice
        const samples: number[][] = [f.properties._l ?? [0, 0]]
        for (const poly of polysOf(f.geometry)) {
          const ring = poly[0]
          const step = Math.max(1, Math.floor(ring.length / 12))
          for (let k = 0; k < ring.length; k += step) samples.push(ring[k])
        }
        const outside = samples.filter((pt) => !covered(pt)).length / samples.length
        if (!covered(samples[0]) && outside >= 0.7) features.push({ ...f, properties: { ...f.properties, BORDERPRECISION: Math.min(1, f.properties.BORDERPRECISION ?? 1) } })
      }
    }
  } else features = ((await (await fetch(e.data.url!)).json()) as GeoJSON.FeatureCollection).features

  const polities: Polity[] = []
  const firm: number[][][] = []
  const loose: number[][][] = []
  features.forEach((f, i) => {
    const polys = polysOf(f.geometry)
    if (!polys.length) return
    const props = f.properties ?? {}
    const precision = props.BORDERPRECISION ?? 1
    for (const poly of polys) (precision >= 2 ? firm : loose).push(...poly)
    polities.push({
      id: `${year}:${i}`,
      name: props.NAME,
      subjectTo: props.SUBJECTO && props.SUBJECTO !== props.NAME ? props.SUBJECTO : null,
      partOf: props.PARTOF && props.PARTOF !== props.NAME ? props.PARTOF : null,
      precision,
      wiki: props.WIKI ?? null,
      qid: props.QID ?? null,
      source: props.SOURCE ?? (precision === 3 ? 'cshapes' : 'basemaps'),
      polys,
      bbox: props._b,
      area: props._a,
      label: props._l,
    })
  })
  const segments = ringsToSegments(firm)
  const soft = ringsToSegments(loose)
  // distance along the line at each vertex, for dashing the approximate borders
  const softDist = new Float32Array(soft.length / 3)
  let run = 0
  for (let v = 0; v < softDist.length; v += 2) {
    const k = v * 3
    softDist[v] = run
    run += Math.hypot(soft[k + 3] - soft[k], soft[k + 4] - soft[k + 1], soft[k + 5] - soft[k + 2])
    softDist[v + 1] = run
  }
  const out: Parsed = { year, polities, groups, segments, soft, softDist }
  ;(self as unknown as Worker).postMessage(out, [segments.buffer, soft.buffer, softDist.buffer])
}
