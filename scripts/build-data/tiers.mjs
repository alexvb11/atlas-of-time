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
// Output: public/data/entities-auto.json and entities-auto-text.json, reports in scripts/reports/.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  wikipediaPages,
  sparql,
  sparqlYear,
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

// Candidate strings per name. No free-text search: Wikimedia rate-limits anonymous clients, and
// exact label/alias matches validated by class, dates and place are more trustworthy anyway.
const variants = new Map() // name -> [{label} | {title, override}]
for (const n of pending) {
  if (n in nameMap) {
    variants.set(n, nameMap[n] ? [{ title: nameMap[n], override: true }] : [])
    continue
  }
  const clean = n.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  variants.set(n, [...new Set([n, clean, `${clean} people`, `${clean} culture`, `Kingdom of ${clean}`, `${clean} Empire`, `${clean} Sultanate`])].map((label) => ({ label })))
}
const lit = (x) => JSON.stringify(x) + '@en'
const SELECT = `?item ?article (GROUP_CONCAT(DISTINCT ?clsLabel; separator="|") AS ?classes) (MIN(?inc) AS ?from) (MAX(?dis) AS ?to) (SAMPLE(?coord) AS ?c)`
const TAIL = `
  OPTIONAL { ?item wdt:P31 ?cls . ?cls rdfs:label ?clsLabel . FILTER(LANG(?clsLabel) = "en") }
  OPTIONAL { ?item wdt:P571|wdt:P580 ?inc }
  OPTIONAL { ?item wdt:P576|wdt:P582 ?dis }
  OPTIONAL { ?item wdt:P625 ?coord }`
const hits = new Map() // label or title -> [{qid, title, classes, from, to, coord}]
const addHit = (key, row) => {
  const rec = {
    qid: row.item.value.split('/').pop(),
    title: decodeURIComponent(row.article.value.split('/wiki/')[1]).replaceAll('_', ' '),
    classes: (row.classes?.value ?? '').split('|').filter(Boolean),
    from: sparqlYear(row.from?.value),
    to: sparqlYear(row.to?.value),
    coord: row.c?.value ? row.c.value.match(/Point\((-?[\d.]+) (-?[\d.]+)\)/)?.slice(1, 3).map(Number) : null,
  }
  if (!hits.has(key)) hits.set(key, [])
  if (!hits.get(key).some((h) => h.qid === rec.qid)) hits.get(key).push(rec)
}
const labelsWanted = [...new Set([...variants.values()].flat().filter((v) => v.label).map((v) => v.label))]
for (let i = 0; i < labelsWanted.length; i += 150) {
  const batch = labelsWanted.slice(i, i + 150)
  const rows = await sparql(`SELECT ?name ${SELECT} WHERE {
  VALUES ?name { ${batch.map(lit).join(' ')} }
  { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .${TAIL}
} GROUP BY ?name ?item ?article`)
  for (const r of rows) addHit(r.name.value, r)
  if ((i / 150) % 10 === 0) log(`  label queries ${i + batch.length}/${labelsWanted.length}`)
}
const titlesWanted = [...new Set([...variants.values()].flat().filter((v) => v.title).map((v) => v.title))]
for (let i = 0; i < titlesWanted.length; i += 150) {
  const batch = titlesWanted.slice(i, i + 150)
  const rows = await sparql(`SELECT ?title ${SELECT} WHERE {
  VALUES ?title { ${batch.map(lit).join(' ')} }
  ?article schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?item .${TAIL}
} GROUP BY ?title ?item ?article`)
  for (const r of rows) addHit(r.title.value, r)
}
log(`  ${hits.size} candidate strings matched Wikidata items`)

