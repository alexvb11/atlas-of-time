// Per-frame derived world state. Everything the scene shows is a pure function of `time`
// (plus UI focus), smoothed here once so every layer agrees within the same frame.
import * as THREE from 'three'
import { useTime } from '../time/store'
import { PRESENT, toMa } from '../time/scale'
import { greenSaharaAt, iceAt, seaLevelAt } from '../time/climate'
import { periodAt } from '../time/eras'
import { settings } from '../time/settings'
import { lonLatToVec3 } from '../geo/sphere'
import { obliquity } from '../time/astro'

export const SUN = new THREE.Vector3(0.82, 0.32, 0.47).normalize()
/** the fixed, flattering light used when the seasons layer is off */
const SUN_DEFAULT = SUN.clone()
const SUN_LON = (Math.atan2(-SUN_DEFAULT.z, SUN_DEFAULT.x) * 180) / Math.PI

export const world = {
  t: 2026,
  ma: 0,
  /** 0 = present-day photo globe, 1 = reconstructed deep-time globe */
  drift: 0,
  sea: 0,
  ice: 0,
  /** 0..1 strength of the African Humid Period ("Green Sahara") */
  green: 0,
  /** where the sun is overhead when the seasons layer is on: [lon, lat] */
  subsolar: null as [number, number] | null,
  /** true while the close-up imagery and terrain patch is on screen (its sources are credited) */
  detail: false,
  /** 0..1: how much the PALEOMAP landscapes (PaleoLand.tsx) cover the globe in deep time */
  paleo: 0,
  /** 0..1: the real star sky (Sky.tsx) replaces the procedural one nearer the present */
  realSky: 0,
  /** galactic north pole and galactic centre in world space, kept current by Sky.tsx */
  galPole: new THREE.Vector3(0, 0.94, 0.32).normalize(),
  galCore: new THREE.Vector3(-0.6, 0.35, -0.7).normalize(),
  /** where the camera looks from, [lon, lat] (written by the camera rig) */
  view: [20, 22] as [number, number],
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
const sunTarget = new THREE.Vector3()

/**
 * Subsolar point for the seasons layer. The day of the year comes from the fraction of the year,
 * so the sun's latitude follows the seasons (Cooper's declination formula). At the present it is
 * the real sun, overhead where it is noon right now (UTC); in the past the time of day is not
 * known, so the sun keeps its usual longitude.
 */
export function subsolarAt(t: number): [number, number] {
  const live = t >= PRESENT - 0.002
  const now = new Date()
  const frac = live ? (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / (365.25 * 864e5) : t - Math.floor(t)
  const day = frac * 365.25
  const decl = obliquity(t) * Math.sin((2 * Math.PI * (284 + day)) / 365.25)
  const lon = live ? -15 * (now.getUTCHours() + now.getUTCMinutes() / 60 - 12) : SUN_LON
  return [((lon + 540) % 360) - 180, decl]
}

export function updateWorld(dt: number) {
  const s = useTime.getState()
  const t = s.time
  world.t = t
  world.ma = toMa(t)
  world.drift = sstep(0.9, 3.2, world.ma)
  const set = settings()
  world.sea = set.climate ? seaLevelAt(t) : 0
  world.ice = set.climate ? iceAt(t) : 0
  world.green = set.greenSahara ? greenSaharaAt(t) : 0
  if (set.sun !== 'fixed' && s.introDone) {
    // "always day": the sun stays behind the viewer's shoulder, so the face in view is lit
    world.subsolar = set.sun === 'seasons' ? subsolarAt(t) : [world.view[0] - 22, Math.max(-60, Math.min(60, world.view[1] + 8))]
    lonLatToVec3(world.subsolar[0], world.subsolar[1], 1, sunTarget)
    // eased, so scrubbing across years does not strobe the seasons
    SUN.lerp(sunTarget, 1 - Math.exp(-(s.scrubbing ? 3 : 6) * dt)).normalize()
  } else if (world.subsolar) {
    SUN.lerp(SUN_DEFAULT, 1 - Math.exp(-5 * dt)).normalize()
    if (SUN.distanceTo(SUN_DEFAULT) < 1e-3) {
      SUN.copy(SUN_DEFAULT)
      world.subsolar = null
    }
  }
  world.lights = Math.pow(sstep(1870, 1985, t), 1.3)
  world.deepConf = 1 - 0.65 * sstep(480, 600, world.ma)
  world.borders = set.borders && t >= -122999 ? 1 - world.drift : 0
  world.dim = smooth(world.dim, s.selection ? 1 : 0, 3, dt)

  const target = Math.min(1, Math.max(0, (s.velocity - 0.04) / 0.5))
  world.warp = smooth(world.warp, s.reducedMotion || !set.warpEffects ? 0 : target, target > world.warp ? 10 : 3, dt)

  const p = periodAt(t)
  const tint = (p && TINTS[p.name]) || [1, 1, 1]
  tmp.setRGB(tint[0], tint[1], tint[2])
  world.tint.lerp(tmp, 1 - Math.exp(-4 * dt))
  world.tintAmt = smooth(world.tintAmt, p && TINTS[p.name] ? 0.9 : 0, 4, dt)
  world.snow = smooth(world.snow, p?.name === 'Cryogenian' ? 0.7 : 0, 3, dt)
}

if (import.meta.env.DEV) (window as unknown as { __world: typeof world }).__world = world
