// Location + time -> the thing that occupied that place. Never returns nothing.
//
// Order of precedence for a present-day point P at time T:
//   1. deep time (> 2 Ma): the landmass / supercontinent and geological context
//   2. curated lineage span of the present-day country containing P, when marked `override`
//   3. the historical-basemaps polygon at P, if its name matches a curated entity valid at T
//   4. a non-override lineage span, when P has no polygon or the polygon belongs to that entity
//   5. the polygon itself as an un-curated polity (honestly labelled)
//   6. present-day country synthesised from country facts (after 1945)
//   7. prehistory: hominins / foragers / early farmers by region and time
import type { Polity } from './history'
import { nameAt, type Country, type Entity, type EntityIndex } from './entities'
import { PRESENT, toMa, yearsAgo } from '../time/scale'
import { periodAt, supercontinentAt } from '../time/eras'

export type Lineage = {
  iso: string
  name: string
  chain: { id: string; name: string; from: number; to: number; related?: boolean }[]
}

export type Resolution =
  | { kind: 'entity'; entity: Entity; via: 'lineage' | 'map'; polity: Polity | null; country: Country | null; lineage: Lineage | null; outlineFromCountry: boolean }
  | { kind: 'polity'; polity: Polity; country: Country | null; lineage: Lineage | null }
  | { kind: 'country'; country: Country; lineage: Lineage | null }
  | { kind: 'prehistory'; title: string; text: string; who: string; country: Country | null; lineage: Lineage | null }
  | { kind: 'deep'; title: string; note: string; country: Country | null }
  | { kind: 'ocean'; title: string; text: string }

const GENERIC = /^(minor states|-|\s*)$/i

function lineageFor(idx: EntityIndex, iso: string | undefined): Lineage | null {
  if (!iso) return null
  const l = idx.lineages[iso]
  if (!l) return null
  const chain: Lineage['chain'] = []
  const seen = new Set<string>()
  const add = (from: number, to: number, id: string, related = false) => {
    const e = idx.entities.get(id)
    if (!e || seen.has(id + from)) return
    seen.add(id + from)
    chain.push({ id, name: nameAt(e, Math.max(from, e.from)), from, to, related })
  }
  for (const [from, to, id] of l.spans) add(from, to, id)
  for (const [from, to, id] of l.related ?? []) add(from, to, id, true)
  chain.sort((a, b) => a.from - b.from)
  return { iso, name: l.name, chain }
}

function lineageSpan(idx: EntityIndex, iso: string | undefined, t: number, lon: number, lat: number) {
  const l = iso ? idx.lineages[iso] : undefined
  if (!l) return null
  for (const s of l.spans) {
    if (t < s[0] || t >= s[1]) continue
    const bb = s[4]
    if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) continue
    return s
  }
  return null
}

export function resolveAt(idx: EntityIndex, p: [number, number], t: number, polity: Polity | null): Resolution {
  const [lon, lat] = p
  const country = idx.countryAt(lon, lat)
  const lineage = lineageFor(idx, country?.iso3)

  if (toMa(t) > 2) {
    const sc = supercontinentAt(t)
    return { kind: 'deep', title: sc.name, note: sc.note, country }
  }

  const span = lineageSpan(idx, country?.iso3, t, lon, lat)
  if (span && span[3]) {
    const e = idx.entities.get(span[2])!
    const onMap = !!polity && e.match.includes(polity.name)
    return { kind: 'entity', entity: e, via: 'lineage', polity: onMap ? polity : null, country, lineage, outlineFromCountry: !onMap }
  }
  if (polity) {
    const e = idx.byPolity(polity.name, t)
    if (e) return { kind: 'entity', entity: e, via: 'map', polity, country, lineage, outlineFromCountry: false }
  }
  if (span) {
    const e = idx.entities.get(span[2])!
    if (!polity || GENERIC.test(polity.name) || e.match.includes(polity.name)) {
      const onMap = !!polity && e.match.includes(polity.name)
      return { kind: 'entity', entity: e, via: 'lineage', polity: onMap ? polity : null, country, lineage, outlineFromCountry: !onMap }
    }
  }
  if (polity && !GENERIC.test(polity.name) && t > -12000) {
    // a modern country polygon whose name matches today's country: use the richer present-day facts
    if (country && t >= 1945 && polity.name === country.name) return { kind: 'country', country, lineage }
    return { kind: 'polity', polity, country, lineage }
  }
  if (country && t >= 1945) return { kind: 'country', country, lineage }
  if (!country && !polity) {
    return { kind: 'ocean', title: oceanName(lon, lat), text: 'Open water. Click on land to explore who lived there at this moment.' }
  }
  return { kind: 'prehistory', ...prehistoryAt(lon, lat, t), country, lineage }
}

