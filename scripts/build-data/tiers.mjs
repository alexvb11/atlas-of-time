// Tier 2 + Tier 3 entity generation.
//
// Tier 2: every present-day country (mledoze/countries) is identified on Wikidata by its ISO code
//   (P297), then its predecessor chain (P1365 "replaces", P155 "follows") is walked two steps back
//   to build an automated lineage. Modern facts (government, head of state, capital, languages) are
//   only shown from the current state's inception onward, so nothing modern leaks into the past.
// Tier 3: every historical-basemaps polygon name not covered by a curated or Tier 2 entity is
//   matched to Wikipedia/Wikidata. Candidates come from a hand-checked name map, exact titles and
//   search; they are accepted only if the Wikidata class is a polity / people / culture, the dates
//   overlap the snapshots that use the name, and (when known) the coordinates lie near the polygon.
//
// Output: public/data/entities-auto.json, reports in scripts/reports/.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  wikipediaPages,
  wikipediaSearch,
  wikidataEntities,
  wikidataLabels,
  wikidataSearchStatement,
  ids,
  claims,
  claimYears,
  qualified,
  coord,
  kmBetween,
} from './lib/wiki.mjs'
import { nameMap } from './curated/name-map.mjs'
import * as caucasus from './curated/caucasus.mjs'
import * as med from './curated/mediterranean.mjs'
import * as china from './curated/china.mjs'
import * as ab from './curated/americas-britain.mjs'
import * as tier1 from './curated/tier1.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const NOW = 2026
const log = (...a) => console.log(...a)

// ---------- inputs ----------
const curated = [caucasus, med, china, ab, tier1].flatMap((m) => m.entities)
const curatedNames = new Set(curated.flatMap((e) => e.match))
const countries = JSON.parse(await fs.readFile(path.join(root, 'scripts/.cache/mledoze-countries.json'), 'utf8'))
const historyIndex = JSON.parse(await fs.readFile(path.join(root, 'public/data/history/index.json'), 'utf8'))
const years = historyIndex.snapshots.map((s) => s.year).sort((a, b) => a - b)

// every polygon name with the years it appears and a rough centroid of its first appearance
const nameInfo = new Map()
for (const y of years) {
  const g = JSON.parse(await fs.readFile(path.join(root, `public/data/history/${y}.json`), 'utf8'))
  for (const f of g.features) {
    const n = f.properties.NAME
    if (!n) continue
    let info = nameInfo.get(n)
    if (!info) nameInfo.set(n, (info = { years: [], centroid: null }))
    if (!info.years.includes(y)) info.years.push(y)
    if (!info.centroid && f.geometry) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      const ring = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0]
      let x = 0, yy = 0
      for (const [lo, la] of ring) { x += lo; yy += la }
      info.centroid = [x / ring.length, yy / ring.length]
    }
  }
}
const nextSnapshot = (y) => years.find((v) => v > y) ?? NOW + 1
log(`${nameInfo.size} polygon names, ${curatedNames.size} covered by curated entities`)

// ---------- class vocabulary ----------
const GOOD = /\b(state|country|kingdom|empire|sultanate|khanate|khaganate|caliphate|emirate|dynasty|duchy|grand duchy|principality|republic|confederation|confederacy|federation|colony|protectorate|polity|realm|tsardom|shogunate|county|margraviate|electorate|monarchy|chiefdom|city-state|viceroyalty|dominion|mandate|territory|province|satrapy|tribe|tribal|ethnic group|people|peoples|nation|indigenous|culture|civilization|archaeological|confederation|horde|clan|imamate|theocracy|crown|condominium|autonomous)\b/i
const BAD = /\b(taxon|species|film|album|song|human|given name|family name|surname|river|mountain|lake|island group|asteroid|ship|book|novel|band|television|video game|language|dialect|genus|disambiguation|sports|club|company|person|painting|organization|political party|stadium)\b/i

function kindFrom(labels) {
  const s = labels.join(' ').toLowerCase()
  for (const k of ['empire', 'caliphate', 'sultanate', 'khanate', 'kingdom', 'republic', 'principality', 'duchy', 'colony', 'protectorate', 'confederation', 'city-state', 'dynasty', 'culture', 'civilization', 'tribe', 'ethnic group', 'people', 'state', 'country'])
    if (s.includes(k)) return k === 'ethnic group' || k === 'people' ? 'people' : k === 'civilization' ? 'culture' : k === 'country' ? 'state' : k
  return 'polity'
}

const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(the|of|kingdom|empire|people|peoples|culture|sultanate|state|states|republic|tribe|nation|civilization|dynasty)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
function similarity(a, b) {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 3
  if (x.includes(y) || y.includes(x)) return 2
  const ta = new Set(x.split(' '))
  const tb = y.split(' ')
  const common = tb.filter((t) => ta.has(t)).length
  return common / Math.max(ta.size, tb.length) >= 0.5 ? 1 : 0
}