const decisions = []
const t3Choice = new Map()
for (const n of pending) {
  const info = nameInfo.get(n)
  const lo = Math.min(...info.years)
  const hi = nextSnapshot(Math.max(...info.years))
  let best = null
  for (const v of variants.get(n)) {
    for (const h of hits.get(v.label ?? v.title) ?? []) {
      const reasons = []
      let score = 0
      if (v.override) {
        if (h.classes.some((x) => /disambiguation/i.test(x))) continue
        score = 10
      }
      else {
        // places (cities, regions, counties as administrative units) are never polities here
        const PLACE = /\b(city|town|village|municipality|comune|commune|settlement|county seat|capital|neighbourhood|district|region|landscape|state of the United States|U\.S\. state|province of|state of India|state of the German)\b/i
        const STRONG = /\b(historical country|historical state|country|sovereign state|kingdom|empire|sultanate|khanate|caliphate|emirate|duchy|principality|colony|protectorate|confederation|people|ethnic group|tribe|indigenous|archaeological culture|civilization|horde|chiefdom|city-state)\b/i
        const good = h.classes.filter((x) => GOOD.test(x) && !PLACE.test(x))
        if (!good.length) continue
        // overview articles about a place are not the polity itself
        if (/^(culture|history|geography|demographics|economy|politics) of /i.test(h.title)) continue
        // "Algeria (France)" is a colony, not today's sovereign state
        if (/\(.+\)/.test(n) && h.classes.some((x) => /sovereign state|^country$/i.test(x))) continue
        if (h.classes.some((x) => BAD.test(x) || PLACE.test(x)) && !h.classes.some((x) => STRONG.test(x) && !PLACE.test(x))) continue
        const sim = Math.max(similarity(n, h.title), v.label === n ? 3 : 2)
        score += sim
        reasons.push(`label:${v.label}`)
        if (h.from != null || h.to != null) {
          // the item must exist during (or very close to) the snapshots that use the name
          const a = h.from ?? -1e9
          const b = h.to ?? NOW
          if (a > hi + 50 || b < lo - 150) continue
          if (a <= hi && b >= lo) { score += 1; reasons.push('dates') }
        }
        if (h.coord && info.centroid) {
          const km = kmBetween(h.coord, info.centroid)
          if (km > 4000) continue
          score += km < 1500 ? 2 : 1
          reasons.push(`${Math.round(km)}km`)
        }
        // an exact name with no corroboration is only accepted for peoples/cultures, not states
        if (score < 4 && !h.classes.some((x) => /people|ethnic|tribe|culture|indigenous|nation/i.test(x))) score -= 1
      }
      if (!best || score > best.score) best = { ...h, score, reasons }
    }
  }
  if (best && best.score >= 3) {
    t3Choice.set(n, best)
    decisions.push({ name: n, title: best.title, qid: best.qid, classes: best.classes.slice(0, 3), score: best.score, why: best.reasons.join(' ') })
  } else
    decisions.push({
      name: n,
      title: null,
      reason: n in nameMap ? (nameMap[n] ? `mapped title "${nameMap[n]}" not found on Wikidata` : 'deliberately unmapped') : 'no candidate passed validation',
    })
}
log(`  matched ${t3Choice.size}/${pending.length}`)

// full claims for the chosen items (capitals, government, languages)
const t3Ents = await wikidataEntities([...new Set([...t3Choice.values()].map((c) => c.qid))].filter((q) => !ents.has(q)), 'claims|labels|aliases|sitelinks')
for (const [q, e] of t3Ents) ents.set(q, e)
const t3Pages = await wikipediaPages([...t3Choice.values()].map((c) => c.title))
const pageFor = (t) => t3Pages.get(t)

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

// ---------- entity builders ----------
const enTitle = (e) => e?.sitelinks?.enwiki?.title
const spanList = (e, p, from, to, map = L, life = [-1e9, 1e9]) =>
  qualified(e, p)
    .map((x) => [Math.max(x.from ?? from, life[0]), Math.min(x.to ?? to, life[1]), map(x.id), x.from == null ? 'estimated' : 'documented'])
    .filter((s) => s[2] && s[0] < s[1])

