// Loads the GPlates-reconstructed land mesh. Snapshots are fetched lazily and cached; the
// renderer interpolates between the two snapshots bracketing the current time on the GPU.
import { lonLatToVec3 } from '../geo/sphere'
import * as THREE from 'three'
import type { Decoded } from './drift.worker'

export type DriftMesh = {
  n: number
  lonlat: Float32Array
  /** present-day unit vectors (xyz) */
  present: Float32Array
  tris: Uint32Array
  borders: Uint32Array
  coast: Uint32Array
  times: number[]
}

let meshPromise: Promise<DriftMesh> | null = null
const snaps = new Map<number, Float32Array>()
/** per snapshot: vertex visibility for each index buffer (stretch across plates, unplaced crust) */
export const driftOk = new WeakMap<Float32Array, Decoded['ok']>()
const pending = new Map<number, Promise<Float32Array>>()
const resolvers = new Map<number, (d: Decoded) => void>()
let worker: Worker | null = null

export function loadDriftMesh(): Promise<DriftMesh> {
  meshPromise ??= (async () => {
    const [buf, index] = await Promise.all([
      fetch('/data/drift/mesh.bin').then((r) => r.arrayBuffer()),
      fetch('/data/drift/index.json').then((r) => r.json()),
    ])
    const h = new Uint32Array(buf, 0, 4)
    const [n, nt, ns, nc] = h
    let o = 16
    const lonlat = new Float32Array(buf, o, n * 2)
    o += n * 8
    const tris = new Uint32Array(buf, o, nt)
    o += nt * 4
    const borders = new Uint32Array(buf, o, ns)
    o += ns * 4
    const coast = new Uint32Array(buf, o, nc)
    const present = new Float32Array(n * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      lonLatToVec3(lonlat[i * 2], lonlat[i * 2 + 1], 1, v)
      present[i * 3] = v.x
      present[i * 3 + 1] = v.y
      present[i * 3 + 2] = v.z
    }
    // decoding runs in a worker; it keeps its own copies of the mesh it needs
    worker = new Worker(new URL('./drift.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<Decoded>) => resolvers.get(e.data.ma)?.(e.data)
    worker.postMessage({ type: 'init', n, present: present.slice(), tris: tris.slice(), coast: coast.slice(), borders: borders.slice() })
    return { n, lonlat, present, tris, borders, coast, times: index.times as number[] }
  })()
  return meshPromise
}

export function getSnapshot(ma: number): Float32Array | undefined {
  return snaps.get(ma)
}

export function loadSnapshot(ma: number): Promise<Float32Array> {
  const have = snaps.get(ma)
  if (have) return Promise.resolve(have)
  let p = pending.get(ma)
  if (!p) {
    p = new Promise<Decoded>((resolve) => {
      resolvers.set(ma, resolve)
      worker!.postMessage({ type: 'decode', ma, url: new URL(`/data/drift/t${ma}.bin`, location.href).href })
    }).then(({ pos, ok }) => {
      resolvers.delete(ma)
      driftOk.set(pos, ok)
      snaps.set(ma, pos)
      pending.delete(ma)
      return pos
    })
    pending.set(ma, p)
  }
  return p
}

/** Bracketing snapshot times and mix factor for a time in Ma */
export function bracket(times: number[], ma: number): { a: number; b: number; f: number } {
  const m = Math.max(0, Math.min(times[times.length - 1], ma))
  let lo = 0
  let hi = times.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= m) lo = mid
    else hi = mid
  }
  const a = times[lo]
  const b = times[hi]
  return { a, b, f: b === a ? 0 : (m - a) / (b - a) }
}

/** Best available bracketing pair: falls back to the nearest loaded snapshots while others stream */
export function availablePair(mesh: DriftMesh, ma: number) {
  const { a, b, f } = bracket(mesh.times, ma)
  const A = snaps.get(a)
  const B = snaps.get(b)
  if (A && B) return { A, B, f, exact: true }
  // nearest loaded snapshot so motion never freezes on a blank
  let best: Float32Array | undefined
  let bd = Infinity
  for (const [t, s] of snaps) {
    const d = Math.abs(t - ma)
    if (d < bd) {
      bd = d
      best = s
    }
  }
  if (!best) return null
  return { A: A ?? best, B: B ?? A ?? best, f: A && !B ? 0 : f, exact: false }
}