// ---------- Tier 2: countries ----------
log('tier 2: identifying countries on Wikidata')
const pages = await wikipediaPages(countries.map((c) => c.name.common))
let qidCandidates = countries.map((c) => pages.get(c.name.common)?.qid).filter(Boolean)
let ents = await wikidataEntities(qidCandidates, 'claims|labels|aliases|sitelinks')
const countryQid = new Map()
for (const c of countries) {
  const q = pages.get(c.name.common)?.qid
  const e = q && ents.get(q)
  const iso2 = claims(e, 'P297')[0]?.mainsnak?.datavalue?.value
  if (e && iso2 === c.cca2) countryQid.set(c.cca3, q)
}
const missing = countries.filter((c) => !countryQid.has(c.cca3))
for (const c of missing) {
  const hits = await wikidataSearchStatement(`P297=${c.cca2}`)
  if (hits[0]) countryQid.set(c.cca3, hits[0])
}
log(`  ${countryQid.size}/${countries.length} countries identified (${missing.length} needed ISO search)`)

// predecessors, two steps back
const predOf = new Map()
let frontier = [...countryQid.values()]
const allPred = new Set()
for (let depth = 0; depth < 2; depth++) {
  const es = await wikidataEntities(frontier, 'claims|labels|aliases|sitelinks')
  for (const [q, e] of es) ents.set(q, e)
  const next = []
  for (const q of frontier) {
    const e = ents.get(q)
    const p = [...new Set([...ids(e, 'P1365'), ...ids(e, 'P155')])]
    predOf.set(q, p)
    for (const x of p) if (!allPred.has(x) && !ents.has(x)) { allPred.add(x); next.push(x) }
  }
  frontier = next
}
const predEnts = await wikidataEntities([...allPred], 'claims|labels|aliases|sitelinks')
for (const [q, e] of predEnts) ents.set(q, e)

// ---------- Tier 3: candidates for remaining polygon names ----------
const countryNames = new Set()
for (const c of countries) {
  if (!countryQid.has(c.cca3)) continue
  for (const n of [c.name.common, c.name.official, ...(c.altSpellings ?? []).filter((s) => s.length > 3)]) countryNames.add(n)
}
const pending = [...nameInfo.keys()].filter((n) => !curatedNames.has(n) && !countryNames.has(n))
log(`tier 3: ${pending.length} names to match`)

const candTitles = new Map() // name -> [{title, override}]
for (const n of pending) {
  if (n in nameMap) {
    candTitles.set(n, nameMap[n] ? [{ title: nameMap[n], override: true }] : [])
    continue
  }
  const clean = n.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  candTitles.set(n, [clean, `${clean} people`, `${clean} (people)`, `Kingdom of ${clean}`, `${clean} culture`].map((title) => ({ title })))
}
const exact = await wikipediaPages([...candTitles.values()].flat().map((c) => c.title))
let done = 0
await Promise.all(
  pending
    .filter((n) => !(n in nameMap))
    .map(async (n) => {
      const titles = await wikipediaSearch(n.replace(/\s*\(.*?\)\s*/g, ' '), 3)
      candTitles.get(n).push(...titles.map((title) => ({ title, searched: true })))
      if (++done % 300 === 0) log(`  searched ${done}`)
    }),
)
const searchedPages = await wikipediaPages([...candTitles.values()].flat().filter((c) => c.searched).map((c) => c.title))
const pageFor = (t) => exact.get(t) ?? searchedPages.get(t)

const t3Qids = new Set()
for (const list of candTitles.values()) for (const c of list) { const p = pageFor(c.title); if (p?.qid) t3Qids.add(p.qid) }
const t3Ents = await wikidataEntities([...t3Qids].filter((q) => !ents.has(q)), 'claims|labels|aliases|sitelinks')
for (const [q, e] of t3Ents) ents.set(q, e)

// labels for every referenced item: classes, capitals, governments, languages, heads of state
const refs = new Set()
for (const e of ents.values()) for (const p of ['P31', 'P36', 'P122', 'P37', 'P35']) for (const v of ids(e, p)) refs.add(v)
const labels = await wikidataLabels([...refs])
const L = (q) => labels.get(q) ?? null

function lifeOf(e) {
  const inc = [...claimYears(e, 'P571'), ...claimYears(e, 'P580')]
  const dis = [...claimYears(e, 'P576'), ...claimYears(e, 'P582')]
  const from = inc.length ? inc.reduce((a, b) => (a.year < b.year ? a : b)) : null
  const to = dis.length ? dis.reduce((a, b) => (a.year > b.year ? a : b)) : null
  return { from, to, latest: inc.length ? Math.max(...inc.map((x) => x.year)) : null }
}

