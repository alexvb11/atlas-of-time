// Dated events fade in as time approaches them and fade out after; historic routes glow as
// flowing arcs during their active period.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { loadCurated, loadEntityIndex } from '../data/entities'
import { yearsAgo } from '../time/scale'
import { useTime } from '../time/store'
import { world } from './world'
import { driftedPosition } from './selectionTrack'

export type GeoEvent = {
  id: string
  t: number
  title: string
  text: string
  at: [number, number]
  kind: string
  conf: 'documented' | 'estimated' | 'disputed'
  entities?: string[]
}
export type Route = { id: string; name: string; from: number; to: number; text: string; path: [number, number][]; conf: string }

let dataPromise: Promise<{ events: GeoEvent[]; routes: Route[] }> | null = null
export const loadEvents = () =>
  (dataPromise ??= loadEntityIndex().then(() => loadCurated()).then((j) => ({ events: j.events as GeoEvent[], routes: j.routes as Route[] })))

/** 0..1: how present an event is at time t. The window scales with how long ago it was. */
export function eventPresence(ev: GeoEvent, t: number) {
  const w = Math.max(3, 0.05 * yearsAgo(ev.t))
  const d = (t - ev.t) / w
  return Math.exp(-d * d)
}

export function EventsLayer() {
  const [data, setData] = useState<{ events: GeoEvent[]; routes: Route[] } | null>(null)
  useEffect(() => {
    loadEvents().then(setData)
  }, [])
  if (!data) return null
  return (
    <>
      <Markers events={data.events} />
      {data.routes.map((r) => (
        <RouteArc key={r.id} route={r} />
      ))}
    </>
  )
}

