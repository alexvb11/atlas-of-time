// Entity index: curated entities, languages, lineages and present-day country facts.
// All "what is true at time T" lookups go through small helpers here.
import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { pointInPolygon } from '../geo/sphere'
import { useTime } from '../time/store'

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
  /** 1 = curated (default), 2 = automated from Wikidata (modern countries and predecessors),
   *  3 = automated match of a border-data name to Wikipedia/Wikidata */
  tier?: 1 | 2 | 3
  /** where the language shares come from, shown under the chart */
  langsSource?: string
  /** languages without known speaker shares (automated tiers) */
  langNames?: [number, number, string[]][]
  /** for present-day countries: when today's state began; modern facts are gated on it */
  modernFrom?: number
  /** dates are the span of border-data snapshots using this name, not documented dates */
  datesFromMap?: boolean
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
export type Lineage = { name: string; spans: LineageSpan[]; related?: [number, number, string][]; auto?: boolean }
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
let curated: Promise<{ entities: Entity[]; lineages: Record<string, Lineage>; languages: Language[]; events: unknown[]; routes: unknown[] }> | null = null

/** The curated file (entities, lineages, languages, events, routes), fetched once for every reader */
export const loadCurated = () => (curated ??= fetch('/data/entities.json').then((r) => r.json()))

export function loadEntityIndex(): Promise<EntityIndex> {
  promise ??= (async () => {
    const [ents, auto, ctry, topo, pop] = await Promise.all([
      loadCurated(),
      fetch('/data/entities-auto.json')
        .then((r) => (r.ok ? r.json() : { entities: [], lineages: {} }))
        .catch(() => ({ entities: [], lineages: {} })),
      fetch('/data/countries.json').then((r) => r.json()),
      fetch('/data/countries-50m.json').then((r) => r.json() as Promise<Topology>),
      fetch('/data/population.json').then((r) => r.json()),
    ])
    const entities = new Map<string, Entity>()
    // summaries and sources for automated entities arrive later (loadEntityText)
    for (const e of auto.entities as Entity[]) entities.set(e.id, { ...e, sources: [] })
    // curated entities win over automated ones with the same id
    for (const e of ents.entities as Entity[]) entities.set(e.id, { ...e, tier: 1 })
    // curated lineages replace automated ones for the same country
    const lineages: Record<string, Lineage> = { ...auto.lineages, ...ents.lineages }
    const languages = new Map<string, Language>((ents.languages as Language[]).map((l) => [l.id, l]))
    const byName = new Map<string, Entity[]>()
    for (const e of entities.values())
      for (const n of e.match) {
        if (!byName.has(n)) byName.set(n, [])
        byName.get(n)!.push(e)
      }
    // when several entities claim a name at the same time, curated beats automated
    for (const list of byName.values()) list.sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1))
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
      lineages,
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
    // warm the panel text once the intro is over and the page is idle, so the first click usually
    // has it without competing with the textures for bandwidth
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500))
    const warm = () => idle(() => void loadEntityText())
    if (useTime.getState().introDone) warm()
    else {
      const off = useTime.subscribe((st) => {
        if (st.introDone) {
          off()
          warm()
        }
      })
    }
    return idx
  })()
  return promise
}

let textPromise: Promise<void> | null = null
let textReady = false
const textListeners = new Set<() => void>()

/**
 * Summaries and source links of automated entities. They are half the automated data and only the
 * panel reads them, so they live in a separate file (written by scripts/build-data/tiers.mjs).
 */
export function loadEntityText(): Promise<void> {
  textPromise ??= Promise.all([
    loadEntityIndex(),
    fetch('/data/entities-auto-text.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
  ]).then(([idx, text]: [EntityIndex, Record<string, [string | null, string[]]>]) => {
    for (const [id, [summary, sources]] of Object.entries(text)) {
      const e = idx.entities.get(id)
      if (!e || e.tier === 1) continue // curated entity with the same id
      if (summary) e.summary = summary
      e.sources = sources
    }
    textReady = true
    textListeners.forEach((l) => l())
  })
  return textPromise
}

/** Loads automated entity text if needed; true once it is in place */
export function useEntityText(): boolean {
  const [ok, setOk] = useState(textReady)
  useEffect(() => {
    if (ok) return
    const l = () => setOk(true)
    textListeners.add(l)
    loadEntityText()
    return () => void textListeners.delete(l)
  }, [ok])
  return ok
}

export function useEntityIndex(): EntityIndex | null {
  const [idx, setIdx] = useState<EntityIndex | null>(ready)
  useEffect(() => {
    if (!idx) loadEntityIndex().then(setIdx)
  }, [idx])
  return idx
}

export function flagFor(e: Entity, t: number): string | null {
  if (!e.iso3 || t < (e.modernFrom ?? e.from) || !ready) return null
  return ready.countries.get(e.iso3)?.flag ?? null
}

/** Is the entity in its present-day form at t (so modern facts like area or currency apply)? */
export const isModernAt = (e: Entity, t: number) => !!e.iso3 && t >= (e.modernFrom ?? e.from)