const decisions = []
const t3Choice = new Map()
for (const n of pending) {
  const info = nameInfo.get(n)
  const lo = Math.min(...info.years)
  const hi = nextSnapshot(Math.max(...info.years))
  let best = null
  for (const c of candTitles.get(n)) {
    const p = pageFor(c.title)
    if (!p || p.disambiguation || !p.qid) continue
    const e = ents.get(p.qid)
    if (!e) continue
    const cls = ids(e, 'P31').map(L).filter(Boolean)
    const reasons = []
    let score = 0
    if (c.override) score = 10
    else {
      if (cls.some((x) => BAD.test(x)) && !cls.some((x) => GOOD.test(x))) continue
      if (!cls.some((x) => GOOD.test(x))) continue
      const sim = Math.max(similarity(n, p.title), similarity(n, e.labels?.en?.value ?? ''))
      if (!sim) continue
      score += sim
      reasons.push(`sim${sim}`)
      const life = lifeOf(e)
      if (life.from || life.to) {
        const a = life.from?.year ?? -1e9
        const b = life.to?.year ?? NOW
        if (b < lo - 500 || a > hi + 500) continue
        if (b >= lo - 300 && a <= hi + 300) { score += 1; reasons.push('dates') }
      }
      const cc = coord(e)
      if (cc && info.centroid) {
        const km = kmBetween(cc, info.centroid)
        if (km > 4000) continue
        score += km < 1500 ? 2 : 1
        reasons.push(`${Math.round(km)}km`)
      }
      if (c.searched) score -= 0.5
    }
    if (!best || score > best.score) best = { title: p.title, qid: p.qid, score, reasons, page: p }
  }
  if (best && best.score >= 3) {
    t3Choice.set(n, best)
    decisions.push({ name: n, title: best.title, qid: best.qid, score: best.score, why: best.reasons.join(' ') })
  } else decisions.push({ name: n, title: null, reason: n in nameMap ? 'deliberately unmapped' : 'no candidate passed validation' })
}
log(`  matched ${t3Choice.size}/${pending.length}`)

// ---------- entity builders ----------
const enTitle = (e) => e?.sitelinks?.enwiki?.title
const spanList = (e, p, from, to, map = L) =>
  qualified(e, p)
    .map((x) => [x.from ?? from, x.to ?? to, map(x.id), x.from == null ? 'estimated' : 'documented'])
    .filter((s) => s[2] && s[0] < s[1])

function buildEntity({ id, e, name, match, from, to, conf, kind, tier, iso3, summary, wiki, modernFrom, datesFromMap }) {
  const factFrom = modernFrom ?? from
  const capitals = spanList(e, 'P36', factFrom, to)
  const gov = (() => {
    const list = spanList(e, 'P122', factFrom, to)
    // collapse simultaneous unqualified forms into one line
    const un = list.filter((s) => s[3] === 'estimated').map((s) => s[2])
    const q = list.filter((s) => s[3] !== 'estimated')
    return un.length ? [...q, [factFrom, to, un.join(', '), 'documented']] : q
  })()
  const rulers = qualified(e, 'P35').filter((x) => x.from != null).map((x) => [x.from, x.to ?? (iso3 ? NOW + 1 : to), L(x.id), 'documented']).filter((s) => s[2])
  const langs = ids(e, 'P37').map(L).filter(Boolean)
  return {
    id, name, kind, region: 'auto', from, to, conf, tier,
    ...(iso3 ? { iso3, modernFrom: modernFrom ?? from } : {}),
    qid: e?.id,
    wiki,
    summary,
    names: [], capitals, gov, rulers, religion: [], langs: [], pop: [], events: [], facts: [],
    langNames: langs.length ? [[factFrom, to, langs]] : [],
    match,
    sources: [wiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki.replaceAll(' ', '_'))}` : null, e?.id ? `https://www.wikidata.org/wiki/${e.id}` : null].filter(Boolean),
    ...(datesFromMap ? { datesFromMap: true } : {}),
  }
}

// summaries for everything we will emit
const wantTitles = new Set()
for (const q of [...countryQid.values(), ...allPred]) { const t = enTitle(ents.get(q)); if (t) wantTitles.add(t) }
const summaries = await wikipediaPages([...wantTitles])
const summaryOf = (t) => (t ? (summaries.get(t) ?? pageFor(t))?.extract : undefined)

const out = []
const lineages = {}
const isPolity = (e) => ids(e, 'P31').map(L).some((x) => x && GOOD.test(x) && !/ethnic|people/i.test(x))

