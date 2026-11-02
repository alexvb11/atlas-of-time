// City walls from OpenStreetMap (© OpenStreetMap contributors, ODbL), for the cities whose walls
// still trace the historic town. Each circuit gets the year it was finished from its Wikipedia
// article (see src/data/citywalls.ts); this script only fetches and simplifies the outlines.
//   public/data/citywalls.json  { [id]: [[lon, lat, lon, lat, …], …] }  one array per stretch
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/walls')
await fs.mkdir(cache, { recursive: true })

// bbox is south,west,north,east; keep() drops other walls inside the box (by OSM name).
// Xi'an and the Moscow Kremlin were tried and left out: OSM maps almost none of them as city walls.
const CITIES = [
  { id: 'rome', bbox: '41.86,12.46,41.93,12.54', keep: (n) => /aurelian/i.test(n) },
  { id: 'constantinople', bbox: '40.99,28.91,41.03,28.95' },
  { id: 'jerusalem', bbox: '31.771,35.223,31.784,35.238' },
  { id: 'lucca', bbox: '43.836,10.49,43.85,10.515' },
  { id: 'seoul', bbox: '37.54,126.94,37.61,127.02' },
]
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

async function overpass(c) {
  const file = path.join(cache, `${c.id}.json`)
  try {
    const d = JSON.parse(await fs.readFile(file, 'utf8'))
    if (d.elements?.length) return d
  } catch {}
  const q = `[out:json][timeout:90];(wr[barrier=city_wall](${c.bbox});wr[historic=citywalls](${c.bbox});${c.extra ? `${c.extra}(${c.bbox});` : ''});out tags geom;`
  for (let attempt = 0; attempt < 9; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length]
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'atlas-of-time build (github.com/alexvb11/atlas-of-time)' } })
      const text = await r.text()
      const d = JSON.parse(text)
      await fs.writeFile(file, text)
      return d
    } catch {
      await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)))
    }
  }
  throw new Error(`overpass failed for ${c.id}`)
}

// Douglas–Peucker in local metres
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const k = Math.cos((pts[0][1] * Math.PI) / 180)
  const xy = pts.map(([lon, lat]) => [lon * 111320 * k, lat * 110540])
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = xy[a]
    const [bx, by] = xy[b]
    const L = Math.hypot(bx - ax, by - ay) || 1
    let best = -1
    let bi = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / L
      if (d > best) [best, bi] = [d, i]
    }
    if (best > tol) {
      keep[bi] = 1
      stack.push([a, bi], [bi, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

const out = {}
for (const c of CITIES) {
  const d = await overpass(c)
  const lines = []
  for (const e of d.elements) {
    const name = e.tags?.['name:en'] ?? e.tags?.name ?? ''
    if (c.keep && !c.keep(name)) continue
    const geoms = e.type === 'way' ? [e.geometry] : (e.members ?? []).filter((m) => m.type === 'way').map((m) => m.geometry)
    for (const g of geoms) {
      if (!g || g.length < 2) continue
      const pts = simplify(
        g.map((p) => [p.lon, p.lat]),
        2,
      )
      lines.push(pts.flatMap(([lon, lat]) => [+lon.toFixed(6), +lat.toFixed(6)]))
    }
  }
  // a way can be both a relation member and listed on its own
  const seen = new Set()
  out[c.id] = lines.filter((l) => {
    const key = l.join(',')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  console.log(c.id, out[c.id].length, 'stretches', out[c.id].reduce((s, l) => s + l.length / 2, 0), 'points')
}
await fs.writeFile(path.join(root, 'public/data/citywalls.json'), JSON.stringify(out))
