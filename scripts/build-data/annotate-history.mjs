// Re-annotates the existing snapshots in public/data/history without refetching (see lib/annotate-history.mjs).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { annotate } from './lib/annotate-history.mjs'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/data/history')
for (const f of await fs.readdir(dir)) {
  if (f === 'index.json') continue
  const p = path.join(dir, f)
  await fs.writeFile(p, stringify(annotate(JSON.parse(await fs.readFile(p, 'utf8')))))
}
console.log('annotated', (await fs.readdir(dir)).length - 1, 'snapshots')

/** One feature per line, like mapshaper's output */
function stringify(g) {
  return `{"type":"FeatureCollection","features":[\n${g.features.map((f) => JSON.stringify(f)).join(',\n')}\n]}`
}
