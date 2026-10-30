// Dated events for every present-day country, from Wikidata.
//
// For each of the 250 countries: wars, battles, sieges, treaties, revolutions, coups, rebellions,
// independence declarations, assassinations, massacres, genocides, famines, epidemics, earthquakes
// and eruptions whose Wikidata "country" (P17) is that country, that have an English Wikipedia
// article and a dated start (P585 point in time or P580 start time, at least year precision).
// The most widely covered (by number of Wikipedia language editions) are kept, up to 16 per
// country. Titles are the article titles, word for word: nothing is paraphrased, so nothing is
// invented. Events already curated by hand are skipped.
//
// Output: public/data/events-auto.json  { [entityId]: [[t, title], ...] } and the event -> article
// entries that articles.mjs merges. Report: scripts/reports/country-events.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sparql, sparqlYear, getJSON } from './lib/wiki.mjs'
import { eventArticles } from './curated/event-articles.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = async (f) => JSON.parse(await fs.readFile(path.join(root, f), 'utf8'))
const curated = await read('public/data/entities.json')
const auto = await read('public/data/entities-auto.json')
const PER_COUNTRY = 16
const MIN_SITELINKS = 6
const NOW = 2026

// classes of event (instance of, or of a direct subclass)
const CLASSES = {
  Q178561: 'battle', Q198: 'war', Q8465: 'civil war', Q188055: 'siege', Q131569: 'treaty', Q625298: 'peace treaty',
  Q10931: 'revolution', Q45382: 'coup', Q124734: 'rebellion', Q3882219: 'assassination', Q3199915: 'massacre',
  Q41397: 'genocide', Q168247: 'famine', Q44512: 'epidemic', Q7944: 'earthquake', Q7692360: 'eruption',
  Q467011: 'invasion', Q1464916: 'declaration of independence',
}

// one entity per country receives its events: the hand-curated modern state, else the automated one
const curatedByIso = new Map(curated.entities.filter((e) => e.iso3).map((e) => [e.iso3, e.id]))
const countries = auto.entities.filter((e) => e.tier === 2 && e.iso3 && e.qid && e.id.startsWith('c-'))
const target = (c) => curatedByIso.get(c.iso3) ?? c.id

// articles already used by curated events, per country, so the same event is not listed twice
const curatedTitles = new Set(Object.values(eventArticles).map((t) => t.split('#')[0]))

const byCountry = new Map()
const countryValues = countries.map((c) => `wd:${c.qid}`).join(' ')
// direct subclasses too (naval battle, military coup, world war…), fetched once
const subRows = await sparql(`SELECT ?sub ?cls WHERE { VALUES ?cls { ${Object.keys(CLASSES).map((q) => `wd:${q}`).join(' ')} } ?sub wdt:P279 ?cls }`)
const subsOf = new Map(Object.keys(CLASSES).map((q) => [q, [q]]))
for (const r of subRows) subsOf.get(r.cls.value.split('/').pop())?.push(r.sub.value.split('/').pop())
// step 1, one light query per class: which items, in which country, how widely covered
const countryOf = new Map(countries.map((c) => [c.qid, c]))
const candidates = new Map() // item -> { sl, countries: Set }
for (const [cls, types] of subsOf) {
  for (let i = 0; i < types.length; i += 80) {
    const rows = await sparql(`
SELECT ?e ?country ?sl WHERE {
  VALUES ?t { ${types.slice(i, i + 80).map((q) => `wd:${q}`).join(' ')} }
  ?e wdt:P31 ?t ; wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_SITELINKS})
  ?e wdt:P17 ?country .
}`)
    for (const r of rows) {
      const q = r.country.value.split('/').pop()
      if (!countryOf.has(q)) continue
      const id = r.e.value.split('/').pop()
      const c = candidates.get(id) ?? { sl: Number(r.sl.value), countries: new Set() }
      c.countries.add(q)
      candidates.set(id, c)
    }
  }
  process.stdout.write(`${CLASSES[cls]} `)
}
console.log(`\n${candidates.size} candidate events`)

// step 2: dates (with their precision) and English article titles, in batches of items
const ids = [...candidates.keys()]
for (let i = 0; i < ids.length; i += 250) {
  const rows = await sparql(`
SELECT ?e ?title ?date ?prec WHERE {
  VALUES ?e { ${ids.slice(i, i + 250).map((q) => `wd:${q}`).join(' ')} }
  { ?e p:P585/psv:P585 ?v } UNION { ?e p:P580/psv:P580 ?v }
  ?v wikibase:timeValue ?date ; wikibase:timePrecision ?prec . FILTER(?prec >= 9)
  ?art schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
}`)
  for (const r of rows) {
    const id = r.e.value.split('/').pop()
    const y = sparqlYear(r.date.value)
    if (y == null || y > NOW) continue
    // month and day place it within the year when known (precision 10 = month, 11 = day)
    const m = r.date.value.match(/-(\d\d)-(\d\d)T/)
    const prec = Number(r.prec.value)
    const frac = prec >= 10 && m ? (Number(m[1]) - 1) / 12 + (prec >= 11 ? (Number(m[2]) - 1) / 365 : 0) : 0
    const t = y + Math.min(0.99, frac)
    const c = candidates.get(id)
    for (const q of c.countries) {
      const list = byCountry.get(q) ?? new Map()
      const prev = list.get(id)
      // an item can carry several dates (start and point in time): keep the earliest
      if (!prev || t < prev.t) list.set(id, { id, title: r.title.value, t, sl: c.sl })
      byCountry.set(q, list)
    }
  }
  process.stdout.write('.')
}
console.log()

