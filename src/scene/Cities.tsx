// Cities growing and shrinking: Wikidata's recorded populations (scripts/build-data/cities.mjs) as
// glowing dots sized by population. A city shows only between two recorded figures at most
// MAX_GAP years apart (interpolated between them) or within a year of a single figure; across a
// longer silence it is hidden rather than guessed. The largest few carry a label with the figure.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { world } from './world'
import { formatPopulation } from '../time/format'
import { useLayers } from '../time/layers'

type City = [string, number, number, [number, number][]]
const MAX_GAP = 60
const LABELS = 8

let dataP: Promise<City[]> | null = null
const load = () => (dataP ??= fetch('/data/cities.json').then((r) => r.json()).then((j) => j.cities as City[]))

/** Recorded population at t, or 0 when no figures lie close enough on both sides */
export function popAt(series: [number, number][], t: number): number {
  if (t < series[0][0] - 1 || t > series[series.length - 1][0] + 1) return 0
  for (let i = 0; i < series.length - 1; i++) {
    const [t0, p0] = series[i]
    const [t1, p1] = series[i + 1]
    if (t >= t0 && t <= t1) {
      if (t1 - t0 > MAX_GAP) return Math.abs(t - t0) <= 1 ? p0 : Math.abs(t1 - t) <= 1 ? p1 : 0
      // geometric interpolation: growth is closer to exponential than linear
      return p0 * Math.pow(p1 / p0, (t - t0) / (t1 - t0))
    }
  }
  return series[series.length - 1][1]
}

const vert = /* glsl */ `
attribute float aSize;
varying float vA;
uniform float uScale;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  float facing = dot(normalize(cameraPosition - w.xyz), normalize(position));
  vA = aSize > 0.0 ? smoothstep(0.1, 0.35, facing) : 0.0;
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const frag = /* glsl */ `
varying float vA;
uniform float uOpacity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * (0.6 + core), core * vA * uOpacity);
}
`

export function CitiesLayer() {
  const [cities, setCities] = useState<City[] | null>(null)
  const { camera, size, gl } = useThree()
  useEffect(() => {
    // only once recorded history is on screen
    if (world.t > -700) load().then(setCities, () => {})
    const id = setInterval(() => world.t > -700 && !cities && load().then(setCities, () => {}), 2000)
    return () => clearInterval(id)
  }, [cities])

  const obj = useMemo(() => {
    if (!cities) return null
    const pos = new Float32Array(cities.length * 3)
    const v = new THREE.Vector3()
    cities.forEach((c, i) => {
      lonLatToVec3(c[1], c[2], 1.0035, v)
      pos.set([v.x, v.y, v.z], i * 3)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(cities.length), 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uScale: { value: 1 }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const p = new THREE.Points(g, m)
    p.renderOrder = 7
    p.raycast = () => {}
    return p
  }, [cities])
  useEffect(
    () => () => {
      obj?.geometry.dispose()
      ;(obj?.material as THREE.Material | undefined)?.dispose()
    },
    [obj],
  )

  const labels = useRef<HTMLSpanElement[]>([])
  useEffect(() => {
    const host = document.getElementById('globe-labels')
    if (!host || !cities) return
    labels.current = Array.from({ length: LABELS }, () => {
      const el = document.createElement('span')
      el.className = 'city-label'
      host.appendChild(el)
      return el
    })
    return () => labels.current.forEach((l) => l.remove())
  }, [cities])

  const lastT = useRef(NaN)
  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!obj || !cities) return
    const mat = obj.material as THREE.ShaderMaterial
    const on = useLayers.getState().cities && world.drift < 0.02 && world.t > -700 ? 1 : 0
    mat.uniforms.uOpacity.value += (on * (1 - world.dim * 0.4) - mat.uniforms.uOpacity.value) * 0.1
    mat.uniforms.uScale.value = gl.getPixelRatio() * size.height * 0.012
    const t = world.t
    const sizes = obj.geometry.getAttribute('aSize') as THREE.BufferAttribute
    const top: { i: number; p: number }[] = []
    if (!(Math.abs(t - lastT.current) <= 0.02)) {
      lastT.current = t
      cities.forEach((c, i) => {
        const p = popAt(c[3], t)
        sizes.setX(i, p > 0 ? 1.2 + Math.sqrt(p / 1e6) * 3.2 : 0)
      })
      sizes.needsUpdate = true
    }
    // labels for the largest cities facing the camera
    camDir.copy(camera.position).normalize()
    for (let i = 0; i < cities.length; i++) {
      const s = sizes.getX(i)
      if (s <= 0) continue
      lonLatToVec3(cities[i][1], cities[i][2], 1, v)
      if (v.dot(camDir) < 0.45) continue
      top.push({ i, p: s })
    }
    top.sort((a, b) => b.p - a.p)
    labels.current.forEach((el, k) => {
      const hit = top[k]
      if (!hit || !on) {
        el.style.opacity = '0'
        return
      }
      const c = cities[hit.i]
      lonLatToVec3(c[1], c[2], 1.004, v).project(camera)
      el.textContent = `${c[0]} · ${formatPopulation(popAt(c[3], t))}`
      el.style.opacity = '0.85'
      el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width + 8).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height - 6).toFixed(1)}px)`
    })
  })
  return obj ? <primitive object={obj} /> : null
}
