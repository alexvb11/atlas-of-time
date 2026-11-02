// "Political map": every state and people on the current border map filled with its own soft
// colour. The snapshot's polygons are painted once into an equirectangular texture (the same
// approach as the population-density layer) and laid over the globe. A name keeps its colour
// from year to year, so a state is recognisable as it grows and shrinks.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSnapshot, historyYears, snapshotIndexAt, type Snapshot } from '../data/history'
import { useTime } from '../time/store'
import { settings, useSettings } from '../time/settings'
import { SUN, world } from './world'

const W = 2048
const H = 1024
const cache = new Map<number, THREE.CanvasTexture>()

/** Stable colour per name: hue from a hash, spread by the golden angle */
function colourOf(name: string) {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619)
  const hue = ((h >>> 0) * 0.618033988749895 * 360) % 360
  return `hsl(${hue.toFixed(0)} 52% 56%)`
}

function paint(snap: Snapshot) {
  let tex = cache.get(snap.year)
  if (tex) return tex
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  // plain equirectangular rings (the sources wind rings the RFC 7946 way, which d3's spherical
  // path would read as "everything but"; the rings are already cut at the antimeridian)
  const ring = (r: number[][]) => {
    r.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W
      const y = ((90 - lat) / 180) * H
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
  }
  // largest first, so enclaves and small states paint over the empires around them
  for (const p of [...snap.polities].sort((a, b) => b.area - a.area)) {
    if (!p.name) continue
    ctx.globalAlpha = p.precision >= 2 ? 1 : 0.6
    ctx.fillStyle = colourOf(p.partOf ?? p.name)
    ctx.beginPath()
    for (const poly of p.polys) poly.forEach(ring)
    ctx.fill('evenodd')
  }
  tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  cache.set(snap.year, tex)
  for (const [k, old] of cache) {
    if (cache.size <= 6) break
    old.dispose()
    cache.delete(k)
  }
  return tex
}

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`
const frag = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.02) discard;
  float lit = 0.5 + 0.5 * smoothstep(-0.25, 0.35, dot(normalize(vN), uSun));
  gl_FragColor = vec4(c.rgb * lit, c.a * uOpacity);
  #include <colorspace_fragment>
}
`

export function PoliticalFill() {
  const on = useSettings((s) => s.politicalFill)
  const idx = useTime((s) => snapshotIndexAt(s.time))
  const year = idx >= 0 ? historyYears[idx] : null
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uSun: { value: SUN } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(1.0011, 160, 100), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  useFrame(() => {
    const snap = on && year !== null ? getSnapshot(year) : undefined
    if (snap) mat.uniforms.uMap.value = paint(snap)
    const want = on && snap ? 0.42 * world.borders * (1 - world.dim * 0.5) * (settings().density ? 0.4 : 1) : 0
    mat.uniforms.uOpacity.value += (want - mat.uniforms.uOpacity.value) * 0.12
  })
  if (!on) return null
  return <mesh geometry={geo} material={mat} raycast={() => null} renderOrder={2} />
}
