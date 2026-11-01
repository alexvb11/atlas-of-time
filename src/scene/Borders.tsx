// Historical political borders and polity labels for the snapshot at time T, crossfading into the
// next snapshot near the end of each interval. Borders the sources mark as approximate (peoples and
// cultures, everything before 3400 BCE) are drawn dashed and fainter, so certainty reads at a glance.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getSnapshot, historyYears, loadHistoryIndex, loadSnapshot, onHistoryChange, snapshotIndexAt, snapshotPair, type Snapshot } from '../data/history'
import { lonLatToVec3 } from '../geo/sphere'
import { world } from './world'
import { loadEntityIndex } from '../data/entities'
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
const dashVtx = /* glsl */ `
uniform float uLift;
attribute float aDist;
varying float vFacing;
varying float vDist;
void main() {
  vec3 p = normalize(position);
  vDist = aDist;
  vec4 w = modelMatrix * vec4(p * uLift, 1.0);
  vFacing = dot(normalize(cameraPosition - w.xyz), p);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const dashFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDash;
varying float vFacing;
varying float vDist;
void main() {
  if (fract(vDist / uDash) > 0.55) discard;
  gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.02, 0.3, vFacing));
}
`

const geoCache = new Map<string, THREE.BufferGeometry>()

function snapshotGeometry(snap: Snapshot, soft = false) {
  const key = `${snap.year}${soft ? 's' : ''}`
  let g = geoCache.get(key)
  if (!g) {
    g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(soft ? snap.soft : snap.segments, 3))
    if (soft) g.setAttribute('aDist', new THREE.BufferAttribute(snap.softDist, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.01)
    geoCache.set(key, g)
  }
  return g
}

/** One snapshot's firm and dashed lines, faded by the parent */
function SnapshotLines({ snap, mats }: { snap: Snapshot; mats: { firm: React.RefObject<THREE.ShaderMaterial | null>; soft: React.RefObject<THREE.ShaderMaterial | null> } }) {
  const uFirm = useMemo(() => ({ uLift: { value: 1.0018 }, uColor: { value: new THREE.Color('#d6ecff') }, uOpacity: { value: 0 } }), [])
  const uSoft = useMemo(() => ({ uLift: { value: 1.0018 }, uColor: { value: new THREE.Color('#e9dcc4') }, uOpacity: { value: 0 }, uDash: { value: 0.006 } }), [])
  return (
    <>
      {snap.segments.length > 0 && (
        <lineSegments geometry={snapshotGeometry(snap)} raycast={() => null} renderOrder={3}>
          <shaderMaterial ref={mats.firm} vertexShader={vtx} fragmentShader={frag} uniforms={uFirm} transparent depthWrite={false} />
        </lineSegments>
      )}
      {snap.soft.length > 0 && (
        <lineSegments geometry={snapshotGeometry(snap, true)} raycast={() => null} renderOrder={3}>
          <shaderMaterial ref={mats.soft} vertexShader={dashVtx} fragmentShader={dashFrag} uniforms={uSoft} transparent depthWrite={false} />
        </lineSegments>
      )}
    </>
  )
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
  const a = { firm: useRef<THREE.ShaderMaterial>(null), soft: useRef<THREE.ShaderMaterial>(null) }
  const b = { firm: useRef<THREE.ShaderMaterial>(null), soft: useRef<THREE.ShaderMaterial>(null) }
  const { camera } = useThree()

  useFrame(() => {
    const { f } = snapshotPair(world.t)
    const fade = cur === null ? 0 : THREE.MathUtils.smoothstep(f, 0.82, 1)
    const base = 0.3 * world.borders * (1 - world.dim * 0.45)
    // dashes stay roughly the same size on screen as the camera zooms
    const dash = 0.0035 * Math.max(0.2, camera.position.length() - 1)
    for (const [m, k] of [[a, 1 - fade], [b, fade]] as const) {
      if (m.firm.current) m.firm.current.uniforms.uOpacity.value = base * k
      if (m.soft.current) {
        m.soft.current.uniforms.uOpacity.value = base * 0.85 * k
        m.soft.current.uniforms.uDash.value = dash
      }
    }
  })

  return (
    <group>
      <CompareGhost version={version} />
      {curSnap && <SnapshotLines key={`a${curSnap.year}`} snap={curSnap} mats={a} />}
      {nextSnap && nextSnap !== curSnap && <SnapshotLines key={`b${nextSnap.year}`} snap={nextSnap} mats={b} />}
      {curSnap && <Labels snap={curSnap} />}
    </group>
  )
}

/** "Compare two years": the other year's borders, all of them solid, in pink over the globe */
function CompareGhost({ version }: { version: number }) {
  const other = useTime((s) => s.compare)
  const idx = other === null ? -1 : snapshotIndexAt(other)
  const year = idx >= 0 ? historyYears[idx] : null
  useEffect(() => {
    if (year !== null) loadSnapshot(year)
  }, [year, version])
  const snap = year !== null ? getSnapshot(year) : undefined
  const geo = useMemo(() => {
    if (!snap) return null
    const all = new Float32Array(snap.segments.length + snap.soft.length)
    all.set(snap.segments)
    all.set(snap.soft, snap.segments.length)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(all, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.01)
    return g
  }, [snap])
  useEffect(() => () => geo?.dispose(), [geo])
  const u = useMemo(() => ({ uLift: { value: 1.0026 }, uColor: { value: new THREE.Color('#ff9ec7') }, uOpacity: { value: 0.75 } }), [])
  useFrame(() => {
    u.uOpacity.value = 0.75 * world.borders
  })
  if (!geo) return null
  return (
    <lineSegments geometry={geo} raycast={() => null} renderOrder={4}>
      <shaderMaterial vertexShader={vtx} fragmentShader={frag} uniforms={u} transparent depthWrite={false} />
    </lineSegments>
  )
}

/** Polity names as crisp DOM text, projected each frame. Writes into #globe-labels. */
function Labels({ snap }: { snap: Snapshot }) {
  const { camera, size } = useThree()
  const nodes = useRef<{ el: HTMLDivElement; pos: THREE.Vector3; area: number }[]>([])

  useEffect(() => {
    const host = document.getElementById('globe-labels')
    if (!host) return
    // groupings (the Holy Roman Empire) are labelled over their members; a grouping named like its
    // only member ("Kingdom of France") is labelled once
    const names = new Set(snap.polities.map((p) => p.name))
    const list = [
      ...snap.polities.filter((p) => p.name && p.area > 0.0009),
      ...snap.groups.filter((g) => !names.has(g.name) && g.area > 0.0009).map((g) => ({ ...g, group: true })),
    ]
      .sort((a, b) => b.area - a.area)
      .slice(0, 70)
    nodes.current = list.map((p) => {
      const el = document.createElement('div')
      el.className = 'group' in p ? 'globe-label globe-label-group' : 'globe-label'
      el.textContent = p.name
      // the border data keeps some outdated names (e.g. "Zaire" in 2010): use today's country name
      if (snap.year >= 1994)
        loadEntityIndex().then((idx) => {
          const c = idx.countryAt(p.label[0], p.label[1])
          if (c && c.name !== p.name) el.textContent = c.name
        })
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