// treaties signed by many states (UN conventions, signed in New York) are not one country's story
const signatories = new Map()
for (let i = 0; i < ids.length; i += 400) {
  const rows = await sparql(`SELECT ?e (COUNT(DISTINCT ?s) AS ?n) WHERE { VALUES ?e { ${ids.slice(i, i + 400).map((q) => `wd:${q}`).join(' ')} } { ?e wdt:P1891 ?s } UNION { ?e wdt:P710 ?s } } GROUP BY ?e`)
  for (const r of rows) signatories.set(r.e.value.split('/').pop(), Number(r.n.value))
}
// UN treaties, human-rights instruments and founding charters of international bodies carry the
// country where they were signed (New York, San Francisco), not a national event
const global = new Set()
for (let i = 0; i < ids.length; i += 400) {
  const rows = await sparql(`SELECT DISTINCT ?e WHERE { VALUES ?e { ${ids.slice(i, i + 400).map((q) => `wd:${q}`).join(' ')} } VALUES ?g { wd:Q1691434 wd:Q1414472 wd:Q116741026 wd:Q484652 } ?e wdt:P31 ?g }`)
  for (const r of rows) global.add(r.e.value.split('/').pop())
}
// events tagged with many countries (pandemics, world wars) say little about any one
const local = (e) => candidates.get(e.id).countries.size <= 3 && (signatories.get(e.id) ?? 0) <= 8 && !global.has(e.id)
const ranked = new Map()
for (const c of countries) {
  const all = [...(byCountry.get(c.qid)?.values() ?? [])].filter((e) => !curatedTitles.has(e.title) && local(e))
  all.sort((a, b) => b.sl - a.sl)
  ranked.set(c.qid, all.slice(0, PER_COUNTRY + 8))
}

// second source: the year must also appear in the article's own lead (Wikidata sometimes carries a
// wrong date, e.g. 1864 for the 1854 Convention of Kanagawa); events that fail are dropped
const lead = new Map()
const titles = [...new Set([...ranked.values()].flat().map((e) => e.title))]
for (let i = 0; i < titles.length; i += 20) {
  const batch = titles.slice(i, i + 20)
  const j = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts&exintro=1&explaintext=1&exlimit=20&titles=${encodeURIComponent(batch.join('|'))}`)
  const alias = new Map()
  for (const n of j.query?.normalized ?? []) alias.set(n.to, n.from)
  for (const r of j.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from)
  for (const p of Object.values(j.query?.pages ?? {})) {
    let k = p.title
    lead.set(k, p.extract ?? '')
    while (alias.has(k)) lead.set((k = alias.get(k)), p.extract ?? '')
  }
  if (i % 400 === 0) process.stdout.write('·')
}
console.log()
const mentions = (text, y) =>
  y > 0
    ? new RegExp(`\\b${y}\\b`).test(text)
    : [y - 1, y, y + 1].some((a) => new RegExp(`\\b${(1 - a).toLocaleString('en-US')}\\s*(BC|BCE)|\\b${1 - a}\\s*(BC|BCE)`).test(text))
const rejected = []

const out = {}
const articles = {}
const report = []
for (const c of countries) {
  const keep = []
  for (const e of ranked.get(c.qid) ?? []) {
    if (keep.length >= PER_COUNTRY) break
    if (mentions(lead.get(e.title) ?? '', Math.floor(e.t))) keep.push(e)
    else rejected.push(`${c.name}: ${Math.floor(e.t)} ${e.title}`)
  }
  keep.sort((a, b) => a.t - b.t)
  if (!keep.length) continue
  const id = target(c)
  out[id] = [...(out[id] ?? []), ...keep.map((e) => [Number(e.t.toFixed(3)), e.title])]
  for (const e of keep) articles[`${id}|${e.title}`] = e.title
  report.push({ country: c.name, entity: id, events: keep.map((e) => `${Math.floor(e.t)} ${e.title} (${e.id})`) })
}
await fs.writeFile(path.join(root, 'public/data/events-auto.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), events: out }))
await fs.writeFile(path.join(root, 'scripts/build-data/generated-event-articles.json'), JSON.stringify(articles, null, 1))
await fs.writeFile(path.join(root, 'scripts/reports/country-events.json'), JSON.stringify({ report, rejectedDateNotInArticle: rejected }, null, 1))
const n = Object.values(out).reduce((a, l) => a + l.length, 0)
console.log(`country events: ${n} across ${Object.keys(out).length} countries; ${rejected.length} dropped because the article does not give that year`)
