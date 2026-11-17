// Custom orbit rig. One plain object (`rig`) describes the shot; GSAP tweens it for cinematic
// moves and pointer input nudges it with inertia. Camera = point south of the target at `tilt`,
// looking at a blend between the globe centre and the target surface point (`focus`).
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { settings } from '../time/settings'
import { groundHeightAt, TILE_BASE } from './TerrainTiles'
import { world } from './world'
import gsap from 'gsap'
import { lonLatToVec3, vec3ToLonLat } from '../geo/sphere'
import { useTime } from '../time/store'
import { selectionWorldPosition } from './selectionTrack'
import { sound } from '../ui/sound'
import { useGround } from './ground'

export const rig = {
  lon: 20,
  lat: 22,
  dist: 4.3,
  focus: 0,
  tilt: 0,
  flying: false,
  lastInput: 0,
  autoRotate: true,
  /** where wheel and pinch are taking the distance; eased toward each frame (null: no zoom under way) */
  zoomTo: null as number | null,
  // ---- ground mode (ground.ts): standing on the terrain at eye height ----
  ground: false,
  /** 0 = the orbit shot above, 1 = standing on the ground; tweened while dropping or lifting off */
  groundBlend: 0,
  /** heading in degrees clockwise from north, and the look up (+) or down (−) */
  yaw: 0,
  pitch: 2,
  /** eye height above the ground in metres */
  eye: 1.7,
  /** the ground's height under the viewer, eased so steps on the terrain grid do not jolt */
  groundH: NaN,
  /** walking input: forward/back and right/left, −1..1, and whether running */
  walk: { f: 0, r: 0, run: false },
}
export const pointerOnGlobe = { dragging: false }
// dev, or ?qa in production builds, for the screenshot scripts
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) (window as unknown as { __rig: typeof rig }).__rig = rig

export const DEFAULT_DIST = 4.3
/** closest approach: with close-ups on, down to ~900 m above the ground (lower, the 10 m imagery blurs) */
const minDist = () => (settings().detail ? 1 + (groundHeightAt(rig.lon, rig.lat) * settings().terrain + 900) / 6371000 : 1.22)
const MAX_DIST = 7

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const look = new THREE.Vector3()
const gPos = new THREE.Vector3()
const gLook = new THREE.Vector3()
const up = new THREE.Vector3()
const east = new THREE.Vector3()
const north = new THREE.Vector3()
const fwd = new THREE.Vector3()
const gMat = new THREE.Matrix4()
const gQuat = new THREE.Quaternion()

