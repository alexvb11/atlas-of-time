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
import { groundHeightAt, TILE_BASE } from './TerrainTiles'
import { SUN, world } from './world'
import { horizonColour } from './GroundSky'

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
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  // the model's own frame in metres: x east, y up, z south
  vLocal = position * 6371000.0;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSun;
uniform vec3 uUp;
uniform vec3 uSky;
uniform float uOpacity;
uniform float uCourse;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vWorld;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 N = normalize(vN);
  float sunUp = dot(uSun, uUp);
  float day = smoothstep(-0.12, 0.15, sunUp);
  // direct sun, a soft sky light on upward faces, a little bounce from the ground on downward ones
  float l = max(dot(N, uSun), 0.0) * day;
  float skyL = 0.5 + 0.5 * dot(N, uUp);
  vec3 light = vec3(1.0, 0.96, 0.9) * l * 1.05 + uSky * skyL * 0.9 + vec3(0.25, 0.2, 0.15) * (0.5 - 0.5 * dot(N, uUp)) * day * 0.6;
  // courses of masonry: faint joints every uCourse metres, a little tonal variety per block
  float cy = vLocal.y / uCourse;
  float joint = 1.0 - 0.14 * smoothstep(0.92, 1.0, fract(cy)) * (1.0 - smoothstep(0.0, 0.08, fract(cy)));
  float along = (abs(N.x) > abs(N.z) ? vLocal.z : vLocal.x) / (uCourse * 2.2);
  float block = 0.92 + 0.16 * hash(vec3(floor(cy), floor(along + 0.5 * mod(floor(cy), 2.0)), 0.0));
  // weathering: darker toward the ground, as rain and dust settle
  float ao = 0.72 + 0.28 * smoothstep(0.0, 12.0, vLocal.y);
  vec3 c = uColor * light * joint * block * ao;
  // aerial perspective, as for the terrain
  float dkm = length(cameraPosition - vWorld) * 6371.0;
  float camKm = (length(cameraPosition) - 1.0) * 6371.0;
  float haze = (1.0 - exp(-dkm / 45.0)) * 0.78 * (1.0 - smoothstep(0.4, 25.0, camKm));
  c = mix(c, uSky, haze);
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
        uniforms: { uColor: { value: new THREE.Color(l.color).convertSRGBToLinear() }, uSun: { value: SUN }, uUp: { value: lonLatToVec3(l.at[0], l.at[1], 1) }, uSky: { value: new THREE.Color(0.66, 0.77, 0.9) }, uOpacity: { value: 1 }, uCourse: { value: l.course ?? 1.2 } },
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
    horizonColour(camera.position, mat.uniforms.uSky.value as THREE.Color)
    // stand on the ground: the loaded terrain when there is some, else the known elevation
    const ground = Math.max(groundHeightAt(l.at[0], l.at[1]), l.elev)
    lonLatToVec3(l.at[0], l.at[1], TILE_BASE + (ground * prefs.terrain) / R + 0.0000002, m.position)
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
