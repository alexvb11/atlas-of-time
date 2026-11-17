// Dramatised effects for Moments (src/data/moments.ts): an ash column rising from a point, as a
// cloud of soft particles. Shown only while the Moment that asks for it is playing, and said on
// screen to be a dramatisation.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { MOMENTS } from '../data/moments'
import { useMomentStore } from '../ui/explore/momentStore'
import { TILE_BASE } from './TerrainTiles'
import { SUN } from './world'

const R = 6371000
const COUNT = 900

const vert = /* glsl */ `
attribute float aSeed;
attribute float aPhase;
uniform float uTime;
uniform float uHeight;
uniform vec3 uUp;
uniform vec3 uEast;
uniform vec3 uNorth;
uniform float uPixelRatio;
uniform float uGrow;
varying float vAlpha;
varying float vShade;
void main() {
  // each particle climbs the column, spreads as it rises and widens into the umbrella at the top
  float p = fract(aPhase + uTime * 0.012 * (0.7 + 0.6 * aSeed));
  p = min(p, uGrow);
  float h = p * uHeight;
  float a = aSeed * 6.2832 * 7.0;
  float spread = mix(600.0, 2400.0, p) + smoothstep(0.7, 1.0, p) * 9000.0 * (0.4 + 0.6 * fract(aSeed * 13.1));
  float r = spread * (0.3 + 0.7 * fract(aSeed * 7.7));
  vec3 off = (uEast * cos(a) + uNorth * sin(a)) * r + uUp * h;
  vec4 w = modelMatrix * vec4(position + off / ${R}.0, 1.0);
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  float size = mix(900.0, 3200.0, p) / ${R}.0;
  gl_PointSize = size * uPixelRatio * 900.0 / max(-mv.z, 1e-7) * 0.5;
  gl_PointSize = min(gl_PointSize, 420.0 * uPixelRatio);
  vAlpha = 0.42 * (1.0 - smoothstep(0.92, 1.0, p)) * smoothstep(0.0, 0.02, p);
  vShade = 0.35 + 0.45 * fract(aSeed * 3.3) + 0.3 * p;
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uLit;
varying float vAlpha;
varying float vShade;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q);
  if (d > 1.0) discard;
  float a = vAlpha * pow(1.0 - d, 3.0);
  vec3 c = uColor * vShade * (0.4 + 0.6 * uLit);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function GroundFx() {
  const momentId = useMomentStore((s) => s.moment)
  const m = MOMENTS.find((x) => x.id === momentId)
  const fx = m?.fx
  const points = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(COUNT * 3), 3))
    const seed = new Float32Array(COUNT)
    const phase = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      seed[i] = Math.random()
      phase[i] = Math.random()
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uTime: { value: 0 },
          uHeight: { value: 30000 },
          uUp: { value: new THREE.Vector3() },
          uEast: { value: new THREE.Vector3() },
          uNorth: { value: new THREE.Vector3() },
          uPixelRatio: { value: Math.min(2, window.devicePixelRatio) },
          uGrow: { value: 0 },
          uColor: { value: new THREE.Color(0.42, 0.36, 0.32) },
          uLit: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
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
  const started = useRef(0)
  useEffect(() => {
    started.current = performance.now()
  }, [momentId])

  useFrame((state) => {
    const p = points.current
    if (!p) return
    p.visible = !!fx
    if (!fx) return
    const u = mat.uniforms
    lonLatToVec3(fx.at[0], fx.at[1], TILE_BASE + fx.elev / R, p.position)
    const up = (u.uUp.value as THREE.Vector3).copy(p.position).normalize()
    const east = (u.uEast.value as THREE.Vector3).set(0, 1, 0).cross(up).normalize()
    ;(u.uNorth.value as THREE.Vector3).crossVectors(up, east).normalize()
    u.uHeight.value = fx.height
    u.uTime.value = state.clock.elapsedTime
    // the column climbs over the first half minute of the scene
    u.uGrow.value = Math.min(1, (performance.now() - started.current) / 30000)
    u.uLit.value = THREE.MathUtils.smoothstep(up.dot(SUN), -0.1, 0.2)
  })
  return <points ref={points} geometry={geo} material={mat} raycast={() => null} frustumCulled={false} renderOrder={5} visible={false} />
}
