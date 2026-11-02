// Population density through time: people per km² within each of today's countries, from the
// HYDE 3.2 estimates (via Our World in Data) before 1950 and the UN after, the same series the panel
// uses. Today's borders are a fixed frame for comparison, not the states of the time; the legend
// says so. Drawn as a shaded overlay: a country-ID map is painted once into a texture, and a small
// colour table indexed by country is refreshed as the year changes.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { geoArea, geoEquirectangular, geoPath } from 'd3-geo'
import { interpSeries, type Country } from '../data/entities'
import { settings, useSettings } from '../time/settings'
import { SUN, world } from './world'

const R2 = 6371 * 6371
const W = 2048
const H = 1024

type Data = { idMap: THREE.Texture; iso: string[]; area: number[]; series: Record<string, [number, number][]> }
let dataP: Promise<Data> | null = null

function load(): Promise<Data> {
  return (dataP ??= Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/countries-50m.json`).then((r) => r.json() as Promise<Topology>),
    fetch(`${import.meta.env.BASE_URL}data/countries.json`).then((r) => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/population.json`).then((r) => r.json()),
  ]).then(([topo, ctry, pop]) => {
    const byNumeric = ctry.countries as Record<string, Country>
    const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as GeoJSON.FeatureCollection
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: false })!
    ctx.imageSmoothingEnabled = false
    const path = geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), ctx)
    const iso: string[] = ['']
    const area: number[] = [0]
    for (const f of fc.features) {
      const c = f.id ? byNumeric[String(f.id)] : undefined
      if (!c || !f.geometry) continue
      const i = iso.length
      iso.push(c.iso3)
      area.push(geoArea(f) * R2)
      ctx.fillStyle = `rgb(${i & 255}, ${i >> 8}, 0)`
      ctx.beginPath()
      path(f)
      ctx.fill()
    }
    const idMap = new THREE.CanvasTexture(canvas)
    idMap.magFilter = idMap.minFilter = THREE.NearestFilter
    idMap.generateMipmaps = false
    idMap.colorSpace = THREE.NoColorSpace
    return { idMap, iso, area, series: pop.series }
  }))
}

/** Colour ramp over log10 density: <1, 1-10, 10-100, 100-1000, >1000 people per km² */
export const DENSITY_STOPS: [number, string][] = [
  [-1, '#1b2a4a'],
  [0, '#3b4f8a'],
  [1, '#9a5ca8'],
  [2, '#f08a4b'],
  [3, '#ffe9a8'],
]
const ramp = DENSITY_STOPS.map(([k, c]) => [k, new THREE.Color(c)] as const)
const tmp = new THREE.Color()
function colorFor(logD: number) {
  if (logD <= ramp[0][0]) return tmp.copy(ramp[0][1])
  for (let i = 0; i < ramp.length - 1; i++) {
    const [a, ca] = ramp[i]
    const [b, cb] = ramp[i + 1]
    if (logD <= b) return tmp.copy(ca).lerp(cb, (logD - a) / (b - a))
  }
  return tmp.copy(ramp[ramp.length - 1][1])
}

/** People per km² for a country at t, or null without an estimate */
export function densityAt(series: [number, number][] | undefined, areaKm2: number, t: number): number | null {
  if (!series?.length || !areaKm2) return null
  const last = series[series.length - 1][0]
  const v = interpSeries(series, t > last && t - last < 5 ? last : t)
  return v === null ? null : v / areaKm2
}

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const frag = /* glsl */ `
uniform sampler2D uIds;
uniform sampler2D uLut;
uniform float uCount;
uniform float uOpacity;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec4 id = texture2D(uIds, vUv);
  float i = floor(id.r * 255.0 + 0.5) + floor(id.g * 255.0 + 0.5) * 256.0;
  if (i < 0.5) discard;
  vec4 c = texture2D(uLut, vec2((i + 0.5) / uCount, 0.5));
  if (c.a < 0.01) discard;
  float lit = 0.55 + 0.45 * smoothstep(-0.2, 0.3, dot(normalize(vN), uSun));
  gl_FragColor = vec4(c.rgb * lit, c.a * uOpacity);
}
`

export function DensityLayer() {
  const on = useSettings((s) => s.density)
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    if (on && !data) load().then(setData, () => {})
  }, [on, data])

  const lut = useMemo(() => {
    if (!data) return null
    const n = data.iso.length
    const tex = new THREE.DataTexture(new Uint8Array(n * 4), n, 1, THREE.RGBAFormat)
    tex.magFilter = tex.minFilter = THREE.NearestFilter
    tex.needsUpdate = true
    return tex
  }, [data])
  const mat = useMemo(() => {
    if (!data || !lut) return null
    return new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uIds: { value: data.idMap }, uLut: { value: lut }, uCount: { value: data.iso.length }, uOpacity: { value: 0 }, uSun: { value: SUN } },
      transparent: true,
      depthWrite: false,
    })
  }, [data, lut])
  const geo = useMemo(() => new THREE.SphereGeometry(1.0012, 160, 100), [])
  useEffect(() => () => geo.dispose(), [geo])

  const lastT = useRef(NaN)
  useFrame(() => {
    if (!mat || !lut || !data) return
    const show = on && world.drift < 0.02 && world.t >= -9999 ? 1 : 0
    const u = mat.uniforms
    u.uOpacity.value += (show * settings().densityOpacity * (1 - world.dim * 0.5) - u.uOpacity.value) * 0.1
    if (u.uOpacity.value < 0.003 || Math.abs(world.t - lastT.current) < 0.25) return
    lastT.current = world.t
    const px = lut.image.data as Uint8Array
    for (let i = 1; i < data.iso.length; i++) {
      const d = densityAt(data.series[data.iso[i]], data.area[i], world.t)
      if (d === null) {
        px[i * 4 + 3] = 0
        continue
      }
      const c = colorFor(Math.log10(Math.max(d, 0.01)))
      px[i * 4] = c.r * 255
      px[i * 4 + 1] = c.g * 255
      px[i * 4 + 2] = c.b * 255
      px[i * 4 + 3] = 255
    }
    lut.needsUpdate = true
  })
  if (!mat) return null
  return <mesh geometry={geo} material={mat} raycast={() => null} renderOrder={2} />
}
