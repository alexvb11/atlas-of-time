// Per-frame derived world state. Everything the scene shows is a pure function of `time`
// (plus UI focus), smoothed here once so every layer agrees within the same frame.
import * as THREE from 'three'
import { useTime } from '../time/store'
import { toMa } from '../time/scale'
import { iceAt, seaLevelAt } from '../time/climate'
import { periodAt } from '../time/eras'

export const SUN = new THREE.Vector3(0.82, 0.32, 0.47).normalize()

export const world = {
  t: 2026,
  ma: 0,
  /** 0 = present-day photo globe, 1 = reconstructed deep-time globe */
  drift: 0,
  sea: 0,
  ice: 0,
  /** modern electric lights 0..1 */
  lights: 1,
  /** focus dimming 0..1 */
  dim: 0,
  /** time-warp strength 0..1 from scrub velocity */
  warp: 0,
  /** confidence in the plate reconstruction, fades for the oldest snapshots */
  deepConf: 1,
  /** political borders visibility */
  borders: 1,
  tint: new THREE.Color(1, 1, 1),
  tintAmt: 0,
  snow: 0,
  /** phones get lighter post-processing and fewer stars */
  isMobile: typeof window !== 'undefined' && (Math.min(window.innerWidth, window.innerHeight) < 700 || matchMedia('(pointer: coarse)').matches),
}

const smooth = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))
const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// Muted period palettes for the deep-time land (desaturated albedo is multiplied by these)
const TINTS: Record<string, [number, number, number]> = {
  Tonian: [0.62, 0.55, 0.5],
  Cryogenian: [0.8, 0.84, 0.9],
  Ediacaran: [0.62, 0.52, 0.45],
  Cambrian: [0.66, 0.52, 0.42],
  Ordovician: [0.62, 0.52, 0.44],
  Silurian: [0.5, 0.52, 0.4],
  Devonian: [0.45, 0.52, 0.36],
  Carboniferous: [0.32, 0.48, 0.3],
  Permian: [0.7, 0.52, 0.36],
  Triassic: [0.72, 0.54, 0.38],
  Jurassic: [0.42, 0.52, 0.34],
  Cretaceous: [0.4, 0.52, 0.34],
  Paleogene: [0.42, 0.52, 0.36],
  Neogene: [0.55, 0.55, 0.4],
}
const tmp = new THREE.Color()

export function updateWorld(dt: number) {
  const s = useTime.getState()
  const t = s.time
  world.t = t
  world.ma = toMa(t)
  world.drift = sstep(0.9, 3.2, world.ma)
  world.sea = seaLevelAt(t)
  world.ice = iceAt(t)
  world.lights = Math.pow(sstep(1870, 1985, t), 1.3)
  world.deepConf = 1 - 0.65 * sstep(480, 600, world.ma)
  world.borders = t >= -122999 ? 1 - world.drift : 0
  world.dim = smooth(world.dim, s.selection ? 1 : 0, 3, dt)

  const target = Math.min(1, Math.max(0, (s.velocity - 0.04) / 0.5))
  world.warp = smooth(world.warp, s.reducedMotion ? 0 : target, target > world.warp ? 10 : 3, dt)

  const p = periodAt(t)
  const tint = (p && TINTS[p.name]) || [1, 1, 1]
  tmp.setRGB(tint[0], tint[1], tint[2])
  world.tint.lerp(tmp, 1 - Math.exp(-4 * dt))
  world.tintAmt = smooth(world.tintAmt, p && TINTS[p.name] ? 0.9 : 0, 4, dt)
  world.snow = smooth(world.snow, p?.name === 'Cryogenian' ? 0.7 : 0, 3, dt)
}

if (import.meta.env.DEV) (window as unknown as { __world: typeof world }).__world = world
