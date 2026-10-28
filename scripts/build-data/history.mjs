// Fetches historical border snapshots from aourednik/historical-basemaps (GPL-3.0 data),
// simplifies them with mapshaper and writes compact GeoJSON per snapshot to public/data/history.
// Years are written as astronomical years (1 BCE = 0, 500 BCE = -499) to match the time store.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/history')
const out = path.join(root, 'public/data/history')
const mapshaper = path.join(root, 'node_modules/.bin/mapshaper')
await fs.mkdir(cache, { recursive: true })
await fs.mkdir(out, { recursive: true })

const list = await (await fetch('https://api.github.com/repos/aourednik/historical-basemaps/contents/geojson')).json()
const files = list.map((f) => f.name).filter((n) => /^world_(bc)?\d+\.geojson$/.test(n))

const parseYear = (n) => {
  const m = n.match(/^world_(bc)?(\d+)\.geojson$/)
  const y = Number(m[2])
  return m[1] ? 1 - y : y
}

const snapshots = []
const names = new Map()
for (const name of files) {
  const raw = path.join(cache, name)
  try {
    await fs.access(raw)
  } catch {
    const r = await fetch(`https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/${name}`)
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`)
    await fs.writeFile(raw, Buffer.from(await r.arrayBuffer()))
  }
  const year = parseYear(name)
  const dest = path.join(out, `${year}.json`)
  await run(mapshaper, [
    '-i', raw,
    '-filter', 'NAME != null',
    '-filter-fields', 'NAME,SUBJECTO,PARTOF,BORDERPRECISION',
    '-simplify', '12%', 'keep-shapes', 'planar',
    '-clean',
    '-o', dest, 'format=geojson', 'precision=0.01', 'force',
  ])
  const g = JSON.parse(await fs.readFile(dest, 'utf8'))
  for (const f of g.features) {
    const n = f.properties.NAME
    if (!names.has(n)) names.set(n, [])
    names.get(n).push(year)
  }
  const size = (await fs.stat(dest)).size
  snapshots.push({ year, features: g.features.length, bytes: size })
  console.log(name, '->', year, g.features.length, 'features', (size / 1024).toFixed(0), 'KB')
}
snapshots.sort((a, b) => a.year - b.year)
await fs.writeFile(
  path.join(out, 'index.json'),
  JSON.stringify({
    source: 'historical-basemaps by André Ourednik et al. (github.com/aourednik/historical-basemaps), GPL-3.0',
    snapshots,
  }),
)
await fs.writeFile(
  path.join(root, 'scripts/.cache/history-names.json'),
  JSON.stringify(Object.fromEntries([...names].sort()), null, 1),
)
