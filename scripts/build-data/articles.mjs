// Event -> Wikipedia article index for the in-app reader.
//
// Every hand-picked title in curated/event-articles.mjs (and every curated entity's own `wiki`
// title) is checked against Wikipedia: it must exist and must not be a disambiguation page.
// Redirects resolve to the canonical title. The article text, its links and the images for the
// hover-card films are fetched by the browser when a reader opens them (src/data/wiki.ts), so any
// link in any article works without a build step.
//
// Output: public/data/articles.json, report in scripts/reports/event-articles.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { wikipediaPages } from './lib/wiki.mjs'
import { eventArticles } from './curated/event-articles.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const curated = JSON.parse(await fs.readFile(path.join(root, 'public/data/entities.json'), 'utf8'))

// every key in the map must name a real event, so a renamed event can't silently lose its article
const known = new Set()
for (const e of curated.entities) for (const [, title] of e.events) known.add(`${e.id}|${title}`)
for (const g of curated.events) known.add(`ev:${g.id}`)
const stale = Object.keys(eventArticles).filter((k) => !known.has(k))
const missingKeys = [...known].filter((k) => !(k in eventArticles))

const base = (t) => t.split('#')[0]
const titles = [...Object.values(eventArticles).map(base), ...curated.entities.map((e) => e.wiki).filter(Boolean)]
const pages = await wikipediaPages(titles)

const events = {}
const entities = {}
const rejected = []
const canonical = (t) => {
  const [b, section] = t.split('#')
  const p = pages.get(b)
  if (!p) return { error: 'missing' }
  if (p.disambiguation) return { error: 'disambiguation' }
  return { title: section ? `${p.title}#${section}` : p.title }
}
for (const [k, t] of Object.entries(eventArticles)) {
  if (!known.has(k)) continue
  const c = canonical(t)
  if (c.error) rejected.push({ key: k, title: t, why: c.error })
  else events[k] = c.title
}
for (const e of curated.entities) {
  if (!e.wiki) continue
  const c = canonical(e.wiki)
  if (c.error) rejected.push({ key: e.id, title: e.wiki, why: c.error })
  else entities[e.id] = c.title
}

await fs.writeFile(path.join(root, 'public/data/articles.json'), JSON.stringify({ events, entities }))
await fs.writeFile(path.join(root, 'scripts/reports/event-articles.json'), JSON.stringify({ rejected, stale, withoutArticle: missingKeys }, null, 1))
console.log(`articles: ${Object.keys(events).length}/${known.size} events, ${Object.keys(entities).length} entities`)
if (rejected.length) console.log('rejected:', rejected)
if (stale.length) console.log('stale keys:', stale)
if (missingKeys.length) console.log('events without an article:', missingKeys)
