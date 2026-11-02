// Custom orbit rig. One plain object (`rig`) describes the shot; GSAP tweens it for cinematic
// moves and pointer input nudges it with inertia. Camera = point south of the target at `tilt`,
// looking at a blend between the globe centre and the target surface point (`focus`).
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { settings } from '../time/settings'
import { world } from './world'
import gsap from 'gsap'
import { lonLatToVec3, vec3ToLonLat } from '../geo/sphere'
import { useTime } from '../time/store'
import { selectionWorldPosition } from './selectionTrack'
import { sound } from '../ui/sound'

export const rig = {
  lon: 20,
  lat: 22,
  dist: 4.3,
  focus: 0,
  tilt: 0,
  flying: false,
  lastInput: 0,
  autoRotate: true,
}
export const pointerOnGlobe = { dragging: false }
// dev, or ?qa in production builds, for the screenshot scripts
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) (window as unknown as { __rig: typeof rig }).__rig = rig

export const DEFAULT_DIST = 4.3
const MIN_DIST = 1.22
const MAX_DIST = 7

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const look = new THREE.Vector3()

export function CameraRig() {
  const { camera, gl, size } = useThree()
  const offset = useRef({ x: 0, y: 0 })
  const vel = useRef({ lon: 0, lat: 0 })
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
        if (pinch0 > 0) rig.dist = THREE.MathUtils.clamp(dist0 * (pinch0 / d), MIN_DIST, MAX_DIST)
        return
      }
      moved += Math.abs(dx) + Math.abs(dy)
      if (moved > 4) pointerOnGlobe.dragging = true
      if (rig.flying) return
      const k = (0.16 * (rig.dist - 0.9)) / Math.max(1, el.clientHeight / 900)
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
      rig.dist = THREE.MathUtils.clamp(rig.dist * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST)
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

  // ---- cinematic fly-to along the great circle ----
  useEffect(() => {
    if (!flyNonce) return
    const sel = useTime.getState().selection
    if (!sel) return
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

    // idle auto-rotation
    const prefs = settings()
    if (prefs.autoRotate && introDone && !state.selection && !rig.flying && now - rig.lastInput > 7000 && !state.reducedMotion) {
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
    cam.setViewOffset(size.width, size.height, offset.current.x, offset.current.y, size.width, size.height)

    // place camera
    lonLatToVec3(rig.lon, rig.lat - rig.tilt, 1, tmpA)
    camera.position.copy(tmpA).multiplyScalar(rig.dist)
    lonLatToVec3(rig.lon, rig.lat, 1, tmpB)
    look.copy(tmpB).multiplyScalar(rig.focus)
    camera.up.set(0, 1, 0)
    camera.lookAt(look)
  })

  return null
}

/** Pull back, travel the great circle, push in and settle at a drone angle. */
export function flyTo(toLon: number, toLat: number, toDist: number, reduced = false) {
  gsap.killTweensOf(rig)
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
  const want = THREE.MathUtils.clamp(1 + (radiusKm / 6371) * 4.2, MIN_DIST + 0.06, MAX_DIST)
  if (want >= rig.dist - 0.02) return
  rig.lastInput = performance.now()
  gsap.to(rig, { dist: want, duration: useTime.getState().reducedMotion ? 0.01 : 1.2, ease: 'power2.inOut' })
}
