// Historical political borders and polity labels for the snapshot at time T, crossfading into the
// next snapshot near the end of each interval. Borders the sources mark as approximate (peoples and
// cultures, everything before 3400 BCE) are drawn dashed and fainter, so certainty reads at a glance.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { getSnapshot, historyYears, loadHistoryIndex, loadSnapshot, onHistoryChange, snapshotIndexAt, snapshotPair, type Snapshot } from '../data/history'
import { lonLatToVec3 } from '../geo/sphere'
import { world } from './world'
import { loadEntityIndex } from '../data/entities'
import { useTime } from '../time/store'
import { settings, useSettings } from '../time/settings'

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
// Borders at the default thickness are native GL lines (one pixel, smoothed by the composer's
// multisampling): cheap enough to keep 60 fps. Thicker borders, chosen in Settings, switch to
// screen-space lines (three's LineSegments2), which hold any pixel width but cost far more.
// Approximate borders are dashed either way.
type BorderLine = THREE.LineSegments | LineSegments2
const lineCache = new Map<string, BorderLine>()
const LIFT = 1.0018
/** pixel width above which the fat lines are used */
export const FAT_FROM = 1.5

function snapshotLines(snap: Snapshot, soft: boolean, fat: boolean): BorderLine {
  const key = `${snap.year}${soft ? 's' : ''}${fat ? 'f' : ''}`
  let l = lineCache.get(key)
  if (l) {
    // most recently used last, so eviction below drops what was seen longest ago
    lineCache.delete(key)
    lineCache.set(key, l)
    return l
  }
  const src = soft ? snap.soft : snap.segments
  const pos = new Float32Array(src.length)
  for (let i = 0; i < src.length; i++) pos[i] = src[i] * LIFT
  const color = soft ? 0xe9dcc4 : 0xd6ecff
  if (fat) {
    const g = new LineSegmentsGeometry()
    g.setPositions(pos)
    const m = new LineMaterial({ color, linewidth: 2, transparent: true, depthWrite: false, opacity: 0, dashed: soft, dashSize: 0.004, gapSize: 0.0033 })
    const f = new LineSegments2(g, m)
    if (soft) f.computeLineDistances()
    l = f
  } else {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const m = soft
      ? new THREE.LineDashedMaterial({ color, transparent: true, depthWrite: false, opacity: 0, dashSize: 0.004, gapSize: 0.0033 })
      : new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, opacity: 0 })
    const t = new THREE.LineSegments(g, m)
    if (soft) t.computeLineDistances()
    l = t
  }
  l.renderOrder = 3
  l.raycast = () => {}
  l.frustumCulled = false
  lineCache.set(key, l)
  // scrubbing through centuries would otherwise keep every year's lines on the GPU
  for (const [k, old] of lineCache) {
    if (lineCache.size <= 24) break
    old.geometry.dispose()
    ;(old.material as THREE.Material).dispose()
    lineCache.delete(k)
  }
  return l
}

/** One snapshot's firm and dashed lines, faded by the parent */
function SnapshotLines({ snap, lines }: { snap: Snapshot; lines: { firm: React.RefObject<BorderLine | null>; soft: React.RefObject<BorderLine | null> } }) {
  const fat = useSettings((s) => s.borderWidth > FAT_FROM)
  const firm = snap.segments.length > 0 ? snapshotLines(snap, false, fat) : null
  const soft = snap.soft.length > 0 ? snapshotLines(snap, true, fat) : null
  lines.firm.current = firm
  lines.soft.current = soft
  return (
    <>
      {firm && <primitive object={firm} />}
      {soft && <primitive object={soft} />}
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
  const a = { firm: useRef<BorderLine>(null), soft: useRef<BorderLine>(null) }
  const b = { firm: useRef<BorderLine>(null), soft: useRef<BorderLine>(null) }
  const { camera } = useThree()

  useFrame(() => {
    const { f } = snapshotPair(world.t)
    const fade = cur === null ? 0 : THREE.MathUtils.smoothstep(f, 0.82, 1)
    const prefs = settings()
    const base = 0.3 * prefs.borderBrightness * world.borders * (1 - world.dim * 0.45)
    // dashes stay roughly the same size on screen as the camera zooms
    const dash = Math.max(0.2, camera.position.length() - 1)
    for (const [m, k] of [[a, 1 - fade], [b, fade]] as const) {
      for (const [line, soft] of [[m.firm.current, false], [m.soft.current, true]] as const) {
        if (!line) continue
        const mat = line.material as THREE.Material & { opacity: number }
        // fat lines cover more pixels at their edges, so they need a little more opacity to match
        const gain = mat instanceof LineMaterial ? 1.6 : 1.1
        mat.opacity = soft ? (prefs.approxBorders ? Math.min(1, base * gain * 0.9) * k : 0) : Math.min(1, base * gain) * k
        line.visible = mat.opacity > 0.003
        if (mat instanceof LineMaterial) {
          mat.linewidth = prefs.borderWidth * (soft ? 0.9 : 1)
          if (soft) mat.dashScale = 1 / dash
        } else if (mat instanceof THREE.LineDashedMaterial) mat.scale = 1 / dash
      }
    }
  })

  return (
    <group>
      <CompareGhost version={version} />
      {curSnap && <SnapshotLines key={`a${curSnap.year}`} snap={curSnap} lines={a} />}
      {nextSnap && nextSnap !== curSnap && <SnapshotLines key={`b${nextSnap.year}`} snap={nextSnap} lines={b} />}
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
    const vis = settings().borderLabels ? world.borders * (1 - world.dim) : 0
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