export function CameraRig() {
  const { camera, gl, size } = useThree()
  const offset = useRef({ x: 0, y: 0 })
  const vel = useRef({ lon: 0, lat: 0 })
  const closeLean = useRef(0)
  const flyNonce = useTime((s) => s.flyNonce)
  const selection = useTime((s) => s.selection)
  const introDone = useTime((s) => s.introDone)

  // ---- pointer input on the canvas ----
  useEffect(() => {
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number }>()
    let pinch0 = 0
    let dist0 = rig.dist
    let moved = 0

    const down = (e: PointerEvent) => {
      if (!useTime.getState().introDone) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture(e.pointerId)
      moved = 0
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y)
        dist0 = rig.dist
      }
      rig.lastInput = performance.now()
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      rig.lastInput = performance.now()
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (rig.ground) {
          if (pinch0 > 0 && d < pinch0 * 0.6) useGround.getState().leave()
          return
        }
        if (pinch0 > 0) rig.zoomTo = THREE.MathUtils.clamp(1 + (dist0 - 1) * (pinch0 / d), minDist(), MAX_DIST)
        return
      }
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 4) pointerOnGlobe.dragging = true
      if (rig.ground) {
        // look around: drag turns the head; a slow pan under way is cancelled by the touch
        if (moved > 4) gsap.killTweensOf(rig, 'yaw,pitch')
        const k = (0.16 * settings().lookSpeed) / Math.max(1, el.clientHeight / 900)
        rig.yaw = (rig.yaw - dx * k + 360) % 360
        rig.pitch = THREE.MathUtils.clamp(rig.pitch + dy * k, -85, 85)
        return
      }
      if (rig.flying) return
      // the ground moves under the pointer at the same speed at any height
      const alt = Math.max(rig.dist - 1, 0.00004)
      const k = (0.06 * alt + 0.16 * (rig.dist - 0.9) * THREE.MathUtils.smoothstep(alt, 0.05, 0.5)) / Math.max(1, el.clientHeight / 900)
      vel.current.lon = -dx * k
      vel.current.lat = dy * k
      rig.lon += vel.current.lon
      rig.lat = THREE.MathUtils.clamp(rig.lat + vel.current.lat, -82, 82)
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch0 = 0
      setTimeout(() => (pointerOnGlobe.dragging = false), 0)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!useTime.getState().introDone || rig.flying) return
      rig.lastInput = performance.now()
      if (rig.ground) {
        // wheeling out stands up and lifts off; wheeling in does nothing on the ground
        if (e.deltaY > 30) useGround.getState().leave()
        return
      }
      // glide rather than jump: the target moves, the camera follows it
      // zoom works on the height above the ground, so it is as quick near the surface as in space
      const alt = (rig.zoomTo ?? rig.dist) - 1
      rig.zoomTo = THREE.MathUtils.clamp(1 + alt * Math.exp(e.deltaY * 0.0016), minDist(), MAX_DIST)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.style.touchAction = 'none'
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  // ---- walking keys on the ground ----
  useEffect(() => {
    const held = new Set<string>()
    const apply = () => {
      const w = rig.walk
      w.f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
      w.r = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0)
      w.run = held.has('ShiftLeft') || held.has('ShiftRight')
    }
    const down = (e: KeyboardEvent) => {
      if (!rig.ground) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) {
        e.preventDefault()
        e.stopImmediatePropagation()
        held.add(e.code)
        apply()
        rig.lastInput = performance.now()
      }
    }
    const up = (e: KeyboardEvent) => {
      held.delete(e.code)
      apply()
    }
    const blur = () => {
      held.clear()
      apply()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // ---- cinematic fly-to along the great circle ----
  useEffect(() => {
    if (!flyNonce) return
    const sel = useTime.getState().selection
    if (!sel || rig.ground) return
    const reduced = useTime.getState().reducedMotion
    const wp = selectionWorldPosition()
    const [toLon, toLat] = wp ? vec3ToLonLat(wp) : sel
    flyTo(toLon, toLat, Math.min(rig.dist, 2.05), reduced)
  }, [flyNonce])

  // ---- fly back out on deselect ----
  const hadSelection = useRef(false)
  useEffect(() => {
    if (selection) {
      hadSelection.current = true
      return
    }
    if (!hadSelection.current) return
    hadSelection.current = false
    if (rig.ground) return
    const reduced = useTime.getState().reducedMotion
    gsap.killTweensOf(rig)
    rig.flying = true
    gsap.to(rig, {
      focus: 0,
      tilt: 0,
      dist: Math.max(rig.dist, DEFAULT_DIST),
      duration: reduced ? 0.01 : 1.6,
      ease: 'power3.inOut',
      onComplete: () => void (rig.flying = false),
    })
  }, [selection])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const prefs = settings()
    const now = performance.now()
    const state = useTime.getState()

    // inertia after drag
    if (!pointerOnGlobe.dragging && !rig.flying) {
      rig.lon += vel.current.lon
      rig.lat = THREE.MathUtils.clamp(rig.lat + vel.current.lat, -82, 82)
      const decay = Math.exp(-dt * 4.5)
      vel.current.lon *= decay
      vel.current.lat *= decay
    }

    // follow the selected crust as it drifts through deep time
    if (state.selection && !rig.flying && !pointerOnGlobe.dragging && now - rig.lastInput > 1500) {
      const wp = selectionWorldPosition()
      if (wp) {
        const [lon, lat] = vec3ToLonLat(wp)
        let d = lon - rig.lon
        d = ((d + 540) % 360) - 180
        const k = 1 - Math.exp(-dt * 3)
        rig.lon += d * k
        rig.lat += (lat - rig.lat) * k
      }
    }

    // walking: metres a second along the heading, over the terrain
    if (rig.ground && (rig.walk.f || rig.walk.r) && !rig.flying) {
      const w = rig.walk
      const speed = (w.run ? 14 : 3.2) * dt
      const h = (rig.yaw * Math.PI) / 180
      const dn = (w.f * Math.cos(h) - w.r * Math.sin(h)) * speed
      const de = (w.f * Math.sin(h) + w.r * Math.cos(h)) * speed
      rig.lat = THREE.MathUtils.clamp(rig.lat + dn / 111320, -85, 85)
      rig.lon += de / (111320 * Math.max(0.05, Math.cos((rig.lat * Math.PI) / 180)))
      rig.lastInput = now
    }

    // idle auto-rotation
    if (prefs.autoRotate && introDone && !state.selection && !rig.flying && !rig.ground && now - rig.lastInput > 7000 && !state.reducedMotion) {
      rig.lon += dt * 1.6 * prefs.rotateSpeed * Math.min(1, (now - rig.lastInput - 7000) / 3000)
    }
    world.view[0] = rig.lon
    world.view[1] = rig.lat

    // frame the globe below the time bar, and left of the panel when one is open
    const desktop = size.width >= 768
    const wantX = state.selection && desktop ? 210 : 0
    const wantY = desktop ? -size.height * 0.055 : state.selection ? size.height * 0.2 : -size.height * 0.04
    const k = 1 - Math.exp(-dt * 4)
    offset.current.x += (wantX - offset.current.x) * k
    offset.current.y += (wantY - offset.current.y) * k
    const cam = camera as THREE.PerspectiveCamera
    // near plane follows the height: close to the ground it must be small, and kept as large as
    // possible otherwise for depth precision
    const gb = rig.groundBlend
    // on the ground the near plane sits 30 cm from the eye (the depth buffer is reversed, so this costs nothing)
    const near = gb > 0.001 ? 0.00000005 : THREE.MathUtils.clamp((rig.dist - 1) * 0.08, 0.000004, 0.01)
    const fov = THREE.MathUtils.lerp(38, 64, THREE.MathUtils.smoothstep(gb, 0, 1))
    if (Math.abs(cam.near - near) / near > 0.05 || Math.abs(cam.fov - fov) > 0.05) {
      cam.near = near
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    cam.setViewOffset(size.width, size.height, offset.current.x, offset.current.y, size.width, size.height)

    // smooth zoom
    if (rig.zoomTo !== null) {
      if (rig.flying) rig.zoomTo = null
      else {
        rig.dist += (rig.zoomTo - rig.dist) * (1 - Math.exp(-dt * 7))
        if (Math.abs(rig.zoomTo - rig.dist) < 1e-4) rig.zoomTo = null
      }
    }

    // close to the ground the camera leans toward the horizon, so relief reads in three
    // dimensions; the lean is a horizontal offset of about 1.2× the height above the ground
    const lean = prefs.tiltClose ? 1 - THREE.MathUtils.smoothstep(rig.dist, 1.12, 1.55) : 0
    closeLean.current += (lean - closeLean.current) * (1 - Math.exp(-dt * 3))
    const L = closeLean.current
    // near the ground the lean grows toward a low, flying view (about 70° from straight down)
    const alt = rig.dist - 1
    const leanK = 1.2 + 1.6 * (1 - THREE.MathUtils.smoothstep(alt, 0.002, 0.04))
    const tilt = rig.tilt + L * alt * 57.3 * leanK
    const focus = Math.max(rig.focus, L)

    // place camera
    lonLatToVec3(rig.lon, rig.lat - tilt, 1, tmpA)
    camera.position.copy(tmpA).multiplyScalar(rig.dist)
    lonLatToVec3(rig.lon, rig.lat, 1, tmpB)
    look.copy(tmpB).multiplyScalar(focus)
    camera.up.set(0, 1, 0)
    camera.lookAt(look)
    if (gb <= 0) return

    // ---- on the ground: eye height above the terrain, looking along the heading ----
    const target = groundHeightAt(rig.lon, rig.lat) * prefs.terrain
    rig.groundH = Number.isNaN(rig.groundH) ? target : rig.groundH + (target - rig.groundH) * (1 - Math.exp(-dt * 6))
    lonLatToVec3(rig.lon, rig.lat, TILE_BASE + (rig.groundH + rig.eye) / 6371000, gPos)
    up.copy(gPos).normalize()
    east.set(0, 1, 0).cross(up).normalize()
    north.crossVectors(up, east).normalize()
    const yaw = (rig.yaw * Math.PI) / 180
    const pitch = (rig.pitch * Math.PI) / 180
    fwd.copy(east).multiplyScalar(Math.sin(yaw) * Math.cos(pitch)).addScaledVector(north, Math.cos(yaw) * Math.cos(pitch)).addScaledVector(up, Math.sin(pitch))
    gLook.copy(gPos).add(fwd)
    gMat.lookAt(gPos, gLook, up)
    gQuat.setFromRotationMatrix(gMat)
    if (gb >= 1) {
      camera.position.copy(gPos)
      camera.quaternion.copy(gQuat)
      camera.up.copy(up)
      return
    }
    // dropping in or lifting off: blend the orbit shot above with the stance on the ground
    const e = THREE.MathUtils.smoothstep(gb, 0, 1)
    camera.position.lerp(gPos, e)
    camera.quaternion.slerp(gQuat, e)
    camera.up.lerp(up, e).normalize()
  })

  return null
}

