// Builds the deep-time continental drift dataset.
//
// 1. Takes Natural Earth 50m countries (world-atlas TopoJSON), simplifies it, and merges it into
//    land polygons that share vertices with the country borders.
// 2. Triangulates land in lon/lat (earcut) and refines it conformingly so no edge is longer than
//    MAX_EDGE_DEG on the sphere (big triangles would cut through the globe).
// 3. Sends every vertex to the GPlates Web Service (MERDITH2021 plate model) once per timestep.
//    Because the same point list is reconstructed every time, vertex i is the same piece of crust
//    in every snapshot, so the client can interpolate positions on the GPU.
//
// Output (public/data/drift/):
//   mesh.bin   header + present-day lon/lat (f32) + triangle indices (u32) + border segments (u32)
//   t{Ma}.bin  reconstructed lon/lat per vertex, int16-quantised
//   index.json timesteps and counts
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import earcut from 'earcut'
import * as topojson from 'topojson-client'
import { presimplify, simplify } from 'topojson-simplify'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache')
const out = path.join(root, 'public/data/drift')
const MODEL = 'MERDITH2021'
const MAX_EDGE_DEG = Number(process.env.E ?? 5)
const TIMES = [
  ...Array.from({ length: 51 }, (_, i) => i * 5), // 0..250 Ma every 5 Myr
  ...Array.from({ length: 50 }, (_, i) => 260 + i * 10), // 260..750 Ma every 10 Myr
]
const CONCURRENCY = 2

await fs.mkdir(out, { recursive: true })

// ---------- geometry ----------
const topo = JSON.parse(await fs.readFile(path.join(cache, 'countries-50m.json'), 'utf8'))
const pre = presimplify(topo)
const simple = simplify(pre, Number(process.env.W ?? 0.05))

const land = topojson.merge(simple, simple.objects.countries.geometries)
const borders = topojson.mesh(simple, simple.objects.countries, (a, b) => a !== b)

const verts = [] // [lon, lat]
const vkey = new Map()
const addV = (lon, lat) => {
  const k = `${lon.toFixed(4)},${lat.toFixed(4)}`
  let i = vkey.get(k)
  if (i === undefined) {
    i = verts.length
    verts.push([lon, lat])
    vkey.set(k, i)
  }
  return i
}

let tris = []
for (const poly of land.coordinates) {
  const flat = []
  const holes = []
  const ids = []
  poly.forEach((ring, r) => {
    if (r > 0) holes.push(flat.length / 2)
    // drop closing vertex
    for (const [lon, lat] of ring.slice(0, -1)) {
      flat.push(lon, lat)
      ids.push(addV(lon, lat))
    }
  })
  const t = earcut(flat, holes.length ? holes : null, 2)
  for (let i = 0; i < t.length; i++) tris.push(ids[t[i]])
}

const toVec = ([lon, lat]) => {
  const p = (lat * Math.PI) / 180
  const l = (lon * Math.PI) / 180
  return [Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l)]
}
const angle = (a, b) => {
  const u = toVec(verts[a])
  const v = toVec(verts[b])
  const d = Math.min(1, Math.max(-1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))
  return (Math.acos(d) * 180) / Math.PI
}
// midpoint in lon/lat space keeps the triangulation planar-consistent with earcut's input
const mid = new Map()
const midpoint = (a, b) => {
  const k = a < b ? `${a}_${b}` : `${b}_${a}`
  let m = mid.get(k)
  if (m === undefined) {
    const [x1, y1] = verts[a]
    const [x2, y2] = verts[b]
    m = verts.length
    verts.push([(x1 + x2) / 2, (y1 + y2) / 2])
    mid.set(k, m)
  }
  return m
}