function Markers({ events }: { events: GeoEvent[] }) {
  const { camera, size } = useThree()
  const nodes = useRef<Map<string, HTMLButtonElement>>(new Map())
  useEffect(() => {
    const host = document.getElementById('globe-events')
    if (!host) return
    for (const ev of events) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `globe-event kind-${ev.kind}`
      b.setAttribute('aria-label', `${ev.title}`)
      b.innerHTML = `<span class="dot"></span><span class="txt">${ev.title}</span>`
      b.style.opacity = '0'
      b.style.pointerEvents = 'none'
      b.classList.add('off')
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        useTime.getState().set({ activeEvent: ev.id })
      })
      host.appendChild(b)
      nodes.current.set(ev.id, b)
    }
    return () => {
      nodes.current.forEach((n) => n.remove())
      nodes.current.clear()
    }
  }, [events])

  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    camDir.copy(camera.position).normalize()
    const t = world.t
    const active = useTime.getState().activeEvent
    for (const ev of events) {
      const el = nodes.current.get(ev.id)
      if (!el) continue
      const p = eventPresence(ev, t)
      if (p < 0.03 && ev.id !== active) {
        if (el.style.opacity !== '0') {
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
          el.classList.add('off')
        }
        continue
      }
      const pos = (world.drift > 0.05 && driftedPosition(ev.at, v)) || lonLatToVec3(ev.at[0], ev.at[1], 1, v)
      const facing = pos.dot(camDir)
      pos.multiplyScalar(1.006)
      const a = Math.max(ev.id === active ? 1 : 0, p) * THREE.MathUtils.smoothstep(facing, 0.2, 0.45) * (1 - world.dim * 0.5)
      v.copy(pos).project(camera)
      el.style.opacity = a.toFixed(2)
      el.style.pointerEvents = a > 0.3 ? 'auto' : 'none'
      el.classList.toggle('off', a < 0.05)
      el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`
      el.classList.toggle('near', p > 0.8)
      // what comes next is previewed quietly; what has happened is shown fully
      el.classList.toggle('future', ev.t > t)
      el.classList.toggle('active', ev.id === active)
    }
  })
  return null
}

/** Numbered pins for the events listed in the panel's Here tab */
export function HerePins() {
  const { camera, size } = useThree()
  const nodes = useRef<HTMLSpanElement[]>([])
  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const host = document.getElementById('globe-events')
    const pins = useTime.getState().herePins
    if (!host) return
    while (nodes.current.length < pins.length) {
      const el = document.createElement('span')
      el.className = 'here-pin'
      el.setAttribute('aria-hidden', 'true')
      host.appendChild(el)
      nodes.current.push(el)
    }
    camDir.copy(camera.position).normalize()
    // project, then push apart pins that would cover each other (by at most a pin's width)
    const pts = pins.map((p) => {
      const pos = (world.drift > 0.05 && driftedPosition([p.lon, p.lat], v)) || lonLatToVec3(p.lon, p.lat, 1, v)
      const facing = pos.dot(camDir)
      pos.multiplyScalar(1.006)
      v.copy(pos).project(camera)
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      return { x, y, x0: x, y0: y, facing }
    })
    const MIN = 20
    for (let it = 0; it < 4; it++)
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          let dx = pts[j].x - pts[i].x
          let dy = pts[j].y - pts[i].y
          let d = Math.hypot(dx, dy)
          if (d >= MIN) continue
          // identical points fan out by index
          if (d < 0.01) {
            dx = Math.cos(j * 2.4)
            dy = Math.sin(j * 2.4)
            d = 1
          }
          const push = (MIN - d) / 2
          pts[i].x -= (dx / d) * push
          pts[i].y -= (dy / d) * push
          pts[j].x += (dx / d) * push
          pts[j].y += (dy / d) * push
        }
    nodes.current.forEach((el, i) => {
      const p = pins[i]
      if (!p) {
        el.style.opacity = '0'
        return
      }
      const q = pts[i]
      const k = Math.min(1, 22 / Math.max(22, Math.hypot(q.x - q.x0, q.y - q.y0)))
      el.textContent = String(p.n)
      el.classList.toggle('hot', p.hot)
      el.style.opacity = THREE.MathUtils.smoothstep(q.facing, 0.15, 0.4).toFixed(2)
      el.style.transform = `translate(${(q.x0 + (q.x - q.x0) * k).toFixed(1)}px, ${(q.y0 + (q.y - q.y0) * k).toFixed(1)}px)`
    })
  })
  useEffect(
    () => () => {
      nodes.current.forEach((n) => n.remove())
      nodes.current = []
    },
    [],
  )
  return null
}

const arcVertex = /* glsl */ `
attribute float aS;
varying float vS;
varying float vFacing;
void main() {
  vS = aS;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vFacing = dot(normalize(cameraPosition - w.xyz), normalize(position));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const arcFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying float vS;
varying float vFacing;
void main() {
  float flow = fract(vS * 9.0 - uTime * 0.35);
  float pulse = smoothstep(0.0, 0.15, flow) * (1.0 - smoothstep(0.15, 0.6, flow));
  float a = uOpacity * (0.28 + 0.9 * pulse) * smoothstep(-0.05, 0.25, vFacing);
  gl_FragColor = vec4(uColor * (1.0 + pulse), a);
}
`

function RouteArc({ route }: { route: Route }) {
  const geo = useMemo(() => {
    // densify each leg along the great circle, lift into a soft arc
    const pts: THREE.Vector3[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (let i = 0; i < route.path.length - 1; i++) {
      lonLatToVec3(route.path[i][0], route.path[i][1], 1, a)
      lonLatToVec3(route.path[i + 1][0], route.path[i + 1][1], 1, b)
      const n = Math.max(4, Math.ceil((a.angleTo(b) * 180) / Math.PI / 1.5))
      for (let k = 0; k < n; k++) pts.push(a.clone().lerp(b, k / n).normalize())
    }
    const last = route.path[route.path.length - 1]
    pts.push(lonLatToVec3(last[0], last[1]))
    const total = pts.length - 1
    const pos = new Float32Array(pts.length * 3)
    const s = new Float32Array(pts.length)
    pts.forEach((p, i) => {
      const f = i / total
      p.multiplyScalar(1.004 + Math.sin(Math.PI * f) * 0.02)
      pos.set([p.x, p.y, p.z], i * 3)
      s[i] = f
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aS', new THREE.BufferAttribute(s, 1))
    return g
  }, [route])
  const line = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: arcVertex,
      fragmentShader: arcFragment,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ffc477') } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const l = new THREE.Line(geo, m)
    l.renderOrder = 8
    l.raycast = () => {}
    return l
  }, [geo])
  useEffect(() => () => (line.material as THREE.Material).dispose(), [line])
  const mat = { current: line.material as THREE.ShaderMaterial }
  useFrame((st) => {
    const t = world.t
    const span = route.to - route.from
    const edge = Math.max(10, span * 0.08)
    const vis = THREE.MathUtils.smoothstep(t, route.from - edge, route.from) * (1 - THREE.MathUtils.smoothstep(t, route.to, route.to + edge))
    mat.current.uniforms.uOpacity.value = vis * world.borders * (1 - world.dim * 0.6)
    mat.current.uniforms.uTime.value = st.clock.elapsedTime
  })
  return <primitive object={line} />
}
