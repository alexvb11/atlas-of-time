// Decodes GPlates drift snapshots off the main thread: fetch, Int16 lon/lat -> unit vectors, and the
// per-vertex stretch visibility for each index buffer (triangles, coastlines, borders). Results are
// transferred back, so the main thread only copies them into GPU attributes.
type Init = { type: 'init'; n: number; present: Float32Array; tris: Uint32Array; coast: Uint32Array; borders: Uint32Array }
type Decode = { type: 'decode'; ma: number; url: string }
export type Decoded = { ma: number; pos: Float32Array; placed: Uint8Array | null; ok: { tris: Float32Array; coast: Float32Array; borders: Float32Array } }

let mesh: Omit<Init, 'type'> | null = null
const D2R = Math.PI / 180

self.onmessage = async (e: MessageEvent<Init | Decode>) => {
  const m = e.data
  if (m.type === 'init') {
    mesh = m
    return
  }
  if (!mesh) return
  const { n } = mesh
  const b = await (await fetch(m.url)).arrayBuffer()
  const q = new Int16Array(b, 0, n * 2)
  const pos = new Float32Array(n * 3)
  // must match lonLatToVec3 in src/geo/sphere.ts
  for (let i = 0; i < n; i++) {
    const l = (q[i * 2] / 32767) * 180 * D2R
    const p = (q[i * 2 + 1] / 32767) * 90 * D2R
    pos[i * 3] = Math.cos(p) * Math.cos(l)
    pos[i * 3 + 1] = Math.sin(p)
    pos[i * 3 + 2] = -Math.cos(p) * Math.sin(l)
  }
  const placed = b.byteLength >= n * 5 ? new Uint8Array(b.slice(n * 4, n * 5)) : null
  const ok = {
    tris: stretchOk(pos, placed, mesh.tris, 3),
    coast: stretchOk(pos, placed, mesh.coast, 2),
    borders: stretchOk(pos, placed, mesh.borders, 2),
  }
  const out: Decoded = { ma: m.ma, pos, placed, ok }
  const transfer: Transferable[] = [pos.buffer, ok.tris.buffer, ok.coast.buffer, ok.borders.buffer]
  if (placed) transfer.push(placed.buffer)
  ;(self as unknown as Worker).postMessage(out, transfer)
}

const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Per-vertex visibility for a snapshot: primitives (triangles or segments) whose edges stretched far
 * beyond their present-day length straddle two plates; fade them so rifts read as gaps, not streaks.
 */
function stretchOk(snap: Float32Array, placed: Uint8Array | null, index: Uint32Array, k: 2 | 3): Float32Array {
  const P = mesh!.present
  const ok = new Float32Array(mesh!.n).fill(1)
  const len = (A: Float32Array, i: number, j: number) => Math.hypot(A[i * 3] - A[j * 3], A[i * 3 + 1] - A[j * 3 + 1], A[i * 3 + 2] - A[j * 3 + 2])
  for (let p = 0; p < index.length; p += k) {
    let ratio = 0
    for (let e = 0; e < k; e++) {
      const i = index[p + e]
      const j = index[p + ((e + 1) % k)]
      ratio = Math.max(ratio, len(snap, i, j) / Math.max(len(P, i, j), 0.0015))
    }
    let v = 1 - smoothstep(ratio, 1.5, 2.2)
    // crust the plate model does not place at this time: shown only as a faint ghost
    if (placed) for (let e = 0; e < k; e++) if (!placed[index[p + e]]) v = Math.min(v, 0.12)
    for (let e = 0; e < k; e++) {
      const i = index[p + e]
      if (v < ok[i]) ok[i] = v
    }
  }
  return ok
}
