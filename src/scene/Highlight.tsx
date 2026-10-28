// Hover glow and the selected polity: a gentle extrusion with a luminous rim.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import earcut from 'earcut'
import { useTime } from '../time/store'
import { getSnapshot, historyYears, onHistoryChange, polityAt, snapshotIndexAt, type Polity } from '../data/history'
import { lonLatToVec3 } from '../geo/sphere'
import { ringsToSegments } from './Borders'
import { selectionWorldPosition } from './selectionTrack'
import { SUN, world } from './world'
import { useResolution } from '../data/useResolution'
import { useEntityIndex } from '../data/entities'

const lineVtx = /* glsl */ `
uniform float uLift;
varying float vFacing;
void main() {
  vec3 p = normalize(position);
  vec4 w = modelMatrix * vec4(p * uLift, 1.0);
  vFacing = dot(normalize(cameraPosition - w.xyz), p);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const lineFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFacing;
void main() { gl_FragColor = vec4(uColor * 1.6, uOpacity * smoothstep(0.0, 0.2, vFacing)); }
`
const fillVtx = /* glsl */ `
attribute float aTop;
uniform float uHeight;
varying vec3 vN;
varying vec3 vWorld;
varying float vTop;
void main() {
  vec3 p = normalize(position);
  float r = mix(1.0016, 1.0 + uHeight, aTop);
  vec4 w = modelMatrix * vec4(p * r, 1.0);
  vN = p;
  vWorld = w.xyz;
  vTop = aTop;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const fillFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSun;
uniform float uOpacity;
uniform float uTime;
varying vec3 vN;
varying vec3 vWorld;
varying float vTop;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
  float day = 0.55 + 0.45 * smoothstep(-0.2, 0.4, dot(normalize(vN), uSun));
  // walls glow brighter toward the top edge; the cap stays a soft translucent wash
  float wall = 1.0 - vTop;
  float a = uOpacity * (0.05 + 0.2 * fres);
  float shimmer = 0.92 + 0.08 * sin(uTime * 1.4 + vWorld.y * 30.0);
  gl_FragColor = vec4(uColor * day * shimmer, a);
}
`
const wallFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vWorld;
varying float vTop;
void main() {
  gl_FragColor = vec4(uColor * 1.4, uOpacity * (0.08 + 0.55 * vTop * vTop));
}
`

function subdivide(pos: number[], tris: number[], maxDeg: number) {
  // recursive 1->4 split of long triangles in lon/lat space; fill is translucent so tiny
  // T-junction gaps are invisible
  const out: number[] = []
  const mid = (a: number, b: number) => {
    pos.push((pos[a * 2] + pos[b * 2]) / 2, (pos[a * 2 + 1] + pos[b * 2 + 1]) / 2)
    return pos.length / 2 - 1
  }
  const len = (a: number, b: number) => Math.hypot(pos[a * 2] - pos[b * 2], pos[a * 2 + 1] - pos[b * 2 + 1])
  const rec = (a: number, b: number, c: number, depth: number) => {
    if (depth > 6 || Math.max(len(a, b), len(b, c), len(c, a)) <= maxDeg) {
      out.push(a, b, c)
      return
    }
    const x = mid(a, b), y = mid(b, c), z = mid(c, a)
    rec(a, x, z, depth + 1)
    rec(x, b, y, depth + 1)
    rec(z, y, c, depth + 1)
    rec(x, y, z, depth + 1)
  }
  for (let i = 0; i < tris.length; i += 3) rec(tris[i], tris[i + 1], tris[i + 2], 0)
  return out
}

const extrudeCache = new Map<string, { cap: THREE.BufferGeometry; walls: THREE.BufferGeometry; rim: THREE.BufferGeometry }>()

export function buildExtrusion(polity: Pick<Polity, 'id' | 'polys'>) {
  const hit = extrudeCache.get(polity.id)
  if (hit) return hit
  const capPos: number[] = []
  const capIdx: number[] = []
  const wallPos: number[] = []
  const wallTop: number[] = []
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  for (const poly of polity.polys) {
    const flat: number[] = []
    const holes: number[] = []
    poly.forEach((ring, r) => {
      if (r > 0) holes.push(flat.length / 2)
      for (const [x, y] of ring.slice(0, -1)) flat.push(x, y)
    })
    const tris = earcut(flat, holes.length ? holes : undefined, 2)
    const pos = flat.slice()
    const fine = subdivide(pos, tris, 2.5)
    const base = capPos.length / 3
    for (let i = 0; i < pos.length; i += 2) {
      lonLatToVec3(pos[i], pos[i + 1], 1, v)
      capPos.push(v.x, v.y, v.z)
    }
    for (const i of fine) capIdx.push(base + i)
    // walls along every ring
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        lonLatToVec3(ring[i][0], ring[i][1], 1, v)
        lonLatToVec3(ring[i + 1][0], ring[i + 1][1], 1, w)
        wallPos.push(v.x, v.y, v.z, w.x, w.y, w.z, w.x, w.y, w.z, v.x, v.y, v.z, w.x, w.y, w.z, v.x, v.y, v.z)
        wallTop.push(0, 0, 1, 0, 1, 1)
      }
    }
  }
  const cap = new THREE.BufferGeometry()
  cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3))
  cap.setAttribute('aTop', new THREE.Float32BufferAttribute(new Array(capPos.length / 3).fill(1), 1))
  cap.setIndex(capIdx)
  const walls = new THREE.BufferGeometry()
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3))
  walls.setAttribute('aTop', new THREE.Float32BufferAttribute(wallTop, 1))
  const rim = new THREE.BufferGeometry()
  rim.setAttribute('position', new THREE.BufferAttribute(ringsToSegments(polity.polys.flat(), 0.8), 3))
  for (const g of [cap, walls, rim]) g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.05)
  const out = { cap, walls, rim }
  extrudeCache.set(polity.id, out)
  if (extrudeCache.size > 40) {
    const k = extrudeCache.keys().next().value!
    const old = extrudeCache.get(k)!
    old.cap.dispose()
    old.walls.dispose()
    old.rim.dispose()
    extrudeCache.delete(k)
  }
  return out
}

function useHistoryVersion() {
  const [v, setV] = useState(0)
  useEffect(() => onHistoryChange(() => setV((x) => x + 1)), [])
  return v
}

/** The polity under a present-day point at the current snapshot (null in deep time / no data) */
export function usePolityAt(p: [number, number] | null): Polity | null {
  const version = useHistoryVersion()
  const idx = useTime((s) => snapshotIndexAt(s.time))
  return useMemo(() => {
    if (!p || idx < 0) return null
    const snap = getSnapshot(historyYears[idx])
    return snap ? polityAt(snap, p[0], p[1]) : null
  }, [p?.[0], p?.[1], idx, version])
}

export function Highlight() {
  const selection = useTime((s) => s.selection)
  const hoverLL = useTime((s) => s.hover?.lonlat ?? null)
  const selected = usePolityAt(selection)
  const hovered = usePolityAt(hoverLL)
  const res = useResolution()
  const idx = useEntityIndex()
  // the outline to raise: the map polygon, or the present-day territory when the curated lineage
  // speaks for a place the border data doesn't cover
  const shape = useMemo(() => {
    if (!res || !idx) return null
    const iso =
      (res.kind === 'entity' && res.outlineFromCountry && res.country?.iso3) || (res.kind === 'country' && res.country.iso3) || null
    if (iso) {
      const s = idx.countryShape(iso)
      return s ? { id: `country:${iso}`, polys: s.polys } : null
    }
    if (res.kind === 'entity' && res.polity) return res.polity
    if (res.kind === 'polity') return res.polity
    return null
  }, [res, idx])

  const heightRef = useRef(0)
  const capMat = useRef<THREE.ShaderMaterial>(null)
  const wallMat = useRef<THREE.ShaderMaterial>(null)
  const rimMat = useRef<THREE.ShaderMaterial>(null)
  const hoverMat = useRef<THREE.ShaderMaterial>(null)
  const marker = useRef<THREE.Group>(null)

  const sel = useMemo(() => (shape ? buildExtrusion(shape) : null), [shape])
  const hov = useMemo(() => {
    if (!hovered || hovered.id === selected?.id) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(ringsToSegments(hovered.polys.flat(), 0.8), 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.05)
    return g
  }, [hovered, selected])
  useEffect(() => () => hov?.dispose(), [hov])
  useEffect(() => {
    heightRef.current = 0
  }, [sel])

  const amber = useMemo(() => new THREE.Color('#ffc477'), [])
  const cyan = useMemo(() => new THREE.Color('#9fe3ff'), [])
  const uCap = useMemo(() => ({ uColor: { value: amber }, uSun: { value: SUN }, uOpacity: { value: 1 }, uHeight: { value: 0 }, uTime: { value: 0 } }), [amber])
  const uWall = useMemo(() => ({ uColor: { value: amber }, uOpacity: { value: 1 }, uHeight: { value: 0 } }), [amber])
  const uRim = useMemo(() => ({ uColor: { value: amber }, uOpacity: { value: 0.9 }, uLift: { value: 1.002 } }), [amber])
  const uHover = useMemo(() => ({ uColor: { value: cyan }, uOpacity: { value: 0 }, uLift: { value: 1.0024 } }), [cyan])

  useFrame((s, dt) => {
    const target = selection && world.borders > 0.5 ? 0.011 : 0
    heightRef.current += (target - heightRef.current) * (1 - Math.exp(-dt * 3.2))
    const h = heightRef.current
    const fade = Math.min(1, h / 0.006)
    if (capMat.current) {
      capMat.current.uniforms.uHeight.value = h
      capMat.current.uniforms.uOpacity.value = fade
      capMat.current.uniforms.uTime.value = s.clock.elapsedTime
    }
    if (wallMat.current) {
      wallMat.current.uniforms.uHeight.value = h
      wallMat.current.uniforms.uOpacity.value = fade
    }
    if (rimMat.current) {
      rimMat.current.uniforms.uLift.value = 1.0005 + h
      rimMat.current.uniforms.uOpacity.value = 0.95 * fade
    }
    if (hoverMat.current) {
      const want = world.borders > 0.5 ? 0.85 : 0
      const o = hoverMat.current.uniforms.uOpacity
      o.value += (want - o.value) * (1 - Math.exp(-dt * 12))
    }
    // pulsing location marker that rides the crust in deep time (and marks clicks with no polity)
    if (marker.current) {
      const wp = selectionWorldPosition()
      marker.current.visible = !!wp && (!sel || world.borders < 0.5)
      if (wp) {
        marker.current.position.copy(wp).multiplyScalar(1.004)
        marker.current.lookAt(wp.clone().multiplyScalar(2))
        const k = 1 + 0.25 * Math.sin(s.clock.elapsedTime * 2.4)
        marker.current.scale.setScalar(k)
      }
    }
  })

  return (
    <group>
      {sel && (
        <group renderOrder={6}>
          <mesh geometry={sel.cap} raycast={() => null} renderOrder={6}>
            <shaderMaterial ref={capMat} vertexShader={fillVtx} fragmentShader={fillFrag} uniforms={uCap} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh geometry={sel.walls} raycast={() => null} renderOrder={6}>
            <shaderMaterial ref={wallMat} vertexShader={fillVtx} fragmentShader={wallFrag} uniforms={uWall} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
          <lineSegments geometry={sel.rim} raycast={() => null} renderOrder={7}>
            <shaderMaterial ref={rimMat} vertexShader={lineVtx} fragmentShader={lineFrag} uniforms={uRim} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </lineSegments>
        </group>
      )}
      {hov && (
        <lineSegments geometry={hov} raycast={() => null} renderOrder={5}>
          <shaderMaterial ref={hoverMat} vertexShader={lineVtx} fragmentShader={lineFrag} uniforms={uHover} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
      <group ref={marker} visible={false}>
        <mesh raycast={() => null}>
          <ringGeometry args={[0.012, 0.016, 48]} />
          <meshBasicMaterial color="#ffc477" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh raycast={() => null}>
          <circleGeometry args={[0.005, 24]} />
          <meshBasicMaterial color="#fff1d6" transparent opacity={1} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
