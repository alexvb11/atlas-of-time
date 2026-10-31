// City populations through time, as recorded on Wikidata (P1082 population with a P585 date,
// mostly censuses and official estimates). Major cities only (covered in at least MIN_SITELINKS
// Wikipedias). A city is drawn only between its first and last recorded figure and its size is
// interpolated between recorded figures, never extrapolated. Figures follow whatever definition the
// source used (city proper, municipality), so the UI calls them "recorded population".
//
// Output: public/data/cities.json  { cities: [[name, lon, lat, [[t, pop], ...]], ...] }
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sparql, sparqlYear } from './lib/wiki.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MIN_SITELINKS = 70
const MIN_POINTS = 4

const rows = await sparql(`
SELECT ?c ?title ?coord ?pop ?date WHERE {
  VALUES ?cls { wd:Q515 wd:Q1549591 wd:Q1637706 wd:Q5119 wd:Q200250 }
  ?c wdt:P31 ?cls ; wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_SITELINKS})
  ?c wdt:P625 ?coord .
  ?c p:P1082 ?st . ?st ps:P1082 ?pop ; pq:P585 ?date .
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  ?art schema:about ?c ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
}`)

const cities = new Map()
for (const r of rows) {
  const id = r.c.value
  const m = r.coord.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/)
  const y = sparqlYear(r.date.value)
  const pop = Number(r.pop.value)
  if (!m || y == null || !(pop > 0) || y > 2026) continue
  const c = cities.get(id) ?? { name: r.title.value, lon: Number(m[1]), lat: Number(m[2]), series: new Map() }
  // one figure per year (several sources for one year: keep the largest consistent one, the median)
  const list = c.series.get(y) ?? []
  list.push(pop)
  c.series.set(y, list)
  cities.set(id, c)
}

const out = []
for (const c of cities.values()) {
  const pts = [...c.series].map(([y, l]) => [y, l.sort((a, b) => a - b)[Math.floor(l.length / 2)]]).sort((a, b) => a[0] - b[0])
  if (pts.length < MIN_POINTS) continue
  // a single figure far out of line with its neighbours (a unit error, a metro figure among city
  // figures) would make the dot pulse; drop points more than 5× off both neighbours
  const clean = pts.filter(([, p], i) => {
    const a = pts[i - 1]?.[1]
    const b = pts[i + 1]?.[1]
    if (!a || !b) return true
    return !((p > 5 * a && p > 5 * b) || (p < a / 5 && p < b / 5))
  })
  out.push([c.name, Number(c.lon.toFixed(3)), Number(c.lat.toFixed(3)), clean])
}
out.sort((a, b) => a[0].localeCompare(b[0]))
await fs.writeFile(path.join(root, 'public/data/cities.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), cities: out }))
const first = Math.min(...out.map((c) => c[3][0][0]))
console.log(`cities: ${out.length} with ${out.reduce((a, c) => a + c[3].length, 0)} recorded figures, earliest ${first}`)
