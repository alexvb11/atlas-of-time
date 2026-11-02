// Spreads in motion (src/data/spreads.ts): while the time is within a spread, each place lights up
// in the year it was reached and an arc grows to it from where the arrival came, so a plague or an
// invention can be watched moving across the map. Click a place to read about the spread.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { SPREADS, spreadAlpha, type Spread } from '../data/spreads'
import { settings } from '../time/settings'
import { useReader } from '../ui/wiki/store'
import { formatYear } from '../time/format'
import { world } from './world'

const SEG = 48

/** a great-circle arc from a to b that rises a little above the ground in the middle */
function arc(a: [number, number], b: [number, number]) {
  const va = lonLatToVec3(a[0], a[1])
  const vb = lonLatToVec3(b[0], b[1])
  const ang = va.angleTo(vb)
  const pts = new Float32Array((SEG + 1) * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i <= SEG; i++) {
    const f = i / SEG
    v.copy(va).lerp(vb, f).normalize().multiplyScalar(1.004 + Math.sin(Math.PI * f) * ang * 0.08)
    pts.set([v.x, v.y, v.z], i * 3)
  }
  return pts
}

function SpreadView({ s }: { s: Spread }) {
  const { camera, size } = useThree()
  const lines = useMemo(
    () =>
      s.points.map((p) => {
        if (p.from === undefined) return null
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(arc(s.points[p.from].at, p.at), 3))
        g.setDrawRange(0, 0)
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
        l.renderOrder = 8
        l.raycast = () => {}
        l.frustumCulled = false
        return l
      }),
    [s],
  )
  useEffect(
    () => () =>
      lines.forEach((l) => {
        l?.geometry.dispose()
        ;(l?.material as THREE.Material | undefined)?.dispose()
      }),
    [lines],
  )
  const dots = useRef<HTMLButtonElement[]>([])
  useEffect(() => {
    const host = document.getElementById('globe-events')
    if (!host) return
    dots.current = s.points.map((p, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'spread-dot'
      el.style.setProperty('--c', s.color)
      el.innerHTML = `<span class="ring"></span><span class="dot"></span><span class="txt">${i === 0 ? `<b>${s.name}</b> · ` : ''}${p.place}, ${p.approx ? 'c. ' : ''}${formatYear(p.t)}</span>`
      el.setAttribute('aria-label', `${s.name}: ${p.place}, ${formatYear(p.t)}`)
      el.onclick = () => useReader.getState().open(s.article)
      el.style.opacity = '0'
      el.style.visibility = 'hidden'
      host.appendChild(el)
      return el
    })
    return () => dots.current.forEach((d) => d.remove())
  }, [s])

  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const t = world.t
    const a = settings().spreads && world.drift < 0.02 ? spreadAlpha(s, t) * (1 - world.dim * 0.6) : 0
    camDir.copy(camera.position).normalize()
    s.points.forEach((p, i) => {
      const l = lines[i]
      if (l) {
        const from = s.points[p.from!].t
        const f = THREE.MathUtils.clamp((t - from) / Math.max(1e-3, p.t - from), 0, 1)
        l.geometry.setDrawRange(0, Math.round(f * SEG) + 1)
        ;(l.material as THREE.LineBasicMaterial).opacity = a * 0.85 * (f > 0 ? 1 : 0)
        l.visible = a > 0.01 && f > 0
      }
      const el = dots.current[i]
      if (!el) return
      const reached = t >= p.t
      lonLatToVec3(p.at[0], p.at[1], 1.004, v)
      const facing = v.dot(camDir) / 1.004
      const op = reached ? a * THREE.MathUtils.smoothstep(facing, 0.15, 0.4) : 0
      el.style.opacity = op.toFixed(2)
      el.style.visibility = op < 0.02 ? 'hidden' : 'visible'
      el.style.pointerEvents = op > 0.3 ? 'auto' : 'none'
      // the newest arrivals pulse for a little while
      el.classList.toggle('fresh', reached && t - p.t < Math.max(0.4, (s.points[s.points.length - 1].t - s.points[0].t) * 0.06))
      if (op < 0.02) return
      v.project(camera)
      el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`
    })
  })
  return (
    <>
      {lines.map((l, i) => (l ? <primitive key={i} object={l} /> : null))}
    </>
  )
}

export function SpreadsLayer() {
  return (
    <>
      {SPREADS.map((s) => (
        <SpreadView key={s.id} s={s} />
      ))}
    </>
  )
}
