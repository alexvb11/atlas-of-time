// Fact check of everything the atlas states, against Wikidata and the Wikipedia articles it cites.
// Flags, never fixes: every flag is reviewed by hand (scripts/reports/fact-check.json).
//
// 1. Event years: each event's article (curated/event-articles.mjs) -> Wikidata dates (point in
//    time, start/end, inception, dissolution, publication, opening). If none matches, the year
//    must at least appear in the article's lead text.
// 2. Entity spans: curated from/to vs Wikidata inception/dissolution (documented entities only).
// 3. Rulers: a reign must fall within the ruler's lifetime (Wikidata birth/death).
// 4. Display strings: no raw Wikidata ids (Q123) anywhere a reader can see.
// Usage: node scripts/qa/fact-check.mjs   (network on first run; cached after)
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJSON, wikidataEntities, claims, wdYear } from '../build-data/lib/wiki.mjs'
import { eventArticles } from '../build-data/curated/event-articles.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = async (f) => JSON.parse(await fs.readFile(path.join(root, f), 'utf8'))
const curated = await read('public/data/entities.json')
const auto = await read('public/data/entities-auto.json')
const autoText = await read('public/data/entities-auto-text.json').catch(() => ({}))
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/** title -> {title, qid, text}: the whole lead as plain text */
async function leads(titles) {
  const out = new Map()
  for (const batch of chunks([...new Set(titles)], 20)) {
    const j = await getJSON(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts|pageprops&ppprop=wikibase_item&exintro=1&explaintext=1&exlimit=20&titles=${encodeURIComponent(batch.join('|'))}`,
    )
    const alias = new Map()
    for (const n of j.query?.normalized ?? []) alias.set(n.to, n.from)
    for (const r of j.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from)
    for (const p of Object.values(j.query?.pages ?? {})) {
      if (p.missing !== undefined) continue
      const rec = { title: p.title, qid: p.pageprops?.wikibase_item, text: p.extract ?? '' }
      out.set(p.title, rec)
      let k = p.title
      while (alias.has(k)) out.set((k = alias.get(k)), rec)
    }
  }
  return out
}

const yearOf = (t) => Math.floor(t + 1e-6)
const label = (y) => (y <= 0 ? `${1 - y} BC` : `${y}`)
/** does the text mention this astronomical year? (BCE written "753 BC", "753 BCE") */
function mentions(text, y) {
  if (y > 0) return new RegExp(`\\b${y}\\b`).test(text)
  const b = 1 - y
  return new RegExp(`\\b${b}\\s*(BC|BCE|B\\.C\\.)`).test(text) || new RegExp(`\\b${b.toLocaleString('en-US')}\\s*(BC|BCE)`).test(text)
}

const report = { events: [], spans: [], rulers: [], ids: [], checked: {} }

// ---------- 1. events ----------
const evs = []
for (const e of curated.entities) for (const [t, title, , conf] of e.events) evs.push({ key: `${e.id}|${title}`, t, title, conf, where: e.id })
for (const g of curated.events) evs.push({ key: `ev:${g.id}`, t: g.t, title: g.title, conf: g.conf, where: 'globe' })
const L = await leads(evs.map((e) => eventArticles[e.key]?.split('#')[0]).filter(Boolean))
const ents = await wikidataEntities([...L.values()].map((r) => r.qid).filter(Boolean), 'claims')
const DATE_PROPS = ['P585', 'P580', 'P582', 'P571', 'P576', 'P577', 'P1619', 'P1191', 'P793']
let evOk = 0
for (const ev of evs) {
  const art = L.get(eventArticles[ev.key]?.split('#')[0])
  if (!art) {
    report.events.push({ ...ev, why: 'no article' })
    continue
  }
  const y = yearOf(ev.t)
  const wd = ents.get(art.qid)
  const years = DATE_PROPS.flatMap((p) => claims(wd, p).map((c) => wdYear(c.mainsnak?.datavalue?.value)?.year)).filter((x) => x != null)
  // Wikidata BCE years are historical (no year 0); our axis is astronomical: allow ±1 for BCE
  const tol = ev.conf === 'estimated' ? Math.max(2, Math.abs(y) * 0.02) : y <= 0 ? 1 : 0
  const wdHit = years.some((x) => Math.abs(x - y) <= tol)
  const textHit = mentions(art.text, y) || (y <= 0 && (mentions(art.text, y - 1) || mentions(art.text, y + 1)))
  if (wdHit || textHit) evOk++
  else report.events.push({ key: ev.key, year: label(y), conf: ev.conf ?? 'documented', article: art.title, wikidataYears: [...new Set(years)].sort((a, b) => a - b).map(label) })
}
report.checked.events = `${evOk}/${evs.length} confirmed by Wikidata or the article lead`

// ---------- 2. entity spans ----------
const ewd = await wikidataEntities(curated.entities.map((e) => e.qid).filter(Boolean), 'claims')
let spanOk = 0
for (const e of curated.entities) {
  const wd = ewd.get(e.qid)
  if (!wd || e.conf !== 'documented') continue
  const start = ['P571', 'P580'].flatMap((p) => claims(wd, p).map((c) => wdYear(c.mainsnak?.datavalue?.value)?.year)).filter((x) => x != null)
  const end = ['P576', 'P582'].flatMap((p) => claims(wd, p).map((c) => wdYear(c.mainsnak?.datavalue?.value)?.year)).filter((x) => x != null)
  const tol = 3
  const fromBad = start.length && !start.some((x) => Math.abs(x - yearOf(e.from)) <= tol)
  const toBad = e.to < 2026 && end.length && !end.some((x) => Math.abs(x - yearOf(e.to)) <= tol)
  if (fromBad || toBad) report.spans.push({ id: e.id, ours: `${label(yearOf(e.from))}–${e.to >= 2026 ? 'today' : label(yearOf(e.to))}`, wikidataStart: start.map(label), wikidataEnd: end.map(label) })
  else spanOk++
}
report.checked.spans = `${spanOk} documented spans agree with Wikidata (±3 years)`

// ---------- 3. rulers ----------
const rulers = []
for (const e of [...curated.entities, ...auto.entities]) for (const [from, to, name] of e.rulers ?? []) rulers.push({ id: e.id, from, to, name: name.replace(/\s*\(.*?\)\s*$/, '').split(/ and |, | \/ /)[0] })
const RL = await leads(rulers.map((r) => r.name).filter((n) => !/^Q\d+$/.test(n)))
const rwd = await wikidataEntities([...RL.values()].map((r) => r.qid).filter(Boolean), 'claims')
let rulerOk = 0
for (const r of rulers) {
  const wd = rwd.get(RL.get(r.name)?.qid)
  const born = claims(wd, 'P569').map((c) => wdYear(c.mainsnak?.datavalue?.value)?.year).filter((x) => x != null)[0]
  const died = claims(wd, 'P570').map((c) => wdYear(c.mainsnak?.datavalue?.value)?.year).filter((x) => x != null)[0]
  if (born == null && died == null) continue // not a person page, or no dates: nothing to test
  const bad = (born != null && yearOf(r.from) < born + 0) || (died != null && yearOf(r.to) > died + 1 && r.to < 2026)
  if (bad) report.rulers.push({ ...r, from: label(yearOf(r.from)), to: label(yearOf(r.to)), born: born != null ? label(born) : null, died: died != null ? label(died) : null, page: RL.get(r.name)?.title })
  else rulerOk++
}
report.checked.rulers = `${rulerOk} reigns fall within the ruler's lifetime`

// ---------- 4. raw ids in visible text ----------
const scan = (o, where) => {
  if (typeof o === 'string') {
    if (!o.startsWith('http') && (/^Q\d+$/.test(o) || /\bQ\d{2,}\b/.test(o))) report.ids.push({ where, text: o })
  } else if (Array.isArray(o)) o.forEach((x, i) => scan(x, `${where}[${i}]`))
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!['qid', 'id', 'match', 'sources', 'wiki'].includes(k)) scan(v, `${where}.${k}`)
}
for (const e of auto.entities) scan(e, e.id)
for (const [k, v] of Object.entries(autoText)) scan(v, `text:${k}`)
for (const e of curated.entities) scan(e, e.id)

await fs.writeFile(path.join(root, 'scripts/reports/fact-check.json'), JSON.stringify(report, null, 1))
console.log(report.checked)
console.log(`flags: ${report.events.length} events, ${report.spans.length} spans, ${report.rulers.length} rulers, ${report.ids.length} raw ids`)
