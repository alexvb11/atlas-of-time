// "What happened here, then?": dated events Wikidata places at a point (scripts/build-data/
// place-events.mjs), searched around a clicked location and the current time. Before an event is
// shown, its year is confirmed against its Wikipedia article's own lead; events whose article does
// not give that year are left out, so a wrong Wikidata date never reaches the screen.
import { PRESENT } from '../time/scale'

export type PlaceEvent = { lon: number; lat: number; t: number; title: string; kind: string }
export type Nearby = PlaceEvent & { km: number; bearing: string; dt: number }

type Raw = { kinds: string[]; events: [number, number, number, string, number][] }
let dataP: Promise<{ kinds: string[]; events: Raw['events'] }> | null = null
export const loadPlaceEvents = () =>
  (dataP ??= fetch('/data/place-events.json')
    .then((r) => r.json() as Promise<Raw>)
    .catch((e) => {
      dataP = null
      throw e
    }))

const R = 6371
const rad = Math.PI / 180
function km(lon1: number, lat1: number, lon2: number, lat2: number) {
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
function bearing(lon1: number, lat1: number, lon2: number, lat2: number) {
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad)
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad)
  return COMPASS[Math.round(((Math.atan2(y, x) / rad + 360) % 360) / 45) % 8]
}

/** How far around t counts as "then": a few years in modern times, decades in antiquity */
export const windowAt = (t: number) => Math.max(2, Math.min(150, (PRESENT - t) * 0.025))

/**
 * Events within `radiusKm` of a point and `window` years of t, closest in time and space first.
 * Searches wider (3× the window, 2× the radius) when nothing is that close, and says so.
 */
export async function eventsNear(lon: number, lat: number, t: number, radiusKm = 250): Promise<{ list: Nearby[]; window: number; radius: number; widened: boolean }> {
  const { kinds, events } = await loadPlaceEvents()
  const search = (w: number, r: number) => {
    // events are sorted by time: binary search the window's start
    let lo = 0
    let hi = events.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (events[m][2] < t - w) lo = m + 1
      else hi = m
    }
    const out: Nearby[] = []
    for (let i = lo; i < events.length && events[i][2] <= t + w; i++) {
      const [elon, elat, et, title, k] = events[i]
      const d = km(lon, lat, elon, elat)
      if (d <= r) out.push({ lon: elon, lat: elat, t: et, title, kind: kinds[k], km: d, bearing: bearing(lon, lat, elon, elat), dt: et - t })
    }
    out.sort((a, b) => Math.abs(a.dt) / w + a.km / r - (Math.abs(b.dt) / w + b.km / r))
    return out
  }
  const w = windowAt(t)
  let list = search(w, radiusKm)
  if (list.length) return { list: list.slice(0, 24), window: w, radius: radiusKm, widened: false }
  list = search(w * 3, radiusKm * 2)
  return { list: list.slice(0, 24), window: w * 3, radius: radiusKm * 2, widened: true }
}

// ---------- year confirmation against each article's lead ----------
const leadCache = new Map<string, string>()
async function leads(titles: string[]) {
  const need = titles.filter((t) => !leadCache.has(t))
  for (let i = 0; i < need.length; i += 20) {
    const batch = need.slice(i, i + 20)
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts&exintro=1&explaintext=1&exlimit=20&titles=${encodeURIComponent(batch.join('|'))}`,
    )
    if (!r.ok) throw new Error(`Wikipedia ${r.status}`)
    const j = await r.json()
    const alias = new Map<string, string>()
    for (const n of j.query?.normalized ?? []) alias.set(n.to, n.from)
    for (const n of j.query?.redirects ?? []) alias.set(n.to, alias.get(n.from) ?? n.from)
    for (const p of Object.values(j.query?.pages ?? {}) as { title: string; extract?: string }[]) {
      let k = p.title
      leadCache.set(k, p.extract ?? '')
      while (alias.has(k)) leadCache.set((k = alias.get(k)!), p.extract ?? '')
    }
    for (const t of batch) if (!leadCache.has(t)) leadCache.set(t, '')
  }
  return leadCache
}

/** Does the text give this (astronomical) year? BCE years as "480 BC" / "480 BCE" */
export function mentionsYear(text: string, t: number) {
  const y = Math.floor(t + 1e-6)
  if (y > 0) return new RegExp(`\\b${y}\\b`).test(text)
  return [y - 1, y, y + 1].some((a) => {
    const b = 1 - a
    return new RegExp(`\\b(${b}|${b.toLocaleString('en-US')})\\s*(BC|BCE|B\\.C\\.)`).test(text)
  })
}

/** Splits events into those whose article confirms the year and those it does not */
export async function confirmYears(list: Nearby[]): Promise<{ confirmed: Nearby[]; unconfirmed: number }> {
  const text = await leads([...new Set(list.map((e) => e.title))])
  const confirmed = list.filter((e) => mentionsYear(text.get(e.title) ?? '', e.t))
  return { confirmed, unconfirmed: list.length - confirmed.length }
}
