// Every dated event Wikidata places at a point, for "what happened here, then?".
//
// Battles, sieges, wars, treaties, revolutions, coups, rebellions, assassinations, massacres,
// genocides, famines, epidemics, earthquakes, eruptions, invasions, declarations of independence,
// shipwrecks, fires, floods, terrorist attacks and expeditions: instances of these (or of a direct
// subclass) that carry coordinates (P625), a date of at least year precision (P585 point in time or
// P580 start time) and an English Wikipedia article, covered in at least MIN_SITELINKS languages.
// Titles are the article titles word for word. The browser confirms each year against the
// article's own lead before showing it (src/data/places.ts), so a wrong Wikidata date is not shown.
//
// Output: public/data/place-events.json  { kinds: [...], events: [[lon, lat, t, title, kind], ...] }
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sparql, sparqlYear } from './lib/wiki.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MIN_SITELINKS = 3
const NOW = 2026

const CLASSES = {
  Q178561: 'battle', Q188055: 'siege', Q198: 'war', Q131569: 'treaty', Q10931: 'revolution', Q45382: 'coup',
  Q124734: 'rebellion', Q3882219: 'assassination', Q3199915: 'massacre', Q41397: 'genocide', Q168247: 'famine',
  Q44512: 'epidemic', Q7944: 'earthquake', Q7692360: 'eruption', Q467011: 'invasion', Q1464916: 'declaration',
  Q906512: 'shipwreck', Q3196: 'fire', Q8068: 'flood', Q2223653: 'terrorist attack', Q2401485: 'expedition',
  Q8065: 'disaster',
}
const kinds = [...new Set(Object.values(CLASSES))]

// check the class ids say what we think they say before using them
const labels = await sparql(`SELECT ?c ?l WHERE { VALUES ?c { ${Object.keys(CLASSES).map((q) => `wd:${q}`).join(' ')} } ?c rdfs:label ?l FILTER(lang(?l) = 'en') }`)
console.log(labels.map((r) => `${r.c.value.split('/').pop()}=${r.l.value}`).join(', '))

const subRows = await sparql(`SELECT ?sub ?cls WHERE { VALUES ?cls { ${Object.keys(CLASSES).map((q) => `wd:${q}`).join(' ')} } ?sub wdt:P279 ?cls }`)
const subsOf = new Map(Object.keys(CLASSES).map((q) => [q, [q]]))
for (const r of subRows) subsOf.get(r.cls.value.split('/').pop())?.push(r.sub.value.split('/').pop())

// step 1: items with coordinates, per class
const items = new Map() // id -> { kind, lon, lat }
for (const [cls, types] of subsOf) {
  for (let i = 0; i < types.length; i += 80) {
    const rows = await sparql(`
SELECT ?e ?coord WHERE {
  VALUES ?t { ${types.slice(i, i + 80).map((q) => `wd:${q}`).join(' ')} }
  ?e wdt:P31 ?t ; wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_SITELINKS})
  ?e wdt:P625 ?coord .
}`)
    for (const r of rows) {
      const id = r.e.value.split('/').pop()
      const m = r.coord.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/)
      if (!m || items.has(id)) continue
      // coordinates on other bodies (the Moon, Mars) carry a globe IRI and are not this Earth
      if (r.coord.datatype && !/geosparql#wktLiteral/.test(r.coord.datatype)) continue
      if (r.coord.value.startsWith('<')) continue
      items.set(id, { kind: CLASSES[cls], lon: Number(m[1]), lat: Number(m[2]) })
    }
  }
  process.stdout.write(`${CLASSES[cls]} `)
}
console.log(`\n${items.size} located events`)

// step 2: dates with precision, and English titles
const ids = [...items.keys()]
const out = []
for (let i = 0; i < ids.length; i += 250) {
  const rows = await sparql(`
SELECT ?e ?title ?date ?prec WHERE {
  VALUES ?e { ${ids.slice(i, i + 250).map((q) => `wd:${q}`).join(' ')} }
  { ?e p:P585/psv:P585 ?v } UNION { ?e p:P580/psv:P580 ?v }
  ?v wikibase:timeValue ?date ; wikibase:timePrecision ?prec . FILTER(?prec >= 9)
  ?art schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
}`)
  const best = new Map()
  for (const r of rows) {
    const id = r.e.value.split('/').pop()
    const y = sparqlYear(r.date.value)
    if (y == null || y > NOW) continue
    const m = r.date.value.match(/-(\d\d)-(\d\d)T/)
    const prec = Number(r.prec.value)
    const t = y + Math.min(0.99, prec >= 10 && m ? (Number(m[1]) - 1) / 12 + (prec >= 11 ? (Number(m[2]) - 1) / 365 : 0) : 0)
    const prev = best.get(id)
    if (!prev || t < prev.t) best.set(id, { t, title: r.title.value })
  }
  for (const [id, { t, title }] of best) {
    const it = items.get(id)
    out.push([Number(it.lon.toFixed(3)), Number(it.lat.toFixed(3)), Number(t.toFixed(3)), title, kinds.indexOf(it.kind)])
  }
  if ((i / 250) % 10 === 0) process.stdout.write('.')
}
console.log()
// sorted by time, so the browser can binary-search a window
out.sort((a, b) => a[2] - b[2])
await fs.writeFile(path.join(root, 'public/data/place-events.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), kinds, events: out }))
const size = (await fs.stat(path.join(root, 'public/data/place-events.json'))).size
console.log(`place events: ${out.length}, ${(size / 1024).toFixed(0)} KB`)
