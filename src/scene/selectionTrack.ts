// Keeps the selected location glued to its piece of crust in deep time.
// The click is stored as a present-day lon/lat; we find the drift-mesh triangle containing it once
// and then evaluate its barycentric position in the current (interpolated) snapshot every frame.
import * as THREE from 'three'
import { lonLatToVec3, type LonLat } from '../geo/sphere'
import type { DriftMesh } from '../data/drift'
import { useTime } from '../time/store'
import { world } from './world'

export const driftNow: { mesh: DriftMesh | null; A: Float32Array | null; B: Float32Array | null; f: number } = {
  mesh: null,
  A: null,
  B: null,
  f: 0,
}

type Track = { key: string; tri: [number, number, number] | null; w: [number, number, number] }
let track: Track | null = null

function locate(mesh: DriftMesh, [lon, lat]: LonLat): Track {
  const ll = mesh.lonlat
  const t = mesh.tris
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i], b = t[i + 1], c = t[i + 2]
    const x1 = ll[a * 2], y1 = ll[a * 2 + 1]
    const x2 = ll[b * 2], y2 = ll[b * 2 + 1]
    const x3 = ll[c * 2], y3 = ll[c * 2 + 1]
    if (lon < Math.min(x1, x2, x3) || lon > Math.max(x1, x2, x3) || lat < Math.min(y1, y2, y3) || lat > Math.max(y1, y2, y3)) continue
    const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    if (Math.abs(d) < 1e-12) continue
    const w1 = ((y2 - y3) * (lon - x3) + (x3 - x2) * (lat - y3)) / d
    const w2 = ((y3 - y1) * (lon - x3) + (x1 - x3) * (lat - y3)) / d
    const w3 = 1 - w1 - w2
    if (w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6) return { key: `${lon},${lat}`, tri: [a, b, c], w: [w1, w2, w3] }
  }
  return { key: `${lon},${lat}`, tri: null, w: [0, 0, 0] }
}

const out = new THREE.Vector3()
const pa = new THREE.Vector3()
const pb = new THREE.Vector3()

/** Is the selected point on land that existed as reconstructed crust? */
export function selectionOnCrust(): boolean {
  const sel = useTime.getState().selection
  if (!sel || !driftNow.mesh) return false
  const key = `${sel[0]},${sel[1]}`
  if (!track || track.key !== key) track = locate(driftNow.mesh, sel)
  return !!track.tri
}

/** Drifted position of a present-day point, or null when it is not on the land mesh */
export function driftedPosition(p: LonLat, target = new THREE.Vector3()): THREE.Vector3 | null {
  const { mesh, A, B, f } = driftNow
  if (!mesh || !A || !B) return null
  const tr = locate(mesh, p)
  if (!tr.tri) return null
  return evalTrack(tr, A, B, f, target)
}

function evalTrack(tr: Track, A: Float32Array, B: Float32Array, f: number, target: THREE.Vector3) {
  target.set(0, 0, 0)
  tr.tri!.forEach((v, k) => {
    pa.fromArray(A, v * 3)
    pb.fromArray(B, v * 3)
    pa.lerp(pb, f).normalize()
    target.addScaledVector(pa, tr.w[k])
  })
  return target.normalize()
}

/** World-space unit position of the selection at the current time */
export function selectionWorldPosition(): THREE.Vector3 | null {
  const sel = useTime.getState().selection
  if (!sel) return null
  const present = lonLatToVec3(sel[0], sel[1], 1, out)
  const { mesh, A, B, f } = driftNow
  if (world.drift < 0.001 || !mesh || !A || !B) return present.clone()
  const key = `${sel[0]},${sel[1]}`
  if (!track || track.key !== key) track = locate(mesh, sel)
  if (!track.tri) return present.clone()
  return evalTrack(track, A, B, f, new THREE.Vector3())
}
