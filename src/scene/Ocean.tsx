// The sea as seen from the shore: while standing on the ground, a curved sheet of water at sea
// level around the viewer, with wind waves perturbing its normal, the sun's glitter and the sky
// reflected at grazing angles. It sits just under the terrain tiles, which let it show through
// where their photo shows sea at sea level (TerrainTiles.tsx).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from './CameraRig'
import { TILE_BASE } from './TerrainTiles'
import { SUN } from './world'
import { horizonColour } from './GroundSky'

const R = 6371000
const tmpUp = new THREE.Vector3()
const tmpEast = new THREE.Vector3()
const tmpSouth = new THREE.Vector3()
const RADIUS_M = 160000
const RINGS = 48
const SEGS = 96

// Everything is worked in the sheet's own frame (x east, y up, z south, metres), where the numbers
// stay small: in world units a float32 only resolves 40 cm, which shows as facets on the water.
const vert = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position * ${R}.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const frag = /* glsl */ `
uniform vec3 uSunL;
uniform vec3 uCamL;
uniform vec3 uHaze;
uniform float uTime;
uniform float uOpacity;
varying vec3 vLocal;
void main() {
  vec3 toCam = uCamL - vLocal;
  float dm = length(toCam);
  vec3 V = toCam / max(dm, 0.01);
  vec3 uUp = vec3(0.0, 1.0, 0.0);
  vec3 uEast = vec3(1.0, 0.0, 0.0);
  vec3 uNorth = vec3(0.0, 0.0, -1.0);
  vec3 uSun = uSunL;
  // wave trains, metres and seconds
  vec2 p = vLocal.xz;
  float t = uTime;
  float w1 = sin(dot(p, vec2(0.21, 0.08)) + t * 1.3);
  float w2 = sin(dot(p, vec2(-0.09, 0.17)) + t * 0.9);
  float w3 = sin(dot(p, vec2(0.6, 0.45)) * 0.7 + t * 2.1);
  float w4 = sin(dot(p, vec2(-1.3, 0.9)) + t * 2.9);
  // the slope of the waves tilts the normal; far away the detail averages out
  float amp = 0.06 * (1.0 - smoothstep(2000.0, 40000.0, dm));
  vec3 N = normalize(uUp + (uEast * (w1 * 0.21 + w3 * 0.3 + w4 * 0.2) + uNorth * (w2 * 0.17 + w3 * 0.25 - w4 * 0.14)) * amp);
  float se = dot(uSun, uUp);
  float day = smoothstep(-0.12, 0.12, se);
  // water lit from within (blue-green scattering), and the sky reflected, more at grazing angles
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 deep = vec3(0.05, 0.2, 0.28) * (0.2 + 0.8 * day);
  vec3 skyRef = uHaze * (0.6 + 0.4 * day);
  vec3 col = mix(deep, skyRef, 0.35 + 0.6 * fres);
  // sun glitter
  vec3 H = normalize(uSun + V);
  float nh = max(dot(N, H), 0.0);
  float glint = pow(nh, 900.0) * 2.2 + pow(nh, 80.0) * 0.12;
  col += vec3(1.0, 0.95, 0.85) * glint * day * step(0.0, se);
  // fade into the haze with distance, as the land does
  float haze = 1.0 - exp(-dm / 45000.0);
  col = mix(col, uHaze, haze * 0.78);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function Ocean() {
  const geo = useMemo(() => {
    // a disc of rings, denser near the centre, bent down to follow the planet's curve
    const pos: number[] = []
    const idx: number[] = []
    pos.push(0, 0, 0)
    for (let r = 1; r <= RINGS; r++) {
      const rad = RADIUS_M * Math.pow(r / RINGS, 2.4)
      const drop = (rad * rad) / (2 * R)
      for (let s = 0; s < SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2
        pos.push((Math.cos(a) * rad) / R, -drop / R, (Math.sin(a) * rad) / R)
      }
    }
    for (let s = 0; s < SEGS; s++) idx.push(0, 1 + ((s + 1) % SEGS), 1 + s)
    for (let r = 1; r < RINGS; r++)
      for (let s = 0; s < SEGS; s++) {
        const a = 1 + (r - 1) * SEGS + s
        const b = 1 + (r - 1) * SEGS + ((s + 1) % SEGS)
        const c = a + SEGS
        const d = b + SEGS
        idx.push(a, b, c, b, d, c)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uSunL: { value: new THREE.Vector3() },
          uCamL: { value: new THREE.Vector3() },
          uHaze: { value: new THREE.Color() },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
        transparent: true,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const mesh = useRef<THREE.Mesh>(null)
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__ocean = mat
  const basis = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ camera, clock }) => {
    const m = mesh.current
    if (!m) return
    const u = mat.uniforms
    u.uOpacity.value += (rig.groundBlend - u.uOpacity.value) * 0.2
    m.visible = u.uOpacity.value > 0.02
    if (!m.visible) return
    // centred under the viewer at sea level, x east, y up, z south
    const up = tmpUp.copy(camera.position).normalize()
    const east = tmpEast.set(0, 1, 0).cross(up).normalize()
    const south = tmpSouth.crossVectors(east, up).normalize()
    m.position.copy(up).multiplyScalar(TILE_BASE - 0.3 / R)
    basis.makeBasis(east, up, south)
    m.quaternion.setFromRotationMatrix(basis)
    m.updateMatrixWorld()
    // the camera and the sun in the sheet's frame, in metres (computed in double precision here)
    const cl = (u.uCamL.value as THREE.Vector3).copy(camera.position).sub(m.position)
    cl.set(cl.dot(east), cl.dot(up), cl.dot(south)).multiplyScalar(R)
    ;(u.uSunL.value as THREE.Vector3).set(SUN.dot(east), SUN.dot(up), SUN.dot(south))
    u.uTime.value = clock.elapsedTime
    horizonColour(camera.position, u.uHaze.value as THREE.Color)
  })
  return <mesh ref={mesh} geometry={geo} material={mat} raycast={() => null} frustumCulled={false} renderOrder={2} visible={false} />
}