function oceanName(lon: number, lat: number) {
  if (lat < -60) return 'Southern Ocean'
  if (lat > 66) return 'Arctic Ocean'
  if (lon > -70 && lon < 20 && lat > -60) return lat > 30 && lon > -6 ? 'Mediterranean / European seas' : 'Atlantic Ocean'
  if (lon >= 20 && lon < 120 && lat < 25) return 'Indian Ocean'
  return 'Pacific Ocean'
}

/** Who lived here, before states. Deliberately conservative wording. */
export function prehistoryAt(lon: number, lat: number, t: number): { title: string; text: string; who: string } {
  const ya = yearsAgo(t)
  const americas = lon < -30
  const sahul = (lon > 110 && lat < -10) || (lon > 130 && lat < 0)
  const africa = lon > -20 && lon < 52 && lat < 35 && !(lon > 35 && lat > 12)
  const europe = lat > 35 && lon > -12 && lon < 45

  if (americas) {
    if (ya > 16000)
      return { who: 'No humans', title: 'Before the first Americans', text: 'No people had yet reached the Americas. The earliest widely accepted sites date to about 16,000 years ago; footprints at White Sands, New Mexico, may be 21,000–23,000 years old, but that date is debated.' }
    if (ya > 4000) return { who: 'Hunter-gatherers', title: 'Paleo-Indian and Archaic peoples', text: 'Descendants of migrants from Beringia, living by hunting, fishing and gathering; maize, squash and beans were being domesticated in Mesoamerica.' }
    return { who: 'Farmers and foragers', title: 'Indigenous peoples of the Americas', text: 'Farming villages and foraging peoples. Little is recorded here in this period beyond archaeology.' }
  }
  if (sahul) {
    if (ya > 65000) return { who: 'No humans', title: 'Before people reached Sahul', text: 'Australia and New Guinea, joined at low sea level as Sahul, had no people yet. Arrival dates of 50,000–65,000 years ago are debated.' }
    return { who: 'Aboriginal peoples', title: 'First peoples of Australia and New Guinea', text: 'Among the oldest continuous cultures on Earth. New Guinea developed its own agriculture about 7,000–10,000 years ago.' }
  }
  if (ya > 2.0e6) {
    if (africa) return { who: 'Early hominins', title: 'Early hominins', text: 'Australopithecines and the first members of the genus Homo lived in eastern and southern Africa. Stone tools appear by about 3.3 million years ago.' }
    return { who: 'No hominins', title: 'Before humans left Africa', text: 'No hominins had yet left Africa. The oldest sites outside Africa, such as Dmanisi in Georgia, date to about 1.8 million years ago.' }
  }
  if (ya > 300000) {
    if (africa) return { who: 'Homo erectus and successors', title: 'Homo erectus and its descendants', text: 'Hominins making Acheulean hand-axes; the lineage that leads to Homo sapiens is evolving here.' }
    if (europe) return { who: 'Archaic humans', title: 'Archaic humans', text: 'Groups such as Homo antecessor and Homo heidelbergensis; the ancestors of Neanderthals.' }
    return { who: 'Homo erectus', title: 'Homo erectus', text: 'Homo erectus lived across much of Asia, from the Caucasus to Java, for over a million years.' }
  }
  if (ya > 45000) {
    if (africa) return { who: 'Homo sapiens', title: 'Early Homo sapiens', text: 'Anatomically modern humans; the oldest known fossils, from Jebel Irhoud in Morocco, are about 300,000 years old.' }
    if (europe || (lat > 30 && lon < 70)) return { who: 'Neanderthals', title: 'Neanderthals', text: 'Neanderthals lived across Europe and western Asia. They buried their dead, made pigments, and interbred with modern humans.' }
    return { who: 'Archaic humans', title: 'Archaic humans of Asia', text: 'Homo erectus, Denisovans and others; Homo sapiens was beginning to arrive. Records are sparse.' }
  }
  if (ya > 11700) return { who: 'Hunter-gatherers', title: 'Ice Age hunter-gatherers', text: 'Modern humans living by hunting and gathering, painting caves such as Chauvet and Lascaux in Europe.' }
  const fertile = lon > 30 && lon < 50 && lat > 29 && lat < 40
  if (ya > 5000) {
    if (fertile) return { who: 'Early farmers', title: 'Neolithic farmers of the Fertile Crescent', text: 'Among the first farmers anywhere: wheat, barley, sheep and goats were domesticated here from about 11,000 years ago.' }
    return { who: 'Foragers and early farmers', title: 'Neolithic and Mesolithic peoples', text: 'Farming was spreading from several centres; many people still lived by foraging. Little is recorded here in this period.' }
  }
  return { who: 'Chiefdoms and villages', title: 'Bronze Age peoples', text: 'Farmers, herders and chiefdoms without written records. Little is recorded here in this period.' }
}

export function geologyAt(t: number) {
  return periodAt(t)
}

export const presentYear = PRESENT
