// Assembles the entity dataset: curated entities + languages + lineages, enriched at build time
// with Wikipedia summaries and Wikidata QIDs (REST summary endpoint returns `wikibase_item`).
// Also writes a report of historical-basemaps polygon names that no entity matches yet.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { languages } from './curated/languages.mjs'
import * as caucasus from './curated/caucasus.mjs'
import * as med from './curated/mediterranean.mjs'
import * as china from './curated/china.mjs'
import * as ab from './curated/americas-britain.mjs'
import { events, routes } from './curated/events.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cacheDir = path.join(root, 'scripts/.cache/wiki')
await fs.mkdir(cacheDir, { recursive: true })
await fs.mkdir(path.join(root, 'scripts/reports'), { recursive: true })
const UA = { 'User-Agent': 'AtlasOfTime/0.1 (build-time data script)' }

const modules = [caucasus, med, china, ab]
const entities = modules.flatMap((m) => m.entities)
const lineages = Object.assign({}, ...modules.map((m) => m.lineages))

// ---- validation ----
const errors = []
const langIds = new Set(languages.map((l) => l.id))
const ids = new Set()
for (const e of entities) {
  if (ids.has(e.id)) errors.push(`duplicate entity ${e.id}`)
  ids.add(e.id)
  if (!(e.from < e.to)) errors.push(`${e.id}: from >= to`)
  for (const [, , list] of e.langs) for (const [l] of list) if (!langIds.has(l)) errors.push(`${e.id}: unknown language ${l}`)
  for (const key of ['capitals', 'gov', 'rulers', 'religion', 'names'])
    for (const s of e[key]) if (!(s[0] <= s[1])) errors.push(`${e.id}.${key}: bad span ${s}`)
}
for (const [iso, l] of Object.entries(lineages))
  for (const s of [...l.spans, ...(l.related ?? [])]) if (!ids.has(s[2])) errors.push(`lineage ${iso}: unknown entity ${s[2]}`)
for (const ev of events) for (const id of ev.entities ?? []) if (!ids.has(id)) errors.push(`event ${ev.id}: unknown entity ${id}`)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

// ---- Wikipedia enrichment ----
async function summary(title) {
  const file = path.join(cacheDir, `${encodeURIComponent(title)}.json`)
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {}
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}?redirect=true`
  let r
  for (let attempt = 0; attempt < 6; attempt++) {
    r = await fetch(url, { headers: UA })
    if (r.status !== 429) break
    await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)))
  }
  if (!r.ok) {
    console.warn(`  wiki ${title}: HTTP ${r.status}`)
    return null
  }
  const j = await r.json()
  const keep = { title: j.title, extract: j.extract, qid: j.wikibase_item, url: j.content_urls?.desktop?.page, type: j.type }
  await fs.writeFile(file, JSON.stringify(keep))
  await new Promise((res) => setTimeout(res, 600))
  return keep
}

for (const e of entities) {
  if (!e.wiki) continue
  const s = await summary(e.wiki)
  if (!s || s.type === 'disambiguation') {
    console.warn(`  no usable summary for ${e.id} (${e.wiki})`)
    continue
  }
  e.qid = s.qid
  e.summary = s.extract
  e.sources = [...new Set([...(e.sources ?? []), s.url])]
}

// ---- unmatched basemap names (Tier 3 work list) ----
const names = JSON.parse(await fs.readFile(path.join(root, 'scripts/.cache/history-names.json'), 'utf8'))
const matched = new Set(entities.flatMap((e) => e.match))
const unmatched = Object.entries(names)
  .filter(([n]) => !matched.has(n))
  .map(([name, years]) => ({ name, snapshots: years.length, first: Math.min(...years), last: Math.max(...years) }))
  .sort((a, b) => b.snapshots - a.snapshots)
await fs.writeFile(path.join(root, 'scripts/reports/unmatched-basemap-names.json'), JSON.stringify(unmatched, null, 1))

await fs.writeFile(
  path.join(root, 'public/data/entities.json'),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), languages, entities, lineages, events: [...events].sort((a, b) => a.t - b.t), routes }),
)
console.log(`${entities.length} entities, ${languages.length} languages, ${Object.keys(lineages).length} lineages; ${unmatched.length}/${Object.keys(names).length} basemap names unmatched (see scripts/reports)`)
