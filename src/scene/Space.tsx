// Starfield (with time-warp streaking) and a faint distant nebula.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './world'

const starVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uWarp;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying vec2 vDir;
varying float vStretch;
varying float vTw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vDir = length(ndc) > 0.0001 ? normalize(ndc) : vec2(1.0, 0.0);
  vStretch = uWarp * (0.4 + length(ndc) * 1.6);
  vColor = aColor;
  vTw = 0.82 + 0.18 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
  gl_PointSize = aSize * uPixelRatio * (1.0 + vStretch * 7.0);
}
`
const starFragment = /* glsl */ `
varying vec3 vColor;
varying vec2 vDir;
varying float vStretch;
varying float vTw;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  // ellipse stretched radially from the screen centre during time warp
  float along = dot(p, vDir);
  float across = dot(p, vec2(-vDir.y, vDir.x));
  float s = 1.0 + vStretch * 7.0;
  float d = length(vec2(along, across * s));
  float a = smoothstep(1.0, 0.0, d);
  a = pow(a, 2.2) * vTw / (1.0 + vStretch * 2.0);
  gl_FragColor = vec4(vColor * a, a);
}
`

export function Stars({ count = 6500 }: { count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const phase = new Float32Array(count)
    const c = new THREE.Color()
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < count; i++) {
      // concentrate a few more stars in a soft galactic band
      const band = rnd() < 0.35
      const u = rnd() * 2 - 1
      const th = rnd() * Math.PI * 2
      let y = band ? (rnd() - 0.5) * 0.35 : u
      const r = Math.sqrt(1 - y * y)
      const v = new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th))
      v.applyAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), 1.05)
      const dist = 40 + rnd() * 50
      pos.set([v.x * dist, v.y * dist, v.z * dist], i * 3)
      const temp = rnd()
      c.setHSL(temp < 0.7 ? 0.58 + rnd() * 0.04 : 0.08 + rnd() * 0.05, temp < 0.7 ? 0.35 : 0.5, 0.75 + rnd() * 0.2)
      col.set([c.r, c.g, c.b], i * 3)
      const big = rnd()
      size[i] = big > 0.985 ? 3.6 + rnd() * 1.6 : big > 0.9 ? 2.2 + rnd() : 1.0 + rnd() * 1.1
      phase[i] = rnd()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [count])
  const uniforms = useMemo(
    () => ({ uWarp: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: Math.min(2, window.devicePixelRatio) } }),
    [],
  )
  useFrame((s) => {
    if (!mat.current) return
    mat.current.uniforms.uWarp.value = world.warp
    mat.current.uniforms.uTime.value = s.clock.elapsedTime
  })
  return (
    <points geometry={geo} raycast={() => null} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

const nebulaFragment = /* glsl */ `
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float n = fbm(d * 2.2 + vec3(3.1, 0.4, 1.7));
  float m = fbm(d * 4.0 - vec3(1.3, 2.0, 0.2));
  // keep it to one region of the sky, very faint
  float region = smoothstep(0.2, 0.95, dot(d, normalize(vec3(-0.6, 0.35, -0.7))));
  float band = smoothstep(0.45, 0.0, abs(dot(d, normalize(vec3(0.0, 0.94, 0.32)))));
  vec3 col = mix(vec3(0.05, 0.08, 0.20), vec3(0.18, 0.10, 0.22), m) * pow(n, 2.4) * (region * 1.3 + band * 0.35);
  col += vec3(0.02, 0.05, 0.09) * pow(n, 3.0) * band;
  gl_FragColor = vec4(col * 0.75, 1.0);
}
`

export function Nebula() {
  return (
    <mesh scale={120} raycast={() => null} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        vertexShader={`varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={nebulaFragment}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}