// Conforming refinement: mark long edges globally, split each triangle by its marked edge count.
for (let pass = 0; pass < 8; pass++) {
  const marked = new Set()
  const ek = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`)
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]
    for (const [p, q] of [[a, b], [b, c], [c, a]]) if (angle(p, q) > MAX_EDGE_DEG) marked.add(ek(p, q))
  }
  if (!marked.size) break
  // closure: a triangle with 2 marked edges is fine; splitting by count keeps conformity
  const next = []
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]
    const mab = marked.has(ek(a, b))
    const mbc = marked.has(ek(b, c))
    const mca = marked.has(ek(c, a))
    const n = +mab + +mbc + +mca
    if (n === 0) next.push(a, b, c)
    else if (n === 3) {
      const x = midpoint(a, b), y = midpoint(b, c), z = midpoint(c, a)
      next.push(a, x, z, x, b, y, z, y, c, x, y, z)
    } else if (n === 1) {
      if (mab) { const x = midpoint(a, b); next.push(a, x, c, x, b, c) }
      else if (mbc) { const y = midpoint(b, c); next.push(a, b, y, a, y, c) }
      else { const z = midpoint(c, a); next.push(a, b, z, z, b, c) }
    } else {
      if (!mab) { const y = midpoint(b, c), z = midpoint(c, a); next.push(a, b, y, a, y, z, z, y, c) }
      else if (!mbc) { const x = midpoint(a, b), z = midpoint(c, a); next.push(a, x, z, x, b, c, x, c, z) }
      else { const x = midpoint(a, b), y = midpoint(b, c); next.push(a, x, c, x, y, c, x, b, y) }
    }
  }
  tris = next
  console.log(`refine pass ${pass}: ${marked.size} long edges, ${tris.length / 3} tris, ${verts.length} verts`)
}

// border segments (country boundaries) — vertices shared with land where they coincide
const seg = []
for (const line of borders.coordinates) {
  for (let i = 0; i < line.length - 1; i++) seg.push(addV(...line[i]), addV(...line[i + 1]))
}
// coastline segments = land rings
const coast = []
for (const poly of land.coordinates)
  for (const ring of poly)
    for (let i = 0; i < ring.length - 1; i++) coast.push(addV(...ring[i]), addV(...ring[i + 1]))

const N = verts.length
console.log(`vertices ${N}, triangles ${tris.length / 3}, border segs ${seg.length / 2}, coast segs ${coast.length / 2}`)

{
  const header = new Uint32Array([N, tris.length, seg.length, coast.length])
  const ll = new Float32Array(N * 2)
  verts.forEach(([lon, lat], i) => { ll[i * 2] = lon; ll[i * 2 + 1] = lat })
  const buf = Buffer.concat([
    Buffer.from(header.buffer),
    Buffer.from(ll.buffer),
    Buffer.from(new Uint32Array(tris).buffer),
    Buffer.from(new Uint32Array(seg).buffer),
    Buffer.from(new Uint32Array(coast).buffer),
  ])
  await fs.writeFile(path.join(out, 'mesh.bin'), buf)
}

if (process.env.DRY) process.exit(0)
// ---------- reconstruction ----------
async function reconstruct(time) {
  const file = path.join(cache, `gplates-${MODEL}-${N}-${time}.json`)
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch {}
  const coords = []
  const CHUNK = 6000
  for (let s = 0; s < N; s += CHUNK) {
    const part = verts.slice(s, s + CHUNK)
    const body = `points=${part.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(',')}&time=${time}&model=${MODEL}&return_null_points`
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await fetch('https://gws.gplates.org/reconstruct/reconstruct_points/', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body,
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        if (j.coordinates.length !== part.length) throw new Error('length mismatch')
        coords.push(...j.coordinates)
        break
      } catch (e) {
        if (attempt > 9) throw e
        console.warn(`  t=${time} chunk ${s}: ${e.message}, retrying`)
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
      }
    }
  }
  await fs.writeFile(file, JSON.stringify(coords))
  return coords
}

const results = new Map()
let cursor = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < TIMES.length) {
      const t = TIMES[cursor++]
      const t0 = Date.now()
      results.set(t, await reconstruct(t))
      console.log(`t=${t} Ma done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    }
  }),
)

// Fill points GPlates could not place (null: crust not assigned to a plate at that time).
// Each null vertex takes the rotation of its nearest valid vertex (multi-source BFS over the mesh),
// applied to its own previous position, so unplaced land moves coherently with its neighbours
// instead of freezing and tearing the mesh.
const adj = Array.from({ length: N }, () => [])
const link = (a, b) => { adj[a].push(b); adj[b].push(a) }
for (let i = 0; i < tris.length; i += 3) { link(tris[i], tris[i + 1]); link(tris[i + 1], tris[i + 2]); link(tris[i + 2], tris[i]) }
for (let i = 0; i < seg.length; i += 2) link(seg[i], seg[i + 1])
for (let i = 0; i < coast.length; i += 2) link(coast[i], coast[i + 1])

const vecOf = ([lon, lat]) => toVec([lon, lat])
const llOf = ([x, y, z]) => [(Math.atan2(-z, x) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
// rotate v by the minimal rotation taking a to b (Rodrigues)
function rotateLike(v, a, b) {
  const k = cross(a, b)
  const s = Math.hypot(...k)
  const c = dot(a, b)
  if (s < 1e-12) return v
  const u = k.map((x) => x / s)
  const uxv = cross(u, v)
  const udv = dot(u, v)
  return [0, 1, 2].map((i) => v[i] * c + uxv[i] * s + u[i] * udv * (1 - c))
}

const nullStats = {}
let prev = verts.map(([a, b]) => [a, b])
for (const t of TIMES) {
  const c = results.get(t)
  let nulls = 0
  const src = new Int32Array(N).fill(-1)
  const queue = []
  c.forEach((p, i) => { if (p) { src[i] = i; queue.push(i) } else nulls++ })
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h]
    for (const j of adj[i]) if (src[j] < 0) { src[j] = src[i]; queue.push(j) }
  }
  const filled = c.map((p, i) => {
    if (p) return p
    const j = src[i]
    if (j < 0) return prev[i]
    return llOf(rotateLike(vecOf(prev[i]), vecOf(prev[j]), vecOf(c[j])))
  })
  nullStats[t] = nulls
  const q = new Int16Array(N * 2)
  filled.forEach(([lon, lat], i) => {
    q[i * 2] = Math.round((lon / 180) * 32767)
    q[i * 2 + 1] = Math.round((lat / 90) * 32767)
  })
  await fs.writeFile(path.join(out, `t${t}.bin`), Buffer.from(q.buffer))
  prev = filled
}

await fs.writeFile(
  path.join(out, 'index.json'),
  JSON.stringify({ model: MODEL, vertices: N, times: TIMES, nulls: nullStats, source: 'GPlates Web Service (gws.gplates.org), Merdith et al. 2021' }),
)
console.log('null points per timestep', nullStats)