function buildEntity({ id, e, name, match, from, to, conf, kind, tier, iso3, summary, wiki, modernFrom, datesFromMap, factFloor = 0 }) {
  // Unqualified Wikidata statements describe the present. For today's countries, apply them only
  // from 1945 (or the current state's start if later) so e.g. Sweden's "representative democracy"
  // never appears in the year 900. Qualified statements keep their own dates.
  const factFrom = iso3 ? Math.max(modernFrom ?? from, 1945, factFloor) : (modernFrom ?? from)
  const capitals = spanList(e, 'P36', factFrom, to, L, [from, to])
  const gov = (() => {
    const list = spanList(e, 'P122', factFrom, to, L, [from, to])
    // collapse simultaneous unqualified forms into one line
    const un = list.filter((s) => s[3] === 'estimated').map((s) => s[2])
    const q = list.filter((s) => s[3] !== 'estimated')
    return un.length ? [...q, [factFrom, to, un.join(', '), 'documented']] : q
  })()
  const rulers = qualified(e, 'P35').filter((x) => x.from != null && x.from >= from).map((x) => [x.from, Math.min(x.to ?? (iso3 ? NOW + 1 : to), to), L(x.id), 'documented']).filter((s) => s[2] && s[0] < s[1])
  const langs = ids(e, 'P37').map(L).filter(Boolean)
  return {
    id, name, kind, region: 'auto', from, to, conf, tier,
    ...(iso3 ? { iso3, modernFrom: factFrom } : {}),
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
const summaryOf = (t) => (t ? summaries.get(t)?.extract : undefined)

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
      if (!pl.from || !pl.to || pl.to.year - pl.from.year < 3 || pl.from.year > modernFrom) continue
      // predecessors elsewhere on the globe (Wikidata chains sometimes run through the colonial power)
      const pc = coord(pe)
      if (pc && kmBetween(pc, [c.latlng[1], c.latlng[0]]) > 3000) continue
      const pid = `w-${pq.toLowerCase()}`
      if (!out.some((x) => x.id === pid)) {
        const pw = enTitle(pe)
        out.push(buildEntity({ id: pid, e: pe, name: pe.labels?.en?.value ?? pq, match: [pe.labels?.en?.value, ...(pe.aliases?.en ?? []).map((a) => a.value)].filter(Boolean), from: pl.from.year, to: pl.to.year, conf: pl.from.approx || pl.to.approx ? 'estimated' : 'documented', kind: kindFrom(ids(pe, 'P31').map(L).filter(Boolean)), tier: 2, summary: summaryOf(pw), wiki: pw }))
      }
      spans.push([pl.from.year, pl.to.year, pid, false])
      if (depth < 1) walk(pq, depth + 1)
    }
  }
  walk(q, 0)
  // the country entity itself; its unqualified facts start after its last predecessor ends
  out.push(buildEntity({ id: `c-${c.cca3.toLowerCase()}`, e, name: c.name.common, match, from, to: NOW + 1, conf: life.from?.approx ? 'estimated' : 'documented', kind: 'country', tier: 2, iso3: c.cca3, summary: summaryOf(wiki), wiki, modernFrom, factFloor: Math.max(0, ...spans.map((x) => x[1]).filter((y) => y <= NOW)) }))
  spans.push([modernFrom, NOW + 1, `c-${c.cca3.toLowerCase()}`, false])
  // predecessors before the country itself when they overlap, so they win in lineage lookup
  spans.sort((a, b) => a[0] - b[0] || (a[2].startsWith('c-') ? 1 : -1))
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
      summary: pageFor(best.title)?.extract, wiki: best.title,
      datesFromMap: !hasDates,
    }),
  )
}

// ---------- write ----------
// Summaries and source links are only read by the panel, and are half the bytes: they go in a
// separate file the app loads on demand, so the index needed for hover and selection stays small.
const text = {}
const index = out.map(({ summary, sources, ...e }) => {
  text[e.id] = [summary ?? null, sources]
  return e
})
await fs.writeFile(path.join(root, 'public/data/entities-auto.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), entities: index, lineages }))
await fs.writeFile(path.join(root, 'public/data/entities-auto-text.json'), JSON.stringify(text))
await fs.writeFile(path.join(root, 'scripts/reports/tier3-decisions.json'), JSON.stringify(decisions, null, 1))
const stillUnmatched = decisions.filter((d) => !d.title).map((d) => ({ name: d.name, reason: d.reason, snapshots: nameInfo.get(d.name).years.length })).sort((a, b) => b.snapshots - a.snapshots)
await fs.writeFile(path.join(root, 'scripts/reports/unmatched-basemap-names.json'), JSON.stringify(stillUnmatched, null, 1))
const size = (await fs.stat(path.join(root, 'public/data/entities-auto.json'))).size
const textSize = (await fs.stat(path.join(root, 'public/data/entities-auto-text.json'))).size
log(`wrote ${out.length} automated entities (${out.filter((x) => x.tier === 2).length} tier 2, ${out.filter((x) => x.tier === 3).length} tier 3), ${Object.keys(lineages).length} lineages, ${(size / 1024).toFixed(0)} KB + ${(textSize / 1024).toFixed(0)} KB text`)
log(`still unmatched: ${stillUnmatched.length} names (${stillUnmatched.filter((x) => x.snapshots >= 3).length} appear in 3+ snapshots)`)
