// Entity index: curated entities, languages, lineages and present-day country facts.
// All "what is true at time T" lookups go through small helpers here.
import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { pointInPolygon } from '../geo/sphere'

export type Conf = 'documented' | 'estimated' | 'disputed'
export type Span = [number, number, string, Conf?]
export type LangSpan = [number, number, [string, number][]]
export type Entity = {
  id: string
  name: string
  kind: string
  region: string
  from: number
  to: number
  conf: Conf
  wiki?: string
  qid?: string
  summary?: string
  iso3?: string
  names: Span[]
  capitals: Span[]
  gov: Span[]
  rulers: Span[]
  religion: Span[]
  langs: LangSpan[]
  pop: [number, number, Conf][]
  events: [number, string, string | null, Conf?][]
  facts: [number | null, number | null, string][]
  match: string[]
  sources: string[]
}
export type Language = {
  id: string
  name: string
  native: string
  family: string[]
  hello?: { text: string; roman: string; note?: string }
  attested?: { text: string; roman: string; meaning: string }
  note?: string
  voice?: string
  reconstructed?: boolean
}
export type LineageSpan = [number, number, string, boolean, [number, number, number, number]?]
export type Lineage = { name: string; spans: LineageSpan[]; related?: [number, number, string][] }
export type Country = {
  iso3: string
  iso2: string
  name: string
  official: string
  capital: string[]
  region: string
  subregion: string
  languages: string[]
  currencies: string[]
  area: number
  borders: string[]
  flag: string
  latlng: [number, number]
  landlocked: boolean
}

type CountryShape = { id: string; country: Country; polys: number[][][][]; bbox: [number, number, number, number] }

export type EntityIndex = {
  entities: Map<string, Entity>
  languages: Map<string, Language>
  lineages: Record<string, Lineage>
  countries: Map<string, Country>
  byPolity: (name: string, t: number) => (Entity & { nameAt: (t: number) => string }) | null
  matchesAny: (name: string) => Entity[]
  countryAt: (lon: number, lat: number) => Country | null
  countryShape: (iso3: string) => CountryShape | null
  population: Record<string, [number, number][]>
  all: Entity[]
}

/** Value of the span containing t */
export function spanAt<T extends [number, number, ...unknown[]]>(spans: T[], t: number): T | undefined {
  for (const s of spans) if (t >= s[0] && t < s[1]) return s
  return undefined
}

export function nameAt(e: Entity, t: number): string {
  return (spanAt(e.names, t)?.[2] as string | undefined) ?? e.name
}

/** Log-linear interpolation of a [t, v][] series; null outside its range */
export function interpSeries(series: [number, number, ...unknown[]][], t: number): number | null {
  if (!series.length) return null
  if (series.length === 1) return Math.abs(series[0][0] - t) < 150 ? series[0][1] : null
  if (t < series[0][0] || t > series[series.length - 1][0]) return null
  for (let i = 0; i < series.length - 1; i++) {
    const [t0, v0] = series[i]
    const [t1, v1] = series[i + 1]
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1)
      return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * f)
    }
  }
  return null
}

let promise: Promise<EntityIndex> | null = null
let ready: EntityIndex | null = null

export function loadEntityIndex(): Promise<EntityIndex> {
  promise ??= (async () => {
    const [ents, ctry, topo, pop] = await Promise.all([
      fetch('/data/entities.json').then((r) => r.json()),
      fetch('/data/countries.json').then((r) => r.json()),
      fetch('/data/countries-50m.json').then((r) => r.json() as Promise<Topology>),
      fetch('/data/population.json').then((r) => r.json()),
    ])
    const entities = new Map<string, Entity>((ents.entities as Entity[]).map((e) => [e.id, e]))
    const languages = new Map<string, Language>((ents.languages as Language[]).map((l) => [l.id, l]))
    const byName = new Map<string, Entity[]>()
    for (const e of entities.values())
      for (const n of e.match) {
        if (!byName.has(n)) byName.set(n, [])
        byName.get(n)!.push(e)
      }
    const countries = new Map<string, Country>()
    const byNumeric = ctry.countries as Record<string, Country>
    for (const c of Object.values(byNumeric)) countries.set(c.iso3, c)

    const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as GeoJSON.FeatureCollection
    const shapes: CountryShape[] = []
    for (const f of fc.features) {
      const c = f.id ? byNumeric[String(f.id)] : undefined
      if (!c || !f.geometry) continue
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
      let a = 180, b = 90, cc = -180, d = -90
      for (const p of polys)
        for (const [x, y] of p[0]) {
          a = Math.min(a, x); b = Math.min(b, y); cc = Math.max(cc, x); d = Math.max(d, y)
        }
      shapes.push({ id: c.iso3, country: c, polys, bbox: [a, b, cc, d] })
    }
    const shapeById = new Map(shapes.map((s) => [s.id, s]))

    const idx: EntityIndex = {
      entities,
      languages,
      lineages: ents.lineages,
      countries,
      population: pop.series,
      all: [...entities.values()],
      matchesAny: (name) => byName.get(name) ?? [],
      byPolity(name, t) {
        const list = byName.get(name)
        const e = list?.find((x) => t >= x.from && t < x.to)
        return e ? Object.assign(e, { nameAt: (tt: number) => nameAt(e, tt) }) : null
      },
      countryAt(lon, lat) {
        for (const s of shapes) {
          const [a, b, c, d] = s.bbox
          if (lon < a || lon > c || lat < b || lat > d) continue
          if (s.polys.some((p) => pointInPolygon(lon, lat, p))) return s.country
        }
        return null
      },
      countryShape: (iso3) => shapeById.get(iso3) ?? null,
    }
    ready = idx
    return idx
  })()
  return promise
}

export function useEntityIndex(): EntityIndex | null {
  const [idx, setIdx] = useState<EntityIndex | null>(ready)
  useEffect(() => {
    if (!idx) loadEntityIndex().then(setIdx)
  }, [idx])
  return idx
}

export function flagFor(e: Entity, t: number): string | null {
  if (!e.iso3 || t < e.from || !ready) return null
  return ready.countries.get(e.iso3)?.flag ?? null
}
