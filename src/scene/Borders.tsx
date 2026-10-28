// Historical political borders and polity labels for the snapshot at time T, crossfading into the
// next snapshot near the end of each interval.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getSnapshot, historyYears, loadHistoryIndex, loadSnapshot, onHistoryChange, snapshotIndexAt, snapshotPair, type Snapshot } from '../data/history'
import { lonLatToVec3 } from '../geo/sphere'
import { world } from './world'
import { useTime } from '../time/store'

const vtx = /* glsl */ `
uniform float uLift;
varying float vFacing;
void main() {
  vec3 p = normalize(position);
  vec4 w = modelMatrix * vec4(p * uLift, 1.0);
  vFacing = dot(normalize(cameraPosition - w.xyz), p);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFacing;
void main() { gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.02, 0.3, vFacing)); }
`

const geoCache = new Map<number, THREE.BufferGeometry>()

/** Ring list -> line segments on the unit sphere, densified so long edges follow the curve */
export function ringsToSegments(rings: number[][][], maxStep = 1.2): Float32Array {
  const out: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      // skip edges that run along the antimeridian / pole cut lines
      if ((Math.abs(x1) === 180 && x1 === x2) || (Math.abs(y1) >= 89.9 && Math.abs(y2) >= 89.9)) continue
      lonLatToVec3(x1, y1, 1, a)
      lonLatToVec3(x2, y2, 1, b)
      const steps = Math.max(1, Math.ceil((a.angleTo(b) * 180) / Math.PI / maxStep))
      p.copy(a)
      for (let s = 1; s <= steps; s++) {
        q.copy(a).lerp(b, s / steps).normalize()
        out.push(p.x, p.y, p.z, q.x, q.y, q.z)
        p.copy(q)
      }
    }
  }
  return new Float32Array(out)
}

function snapshotGeometry(snap: Snapshot) {
  let g = geoCache.get(snap.year)
  if (!g) {
    const rings: number[][][] = []
    for (const pol of snap.polities) for (const poly of pol.polys) rings.push(...poly)
    g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(ringsToSegments(rings), 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.01)
    geoCache.set(snap.year, g)
  }
  return g
}

function useSnapshotVersion() {
  const [v, setV] = useState(0)
  useEffect(() => {
    loadHistoryIndex()
    return onHistoryChange(() => setV((x) => x + 1))
  }, [])
  return v
}

export function Borders() {
  const version = useSnapshotVersion()
  const idx = useTime((s) => snapshotIndexAt(s.time))
  const cur = idx >= 0 ? historyYears[idx] : null
  const next = historyYears[idx + 1] ?? null

  useEffect(() => {
    if (cur !== null) loadSnapshot(cur)
    if (next !== null) loadSnapshot(next)
  }, [cur, next, version])

  const curSnap = cur !== null ? getSnapshot(cur) : undefined
  const nextSnap = next !== null ? getSnapshot(next) : undefined
  const matA = useRef<THREE.ShaderMaterial>(null)
  const matB = useRef<THREE.ShaderMaterial>(null)
  const uA = useMemo(() => ({ uLift: { value: 1.0018 }, uColor: { value: new THREE.Color('#d6ecff') }, uOpacity: { value: 0 } }), [])
  const uB = useMemo(() => ({ uLift: { value: 1.0018 }, uColor: { value: new THREE.Color('#d6ecff') }, uOpacity: { value: 0 } }), [])

  useFrame(() => {
    const { f } = snapshotPair(world.t)
    const fade = cur === null ? 0 : THREE.MathUtils.smoothstep(f, 0.82, 1)
    const base = 0.3 * world.borders * (1 - world.dim * 0.45)
    if (matA.current) matA.current.uniforms.uOpacity.value = base * (1 - fade)
    if (matB.current) matB.current.uniforms.uOpacity.value = base * fade
  })

  return (
    <group>
      {curSnap && (
        <lineSegments geometry={snapshotGeometry(curSnap)} raycast={() => null} renderOrder={3}>
          <shaderMaterial ref={matA} vertexShader={vtx} fragmentShader={frag} uniforms={uA} transparent depthWrite={false} />
        </lineSegments>
      )}
      {nextSnap && nextSnap !== curSnap && (
        <lineSegments geometry={snapshotGeometry(nextSnap)} raycast={() => null} renderOrder={3}>
          <shaderMaterial ref={matB} vertexShader={vtx} fragmentShader={frag} uniforms={uB} transparent depthWrite={false} />
        </lineSegments>
      )}
      {curSnap && <Labels snap={curSnap} />}
    </group>
  )
}

/** Polity names as crisp DOM text, projected each frame. Writes into #globe-labels. */
function Labels({ snap }: { snap: Snapshot }) {
  const { camera, size } = useThree()
  const nodes = useRef<{ el: HTMLDivElement; pos: THREE.Vector3; area: number }[]>([])

  useEffect(() => {
    const host = document.getElementById('globe-labels')
    if (!host) return
    const list = snap.polities
      .filter((p) => p.name && p.area > 0.0009)
      .sort((a, b) => b.area - a.area)
      .slice(0, 70)
    nodes.current = list.map((p) => {
      const el = document.createElement('div')
      el.className = 'globe-label'
      el.textContent = p.name
      const s = Math.min(1.25, 0.72 + Math.sqrt(p.area) * 1.2)
      el.style.setProperty('--s', s.toFixed(2))
      el.setAttribute('aria-hidden', 'true')
      host.appendChild(el)
      return { el, pos: lonLatToVec3(p.label[0], p.label[1], 1.01), area: p.area }
    })
    return () => nodes.current.forEach((n) => n.el.remove())
  }, [snap])

  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__labels = { nodes: nodes.current, cam: camera.position.toArray() }
    const vis = world.borders * (1 - world.dim)
    const zoom = camera.position.length()
    camDir.copy(camera.position).normalize()
    for (const n of nodes.current) {
      const facing = n.pos.dot(camDir) / 1.01
      // smaller polities only appear as the camera gets closer
      const need = n.area > 0.02 ? 0 : n.area > 0.006 ? 2.9 : 2.2
      const zoomOk = need === 0 || zoom < need
      const a = vis * THREE.MathUtils.smoothstep(facing, 0.45, 0.75) * (zoomOk ? 1 : 0)
      if (a < 0.02) {
        if (n.el.style.opacity !== '0') n.el.style.opacity = '0'
        continue
      }
      v.copy(n.pos).project(camera)
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      n.el.style.opacity = a.toFixed(2)
      n.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    }
  })
  return null
}

export { historyYears }