for (const c of countries) {
  const q = countryQid.get(c.cca3)
  const e = ents.get(q)
  if (!e) continue
  const life = lifeOf(e)
  const from = life.from?.year ?? 1945
  const modernFrom = Math.max(life.latest ?? from, from)
  const wiki = enTitle(e)
  const match = [...new Set([c.name.common, c.name.official, e.labels?.en?.value, ...(e.aliases?.en ?? []).map((a) => a.value), ...(c.altSpellings ?? []).filter((s) => s.length > 3)].filter(Boolean))]
  out.push(buildEntity({ id: `c-${c.cca3.toLowerCase()}`, e, name: c.name.common, match, from, to: NOW + 1, conf: life.from?.approx ? 'estimated' : 'documented', kind: 'country', tier: 2, iso3: c.cca3, summary: summaryOf(wiki), wiki, modernFrom }))

  // automated lineage from Wikidata predecessors (spans are never "override")
  const spans = []
  const seen = new Set()
  const walk = (qq, depth) => {
    for (const pq of predOf.get(qq) ?? []) {
      if (seen.has(pq)) continue
      seen.add(pq)
      const pe = ents.get(pq)
      if (!pe || !isPolity(pe)) continue
      const pl = lifeOf(pe)
      if (!pl.from || !pl.to || pl.to.year <= pl.from.year || pl.from.year > modernFrom) continue
      const pid = `w-${pq.toLowerCase()}`
      if (!out.some((x) => x.id === pid)) {
        const pw = enTitle(pe)
        out.push(buildEntity({ id: pid, e: pe, name: pe.labels?.en?.value ?? pq, match: [pe.labels?.en?.value, ...(pe.aliases?.en ?? []).map((a) => a.value)].filter(Boolean), from: pl.from.year, to: pl.to.year, conf: pl.from.approx || pl.to.approx ? 'estimated' : 'documented', kind: kindFrom(ids(pe, 'P31').map(L).filter(Boolean)), tier: 2, summary: summaryOf(pw), wiki: pw }))
      }
      spans.push([pl.from.year, Math.min(pl.to.year, modernFrom), pid, false])
      if (depth < 1) walk(pq, depth + 1)
    }
  }
  walk(q, 0)
  spans.push([modernFrom, NOW + 1, `c-${c.cca3.toLowerCase()}`, false])
  spans.sort((a, b) => a[0] - b[0])
  lineages[c.cca3] = { name: c.name.common, spans, auto: true }
}

for (const [n, best] of t3Choice) {
  const e = ents.get(best.qid)
  const info = nameInfo.get(n)
  const life = lifeOf(e)
  const mapFrom = Math.min(...info.years)
  const mapTo = nextSnapshot(Math.max(...info.years))
  const cls = ids(e, 'P31').map(L).filter(Boolean)
  const id = `w-${best.qid.toLowerCase()}`
  const existing = out.find((x) => x.id === id)
  if (existing) {
    if (!existing.match.includes(n)) existing.match.push(n)
    continue
  }
  const hasDates = life.from && life.to && life.to.year > life.from.year
  out.push(
    buildEntity({
      id, e, name: n, match: [n],
      from: hasDates ? life.from.year : mapFrom,
      to: hasDates ? life.to.year : mapTo,
      conf: hasDates && !life.from.approx && !life.to.approx ? 'documented' : 'estimated',
      kind: kindFrom(cls), tier: 3,
      summary: best.page.extract, wiki: best.title,
      datesFromMap: !hasDates,
    }),
  )
}

// ---------- write ----------
await fs.writeFile(path.join(root, 'public/data/entities-auto.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), entities: out, lineages }))
await fs.writeFile(path.join(root, 'scripts/reports/tier3-decisions.json'), JSON.stringify(decisions, null, 1))
const stillUnmatched = decisions.filter((d) => !d.title).map((d) => ({ name: d.name, reason: d.reason, snapshots: nameInfo.get(d.name).years.length })).sort((a, b) => b.snapshots - a.snapshots)
await fs.writeFile(path.join(root, 'scripts/reports/unmatched-basemap-names.json'), JSON.stringify(stillUnmatched, null, 1))
const size = (await fs.stat(path.join(root, 'public/data/entities-auto.json'))).size
log(`wrote ${out.length} automated entities (${out.filter((x) => x.tier === 2).length} tier 2, ${out.filter((x) => x.tier === 3).length} tier 3), ${Object.keys(lineages).length} lineages, ${(size / 1024).toFixed(0)} KB`)
log(`still unmatched: ${stillUnmatched.length} names (${stillUnmatched.filter((x) => x.snapshots >= 3).length} appear in 3+ snapshots)`)
