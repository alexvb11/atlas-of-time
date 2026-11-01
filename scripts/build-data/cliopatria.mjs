// Borders from 3400 BCE to 1885 from Cliopatria (Bennett et al. 2025, Scientific Data,
// doi:10.1038/s41597-025-04516-9; Seshat Global History Databank; CC BY 4.0). Unlike the century
// snapshots of historical-basemaps, every Cliopatria shape carries its own range of years, so a
// border moves in the year it changed. Each polity also names its Wikipedia article and Wikidata
// item, so the atlas links it without guessing from the name.
//
// Rows whose name is in parentheses ("(Holy Roman Empire)") are groupings of member polities; they
// are kept as labels and as the "part of" of their members, not drawn as borders. RELATION rows
// (tributary allegiance, personal unions) are not territory and are left out.
//
// Years: Cliopatria counts BCE years as negative integers; the atlas uses astronomical years
// (1 BCE = 0), so -500 becomes -499. A row covers FromYear..ToYear inclusive.
//
// Places Cliopatria leaves empty (peoples and cultures without a state) still show the
// historical-basemaps polygon there, marked approximate (done in the history worker).
//
// Output: public/data/history/cliopatria-<era>.topo.json, and its change years merged into index.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { feature } from 'topojson-client'
import { annotate } from './lib/annotate-history.mjs'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/cliopatria')
const out = path.join(root, 'public/data/history')
await fs.mkdir(cache, { recursive: true })

/** first year CShapes takes over */
const END = 1886
const astro = (y) => (y < 0 ? y + 1 : y)

const zip = path.join(cache, 'cliopatria.geojson.zip')
try {
  await fs.access(zip)
} catch {
  const r = await fetch('https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip')
  if (!r.ok) throw new Error(`cliopatria: HTTP ${r.status}`)
  await fs.writeFile(zip, Buffer.from(await r.arrayBuffer()))
}
let src = (await fs.readdir(cache)).find((f) => f.endsWith('.geojson') && f !== 'input.geojson')
if (!src) {
  // Windows has no unzip, but its bundled tar reads zip files
  await (process.platform === 'win32' ? run('tar', ['-xf', zip, '-C', cache]) : run('unzip', ['-o', '-q', zip, '-d', cache]))
  src = (await fs.readdir(cache)).find((f) => f.endsWith('.geojson') && f !== 'input.geojson')
}

// keep the rows before 1886, with compact properties, then simplify as one topology so borders
// shared by neighbours or unchanged across rows are stored once
const all = JSON.parse(await fs.readFile(path.join(cache, src), 'utf8'))
const rows = all.features.filter((f) => f.geometry && f.properties.Type === 'POLITY' && astro(f.properties.FromYear) < END)
const input = {
  type: 'FeatureCollection',
  features: rows.map((f) => {
    const p = f.properties
    const group = p.Name.startsWith('(')
    const member = String(p.MemberOf || '').split(';')[0].replace(/^\(|\)$/g, '').trim()
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        n: group ? p.Name.slice(1, -1) : p.Name,
        f: astro(p.FromYear),
        e: Math.min(END, astro(p.ToYear) + 1),
        w: p.Wikipedia || '',
        q: p.Wikidata || '',
        m: member,
        g: group ? 1 : 0,
      },
    }
  }),
}
const inFile = path.join(cache, 'input.geojson')
await fs.writeFile(inFile, JSON.stringify(input))
const topoFile = path.join(cache, 'cliopatria.topo.json')
await run(
  process.execPath,
  [
    '--max-old-space-size=8192',
    path.join(root, 'node_modules/mapshaper/bin/mapshaper'),
    '-i', inFile,
    // the source is digitised from atlases at regional scale; detail below ~3 km is noise here
    '-simplify', 'interval=3000', 'keep-shapes',
    '-o', topoFile, 'format=topojson', 'quantization=400000', 'force',
  ],
  { maxBuffer: 1 << 28 },
)
const topo = JSON.parse(await fs.readFile(topoFile, 'utf8'))
const layer = Object.keys(topo.objects)[0]
const geoms = topo.objects[layer].geometries.filter((g) => g.type)
topo.objects[layer].geometries = geoms

const keys = new Set()
const names = new Map()
for (const g of geoms) {
  const f = annotate({ type: 'FeatureCollection', features: [feature(topo, g)] }).features[0]
  const p = g.properties
  g.properties = { ...p, b: f.properties._b, a: f.properties._a, l: f.properties._l }
  if (!p.m || p.m === p.n) delete g.properties.m
  if (!p.g) delete g.properties.g
  if (!p.w) delete g.properties.w
  if (!p.q) delete g.properties.q
  keys.add(p.f)
  keys.add(p.e)
  if (!p.g) {
    const k = p.n
    const info = names.get(k) ?? { from: p.f, to: p.e, wiki: p.w, qid: p.q, label: f.properties._l }
    info.from = Math.min(info.from, p.f)
    info.to = Math.max(info.to, p.e)
    names.set(k, info)
  }
}
// Split into eras so a visit to 1500 does not download 3400 BCE. A shape spanning two eras goes in
// both; each era is re-encoded as its own topology so it carries only its own arcs.
const ERAS = [-3399, -1000, 0, 400, 800, 1100, 1300, 1450, 1600, 1720, 1800, END]
const chunks = []
for (const old of (await fs.readdir(out)).filter((f) => f.startsWith('cliopatria'))) await fs.rm(path.join(out, old))
for (let i = 0; i < ERAS.length - 1; i++) {
  const [a, b] = [ERAS[i], ERAS[i + 1]]
  const part = geoms.filter((g) => g.properties.f < b && g.properties.e > a)
  const fc = { type: 'FeatureCollection', features: part.map((g) => feature(topo, g)) }
  const tmp = path.join(cache, `era-${i}.geojson`)
  await fs.writeFile(tmp, JSON.stringify(fc))
  const url = `cliopatria-${i}.topo.json`
  await run(process.execPath, [path.join(root, 'node_modules/mapshaper/bin/mapshaper'), '-i', tmp, '-o', path.join(out, url), 'format=topojson', 'quantization=400000', 'force'], { maxBuffer: 1 << 28 })
  chunks.push({ from: a, to: b, url })
}

// polity list for the entity build (tiers.mjs): name -> years, Wikipedia title, Wikidata id
await fs.writeFile(path.join(root, 'scripts/.cache/cliopatria-names.json'), JSON.stringify(Object.fromEntries([...names].sort())))

const index = JSON.parse(await fs.readFile(path.join(out, 'index.json'), 'utf8'))
const first = Math.min(...keys)
index.cliopatria = {
  chunks,
  from: first,
  to: END,
  source: 'Cliopatria v0.2.1 (Bennett et al. 2025, Seshat Global History Databank), CC BY 4.0',
  keys: [...keys].filter((k) => k < END).sort((a, b) => a - b),
}
await fs.writeFile(path.join(out, 'index.json'), JSON.stringify(index))
const sizes = await Promise.all(chunks.map(async (c) => (await fs.stat(path.join(out, c.url))).size))
console.log(`cliopatria: ${geoms.length} shapes, ${names.size} polities, ${index.cliopatria.keys.length} change years from ${first}, ${chunks.length} eras of ${sizes.map((s) => (s / 1024).toFixed(0)).join('/')} KB`)