/** Pull back, travel the great circle, push in and settle at a drone angle. */
export function flyTo(toLon: number, toLat: number, toDist: number, reduced = false) {
  gsap.killTweensOf(rig)
  rig.zoomTo = null
  const from = lonLatToVec3(rig.lon, rig.lat)
  const to = lonLatToVec3(toLon, toLat)
  const ang = from.angleTo(to)
  const q0 = new THREE.Quaternion()
  const q1 = new THREE.Quaternion().setFromUnitVectors(from, to)
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const start = { dist: rig.dist, focus: rig.focus, tilt: rig.tilt }
  const pull = 0.35 + 0.9 * (ang / Math.PI)
  const p = { t: 0 }
  rig.flying = true
  if (!reduced) sound.whoosh()
  gsap.to(p, {
    t: 1,
    duration: reduced ? 0.01 : 1.4 + 0.8 * (ang / Math.PI),
    ease: 'power2.inOut',
    onUpdate: () => {
      const t = p.t
      q.slerpQuaternions(q0, q1, t)
      v.copy(from).applyQuaternion(q)
      const [lon, lat] = vec3ToLonLat(v)
      rig.lon = lon
      rig.lat = lat
      rig.dist = THREE.MathUtils.lerp(start.dist, toDist, t) + pull * Math.sin(Math.PI * Math.min(1, t * 1.15))
      const settle = gsap.parseEase('power2.inOut')(Math.max(0, (t - 0.45) / 0.55))
      rig.focus = THREE.MathUtils.lerp(start.focus, 1, settle)
      rig.tilt = THREE.MathUtils.lerp(start.tilt, 13, settle)
    },
    onComplete: () => {
      rig.flying = false
      rig.lastInput = performance.now()
    },
  })
}

/** Ease in (never out) so a region of `radiusKm` around the view fills the frame, unless the user is steering */
export function zoomToFit(radiusKm: number, tries = 12) {
  // wait for a fly-to in progress to land first
  if (rig.flying) {
    if (tries > 0) setTimeout(() => zoomToFit(radiusKm, tries - 1), 250)
    return
  }
  if (pointerOnGlobe.dragging) return
  const want = THREE.MathUtils.clamp(1 + (radiusKm / 6371) * 4.2, minDist() + 0.06, MAX_DIST)
  if (want >= rig.dist - 0.02) return
  rig.lastInput = performance.now()
  rig.zoomTo = null
  gsap.to(rig, { dist: want, duration: useTime.getState().reducedMotion ? 0.01 : 1.2, ease: 'power2.inOut' })
}
