// Landmarks as 3D massing models (src/data/landmarks.ts), at true size on the ground, present only
// in the years they stood and changing with them. Seen when flying low; a name tag appears nearby.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { lonLatToVec3 } from '../geo/sphere'
import { LANDMARKS, phaseAt, type Landmark, type Part, type Phase } from '../data/landmarks'
import { settings } from '../time/settings'
import { useReader } from '../ui/wiki/store'
import { formatYear } from '../time/format'
import { groundHeightAt } from './TerrainTiles'
import { SUN, world } from './world'

const R = 6371000

function partGeometry(p: Part): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  const y = p.kind === 'ring' ? 0 : (p.y ?? 0)
  switch (p.kind) {
    case 'box':
      g = new THREE.BoxGeometry(p.w, p.h, p.d).translate(p.x ?? 0, y + p.h / 2, p.z ?? 0)
      break
    case 'pyramid':
      // a four-sided cone turned 45° has a square base of side radius × √2
      g = new THREE.ConeGeometry(p.w / Math.SQRT2, p.h, 4, 1).rotateY(Math.PI / 4).scale(1, 1, p.d / p.w).translate(p.x ?? 0, y + p.h / 2, p.z ?? 0)
      break
    case 'cyl':
      g = new THREE.CylinderGeometry(p.r2 ?? p.r, p.r, p.h, p.seg ?? 16).translate(p.x ?? 0, y + p.h / 2, p.z ?? 0)
      break
    case 'dome':
      g = new THREE.SphereGeometry(p.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(p.x ?? 0, y, p.z ?? 0)
      break
    case 'ring': {
      // an elliptical wall (an amphitheatre), optionally only part of the way round
      const [a0, a1] = p.arc ?? [0, 2 * Math.PI]
      const ia = p.a - p.t / 2
      const ib = p.b - (p.t / 2) * (p.b / p.a)
      const shape = new THREE.Shape()
      const n = 64
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        if (i === 0) shape.moveTo(Math.cos(a) * p.a, Math.sin(a) * p.b)
        else shape.lineTo(Math.cos(a) * p.a, Math.sin(a) * p.b)
      }
      for (let i = n; i >= 0; i--) {
        const a = a0 + ((a1 - a0) * i) / n
        shape.lineTo(Math.cos(a) * ia, Math.sin(a) * ib)
      }
      g = new THREE.ExtrudeGeometry(shape, { depth: p.h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2)
      break
    }
  }
  const ni = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(ni.attributes)) if (k !== 'position' && k !== 'normal') ni.deleteAttribute(k)
  ni.computeVertexNormals()
  return ni
}

function phaseGeometry(l: Landmark, ph: Phase) {
  const g = mergeGeometries(ph.parts.map(partGeometry))!
  if (l.turn) g.rotateY((l.turn * Math.PI) / 180)
  // metres to globe units
  g.scale(1 / R, 1 / R, 1 / R)
  return g
}

const vert = /* glsl */ `
varying vec3 vN;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSun;
uniform float uOpacity;
varying vec3 vN;
void main() {
  float l = max(dot(normalize(vN), uSun), 0.0);
  vec3 c = uColor * (0.32 + 0.85 * l);
  gl_FragColor = vec4(c, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function LandmarkView({ l }: { l: Landmark }) {
  const { camera, size } = useThree()
  const mesh = useRef<THREE.Mesh>(null)
  const phaseRef = useRef<Phase | null>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uColor: { value: new THREE.Color(l.color).convertSRGBToLinear() }, uSun: { value: SUN }, uOpacity: { value: 1 } },
        transparent: true,
      }),
    [l],
  )
  const geos = useMemo(() => new Map<Phase, THREE.BufferGeometry>(), [])
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose())
      mat.dispose()
    },
    [geos, mat],
  )
  // orientation: local x east, y up, z south at the site
  const basis = useMemo(() => {
    const up = lonLatToVec3(l.at[0], l.at[1], 1)
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize()
    const south = east.clone().cross(up).normalize()
    return new THREE.Matrix4().makeBasis(east, up, south)
  }, [l])

  const tag = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const host = document.getElementById('globe-events')
    if (!host) return
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'landmark-tag'
    el.onclick = () => useReader.getState().open(l.article)
    el.style.opacity = '0'
    el.style.visibility = 'hidden'
    host.appendChild(el)
    tag.current = el
    return () => el.remove()
  }, [l])

  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const t = world.t
    const prefs = settings()
    const alt = camera.position.length() - 1
    const ph = prefs.landmarks && world.drift < 0.01 ? phaseAt(l, t) : null
    const near = alt < 0.03
    m.visible = !!ph && near
    const el = tag.current
    if (ph && ph !== phaseRef.current) {
      phaseRef.current = ph
      let g = geos.get(ph)
      if (!g) geos.set(ph, (g = phaseGeometry(l, ph)))
      m.geometry = g
      if (el) {
        const built = l.phases[0].from
        el.innerHTML = `<span class="dot"></span><span class="txt">${l.name} <i>${built < 0 ? 'c. ' : ''}${formatYear(built)}${ph.note ? ` · ${ph.note}` : ''}</i></span>`
        el.setAttribute('aria-label', `${l.name}, ${ph.note ?? ''}. Read about it`)
      }
    }
    if (!ph || !near) {
      if (el && el.style.visibility !== 'hidden') {
        el.style.opacity = '0'
        el.style.visibility = 'hidden'
      }
      return
    }
    // stand on the ground: the loaded terrain when there is some, else the known elevation
    const ground = Math.max(groundHeightAt(l.at[0], l.at[1]), l.elev)
    lonLatToVec3(l.at[0], l.at[1], 1 + (ground * prefs.terrain) / R + 0.000001, m.position)
    m.quaternion.setFromRotationMatrix(basis)
    if (!el) return
    camDir.copy(camera.position).normalize()
    v.copy(m.position)
    // tag only landmarks within ~60 km of the camera, on the near side of the horizon
    const facing = v.clone().normalize().dot(camDir)
    const op = alt < 0.012 && facing > 0.98 && v.distanceTo(camera.position) < 0.0095 ? 1 : 0
    el.style.opacity = String(op)
    el.style.visibility = op ? 'visible' : 'hidden'
    if (!op) return
    v.project(camera)
    el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`
  })
  return <mesh ref={mesh} material={mat} raycast={() => null} frustumCulled={false} renderOrder={2} visible={false} />
}

export function LandmarksLayer() {
  return (
    <>
      {LANDMARKS.map((l) => (
        <LandmarkView key={l.id} l={l} />
      ))}
    </>
  )
}
