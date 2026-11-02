// Close up, the globe sharpens and the land rises. Around the point the camera looks at, a patch
// of web-map tiles is streamed in and draped over a mesh lifted by real elevation:
//   imagery  NASA GIBS, Blue Marble Next Generation (the same image as the globe, ~600 m a pixel
//            at zoom 8), public domain
//   terrain  Terrain Tiles (Mapzen / AWS open data; SRTM, GMTED, ETOPO1 and others), terrarium
//            encoding, heights in metres
// The patch fades out at its edges into the globe beneath, shows only on the day side (the night
// side keeps the globe's city lights) and only for the present-day world: in the past the
// imagery's coasts, ice and forests would be anachronistic.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { settings, useSettings } from '../time/settings'
import { lightingChunk } from './shaders'
import { SUN, world } from './world'

const IMAGERY = (z: number, x: number, y: number) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`
const TERRAIN = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
const MAX_Z = 8
const K = 8 // tiles across the patch
const GRID = 160
const TILE = 256
const EARTH_M = 6371000

const tileX = (lon: number, n: number) => ((lon + 180) / 360) * n
const tileY = (lat: number, n: number) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
}
const lonOf = (x: number, n: number) => (x / n) * 360 - 180
const latOf = (y: number, n: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI

const images = new Map<string, Promise<HTMLImageElement | null>>()
function image(url: string) {
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    images.set(url, p)
    if (images.size > 400) images.delete(images.keys().next().value!)
  }
  return p
}

type Patch = { z: number; x0: number; y0: number; color: THREE.CanvasTexture; heights: Float32Array; hw: number }

async function buildPatch(z: number, cx: number, cy: number): Promise<Patch | null> {
  const n = 2 ** z
  const x0 = Math.floor(cx - K / 2)
  const y0 = Math.max(0, Math.min(n - K, Math.floor(cy - K / 2)))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = K * TILE
  const ctx = canvas.getContext('2d')!
  // terrain one zoom level coarser: half the tiles, and plenty for the mesh resolution
  const tz = Math.max(1, z - 1)
  const tn = 2 ** tz
  const tk = K / 2 + 1
  const tx0 = Math.floor(x0 / 2)
  const ty0 = Math.floor(y0 / 2)
  const tcanvas = document.createElement('canvas')
  tcanvas.width = tcanvas.height = tk * TILE
  const tctx = tcanvas.getContext('2d', { willReadFrequently: true })!
  const jobs: Promise<void>[] = []
  for (let j = 0; j < K; j++)
    for (let i = 0; i < K; i++) {
      const x = (((x0 + i) % n) + n) % n
      jobs.push(image(IMAGERY(z, x, y0 + j)).then((img) => void (img && ctx.drawImage(img, i * TILE, j * TILE))))
    }
  for (let j = 0; j < tk; j++)
    for (let i = 0; i < tk; i++) {
      const x = (((tx0 + i) % tn) + tn) % tn
      const y = ty0 + j
      if (y < 0 || y >= tn) continue
      jobs.push(image(TERRAIN(tz, x, y)).then((img) => void (img && tctx.drawImage(img, i * TILE, j * TILE))))
    }
  await Promise.all(jobs)
  const px = tctx.getImageData(0, 0, tk * TILE, tk * TILE).data
  const hw = tk * TILE
  const heights = new Float32Array(hw * hw)
  for (let i = 0; i < heights.length; i++) heights[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768
  const color = new THREE.CanvasTexture(canvas)
  color.colorSpace = THREE.SRGBColorSpace
  color.anisotropy = 8
  // where the terrain patch starts, in the imagery's tile units
  return { z, x0, y0, color, heights, hw, ...{ tx0: tx0 * 2, ty0: ty0 * 2 } } as Patch & { tx0: number; ty0: number }
}

const vert = /* glsl */ `
attribute float aEdge;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vEdge;
void main() {
  vUv = uv;
  vEdge = aEdge;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const frag = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vEdge;
${lightingChunk}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 albedo = texture2D(uMap, vUv).rgb;
  float day = smoothstep(-0.05, 0.25, dot(normalize(vWorld), uSun));
  gl_FragColor = vec4(shade(albedo, N, V, 0.0, vec3(0.0)), uOpacity * vEdge * day);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function DetailPatch() {
  const on = useSettings((s) => s.detail)
  const { camera } = useThree()
  const [patch, setPatch] = useState<(Patch & { tx0: number; ty0: number }) | null>(null)
  const want = useRef<string>('')
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uSun: { value: SUN }, uDim: { value: 0 }, uLights: { value: 0 } },
        transparent: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  )

  // the patch mesh: a grid over the patch's Mercator square, lifted by elevation
  const geo = useMemo(() => {
    if (!patch) return null
    const { z, x0, y0, heights, hw, tx0, ty0 } = patch
    const n = 2 ** z
    const exag = settings().terrain
    const pos = new Float32Array((GRID + 1) * (GRID + 1) * 3)
    const uv = new Float32Array((GRID + 1) * (GRID + 1) * 2)
    const edge = new Float32Array((GRID + 1) * (GRID + 1))
    const v = new THREE.Vector3()
    const sample = (fx: number, fy: number) => {
      // fx, fy in imagery tile units from the patch origin; terrain is at half resolution
      const hx = Math.min(hw - 1, Math.max(0, ((x0 + fx) / 2 - tx0 / 2) * TILE))
      const hy = Math.min(hw - 1, Math.max(0, ((y0 + fy) / 2 - ty0 / 2) * TILE))
      return Math.max(0, heights[Math.floor(hy) * hw + Math.floor(hx)])
    }
    for (let j = 0; j <= GRID; j++)
      for (let i = 0; i <= GRID; i++) {
        const u = i / GRID
        const w = j / GRID
        const fx = u * K
        const fy = w * K
        const lon = lonOf(x0 + fx, n)
        const lat = latOf(y0 + fy, n)
        const e = THREE.MathUtils.smoothstep(Math.min(u, 1 - u, w, 1 - w), 0, 0.14)
        const h = sample(fx, fy)
        lonLatToVec3(lon, lat, 1.00025 + (h / EARTH_M) * exag * e, v)
        const k = j * (GRID + 1) + i
        pos.set([v.x, v.y, v.z], k * 3)
        uv.set([u, 1 - w], k * 2)
        edge[k] = e
      }
    const index: number[] = []
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++) {
        const a = j * (GRID + 1) + i
        index.push(a, a + GRID + 1, a + 1, a + 1, a + GRID + 1, a + GRID + 2)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1))
    g.setIndex(index)
    g.computeVertexNormals()
    return g
  }, [patch])
  useEffect(() => () => geo?.dispose(), [geo])
  useEffect(() => {
    mat.uniforms.uMap.value = patch?.color ?? null
    return () => patch?.color.dispose()
  }, [patch, mat])

  const lastCheck = useRef(0)
  useFrame((state) => {
    const dist = camera.position.length()
    const prefs = settings()
    // present-day world only, and only close enough for the extra detail to matter
    const modern = world.drift < 0.01 && Math.abs(world.sea) < 5 && world.ice < 0.03 && world.green < 0.03
    const show = on && modern && dist < 2.0
    mat.uniforms.uOpacity.value += ((show && patch ? 1 - THREE.MathUtils.smoothstep(dist, 1.75, 2.0) : 0) - mat.uniforms.uOpacity.value) * 0.12
    mat.uniforms.uDim.value = world.dim
    if (!show || state.clock.elapsedTime - lastCheck.current < 0.4) return
    lastCheck.current = state.clock.elapsedTime
    // tile zoom from height above the ground: about one tile pixel per screen pixel
    const alt = Math.max(0.02, dist - 1)
    const z = Math.max(4, Math.min(MAX_Z, Math.floor(Math.log2(51 / alt))))
    // where the camera looks (it leans toward the horizon up close)
    const [lon, lat] = world.view
    const n = 2 ** z
    const cx = tileX(lon, n)
    const cy = tileY(lat, n)
    const key = `${z}/${Math.round(cx)}/${Math.round(cy)}/${prefs.terrain}`
    if (key === want.current) return
    want.current = key
    buildPatch(z, cx, cy).then((p) => {
      if (want.current === key && p) setPatch(p as Patch & { tx0: number; ty0: number })
    })
  })

  if (!geo) return null
  return <mesh geometry={geo} material={mat} raycast={() => null} renderOrder={1} />
}
