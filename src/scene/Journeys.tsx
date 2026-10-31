// Dated movements in motion: while the time is within a voyage or march, its route is drawn
// faintly, the part already travelled glows, and a marker moves along it between dated stops
// (linear in time between stops: an honest interpolation, not a reconstructed daily track).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { JOURNEYS, journeyAt, type Journey } from '../data/journeys'
import { useTourStore } from '../ui/explore/tourStore'
import { world } from './world'

const PER_LEG_MIN = 6

function buildPath(j: Journey) {
  // great-circle points per leg; legStart[i] = index of stop i's vertex
  const pts: THREE.Vector3[] = []
  const legStart: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (let i = 0; i < j.stops.length - 1; i++) {
    legStart.push(pts.length)
    lonLatToVec3(j.stops[i].at[0], j.stops[i].at[1], 1, a)
    lonLatToVec3(j.stops[i + 1].at[0], j.stops[i + 1].at[1], 1, b)
    const ang = a.angleTo(b)
    const n = Math.max(PER_LEG_MIN, Math.ceil((ang * 180) / Math.PI / 1.2))
    const axis = new THREE.Vector3().crossVectors(a, b)
    // identical stops (a stay in one place) still get their vertices so indices line up
    for (let k = 0; k < n; k++) {
      const p = ang < 1e-6 || axis.lengthSq() < 1e-12 ? a.clone() : a.clone().applyAxisAngle(axis.normalize(), (ang * k) / n)
      pts.push(p)
    }
  }
  const last = j.stops[j.stops.length - 1].at
  legStart.push(pts.length)
  pts.push(lonLatToVec3(last[0], last[1]))
  const pos = new Float32Array(pts.length * 3)
  pts.forEach((p, i) => pos.set([p.x * 1.004, p.y * 1.004, p.z * 1.004], i * 3))
  return { pos, legStart, pts }
}

function JourneyPath({ j }: { j: Journey }) {
  const { camera, size } = useThree()
  const { pos, legStart, pts } = useMemo(() => buildPath(j), [j])
  const objs = useMemo(() => {
    const color = new THREE.Color(j.color)
    const mk = (opacity: number) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
      const l = new THREE.Line(g, m)
      l.renderOrder = 9
      l.raycast = () => {}
      return l
    }
    return { all: mk(0.22), done: mk(0.95) }
  }, [pos, j.color])
  useEffect(
    () => () => {
      for (const l of [objs.all, objs.done]) {
        l.geometry.dispose()
        ;(l.material as THREE.Material).dispose()
      }
    },
    [objs],
  )
  const head = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const host = document.getElementById('globe-events')
    if (!host) return
    const el = document.createElement('div')
    el.className = 'journey-head'
    el.style.setProperty('--c', j.color)
    el.innerHTML = `<span class="dot"></span><span class="txt">${j.name}</span>`
    host.appendChild(el)
    head.current = el
    return () => el.remove()
  }, [j])
  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const at = journeyAt(j, world.t)
    const tourOn = useTourStore.getState().tour === j.id
    const show = (at || tourOn) && world.drift < 0.05 ? 1 : 0
    ;(objs.all.material as THREE.LineBasicMaterial).opacity = 0.22 * show * (1 - world.dim * 0.5)
    ;(objs.done.material as THREE.LineBasicMaterial).opacity = 0.95 * show
    const el = head.current
    if (!at || !show) {
      objs.done.geometry.setDrawRange(0, 0)
      if (el) el.style.opacity = '0'
      return
    }
    const i0 = legStart[at.leg]
    const i1 = legStart[at.leg + 1]
    const idx = i0 + (i1 - i0) * at.f
    const whole = Math.floor(idx)
    objs.done.geometry.setDrawRange(0, whole + 1)
    const p = pts[Math.min(pts.length - 1, whole)].clone().lerp(pts[Math.min(pts.length - 1, whole + 1)], idx - whole).normalize()
    if (!el) return
    camDir.copy(camera.position).normalize()
    const facing = p.dot(camDir)
    v.copy(p).multiplyScalar(1.006).project(camera)
    el.style.opacity = THREE.MathUtils.smoothstep(facing, 0.15, 0.4).toFixed(2)
    el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`
  })
  return (
    <>
      <primitive object={objs.all} />
      <primitive object={objs.done} />
    </>
  )
}

export function JourneysLayer() {
  return (
    <>
      {JOURNEYS.filter((j) => j.path).map((j) => (
        <JourneyPath key={j.id} j={j} />
      ))}
    </>
  )
}
