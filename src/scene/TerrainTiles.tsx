// Close-up Earth, Google-Earth style: a quadtree of web-map tiles that loads finer tiles the
// nearer they are, each a small 3D mesh lifted by real elevation and draped with imagery.
//   imagery  EOxCloudless 2024 (Sentinel-2 cloudless mosaic, ~10 m a pixel at zoom 14) by EOX IT
//            Services GmbH, CC BY-NC-SA 4.0: free for non-commercial use, credited on screen
//   terrain  Terrain Tiles (Mapzen / AWS open data: SRTM, GMTED2010, ETOPO1, NED and others),
//            terrarium encoding, metres
// Precision: every tile's vertices are stored relative to the tile's own centre and the tile is
// placed with its mesh position, so the GPU's 32-bit floats only ever hold small numbers and the
// ground stays still even a few kilometres up. Shading: the photos already contain the sun's
// shadows, so the 3D shape only adds the difference between its slope's lighting and flat ground
// (no doubled shadows). Shown for the present-day world only; in the past today's coasts, forests
// and cities would be wrong.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { settings } from '../time/settings'
import { SUN, world } from './world'
import { rig } from './CameraRig'
import { horizonColour } from './GroundSky'

const skyHorizon = new THREE.Color(0.66, 0.77, 0.9)

const IMAGERY = (z: number, x: number, y: number) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/${z}/${y}/${x}.jpg`
const TERRAIN = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
export const TILE_CREDIT = 'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)'
const MAX_Z = 14
const MIN_Z = 3
const N = 49 // vertices along a tile edge (coarse tiles)
/** the finest tiles, seen from the ground, get a finer mesh (25 m between vertices at zoom 14) */
const gridOf = (z: number) => (z >= 13 ? 97 : N)
const EARTH_M = 6371000
/** the tiles float this far above the unit sphere (about 32 m), clear of the globe's own surface */
export const TILE_BASE = 1.000005
// tiles drawn at once: plenty on a desktop GPU, fewer on phones
const MAX_TILES = world.isMobile ? 150 : 380
const CACHE = 600

const lonOf = (x: number, n: number) => (x / n) * 360 - 180
const latOf = (y: number, n: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI

type Tile = {
  key: string
  z: number
  x: number
  y: number
  state: 'loading' | 'ready' | 'failed'
  /** failed loads are retried after a pause (throttling is temporary) */
  retryAt?: number
  tries?: number
  prio: number
  mesh?: THREE.Mesh
  heights?: Float32Array
  img?: HTMLImageElement
  used: number
  exag: number
  /** vertices along an edge of this tile's mesh */
  n: number
}

const fetchImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })

// A small queue: the tile servers throttle bursts, so only a few requests are in flight at once,
// nearest (highest priority) first. Requests for tiles that are no longer wanted are dropped.
type Job = { url: string; prio: number; alive: () => boolean; resolve: (i: HTMLImageElement | null) => void }
const queue: Job[] = []
let inFlight = 0
const MAX_IN_FLIGHT = 8
function pump() {
  while (inFlight < MAX_IN_FLIGHT && queue.length) {
    queue.sort((a, b) => b.prio - a.prio)
    const job = queue.shift()!
    if (!job.alive()) {
      job.resolve(null)
      continue
    }
    inFlight++
    fetchImage(job.url).then((img) => {
      inFlight--
      job.resolve(img)
      pump()
    })
  }
}
const loadImage = (url: string, prio: number, alive: () => boolean) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    queue.push({ url, prio, alive, resolve })
    pump()
  })

const scratch = document.createElement('canvas')
scratch.width = scratch.height = 256
const sctx = scratch.getContext('2d', { willReadFrequently: true })!

/** Terrarium tile → metres at N×N grid points, sampled bilinearly (no stair steps) */
function heightsFrom(img: HTMLImageElement | null, N: number): Float32Array {
  const h = new Float32Array(N * N)
  if (!img) return h
  sctx.clearRect(0, 0, 256, 256)
  sctx.drawImage(img, 0, 0)
  const px = sctx.getImageData(0, 0, 256, 256).data
  const at = (x: number, y: number) => {
    const i = (Math.min(255, Math.max(0, y)) * 256 + Math.min(255, Math.max(0, x))) * 4
    return px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768
  }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      // grid points run edge to edge; pixel centres sit half a pixel in
      const fx = (i / (N - 1)) * 256 - 0.5
      const fy = (j / (N - 1)) * 256 - 0.5
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      const v = at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty) + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty
      h[j * N + i] = Math.max(-500, v)
    }
  return h
}

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vUp;
varying vec3 vWorld;
varying float vHeight;
attribute float height;
void main() {
  vUv = uv;
  vHeight = height;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUp = normalize(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const frag = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSun;
uniform float uOpacity;
uniform float uDim;
uniform float uRelief;
uniform float uGround;
uniform vec3 uHaze;
uniform vec2 uTileOrigin;
uniform float uTileMetres;
uniform float uSeaCut;
varying vec2 vUv;
varying float vHeight;

// value noise, for fine grain the photos cannot hold (a sine hash breaks down for large inputs on
// many GPUs, so this one is integer-friendly and the lattice repeats every 2048 cells)
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  p = mod(p, 2048.0);
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
varying vec3 vN;
varying vec3 vUp;
varying vec3 vWorld;
void main() {
  vec3 albedo = texture2D(uMap, vUv).rgb;
  // on the ground the sea is drawn as water (Ocean.tsx) under the tiles: let it through where the
  // coarse terrain holds sea floor (the fine tiles have none) and the photo is not bright land
  if (uSeaCut > 0.5 && vHeight < 0.5) {
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    // known sea floor: anything dark and not red is water; at sea level with no depth known
    // (within a kilometre or so of the shore), only clearly blue-grey, dark pixels
    bool deep = vHeight < -0.5 && albedo.b >= albedo.r * 0.85 && lum < 0.14;
    bool shore = albedo.b > albedo.r * 1.05 && albedo.b > albedo.g * 0.95 && lum < 0.1;
    if (deep || shore) discard;
  }
  vec3 up = normalize(vUp);
  vec3 N = normalize(vN);
  float ndlFlat = dot(up, uSun);
  float day = smoothstep(-0.08, 0.2, ndlFlat);
  // the photo already holds the real shadows: add only how this slope differs from flat ground
  float rel = clamp(1.0 + uRelief * (dot(N, uSun) - ndlFlat) * 1.7, mix(0.45, 0.6, uGround), mix(1.55, 1.2, uGround));
  // on the ground snow and sand must not bloom to white: a tighter exposure
  // micro-detail near the eye: the imagery is 10 m a pixel, so up close it smears; a fine
  // procedural grain at 3 m and 0.6 m gives the ground a surface again, fading out by 2 km
  float dm = length(cameraPosition - vWorld) * 6371000.0;
  float near = 1.0 - smoothstep(150.0, 2000.0, dm);
  if (near > 0.001) {
    vec2 p = (vUv + uTileOrigin) * uTileMetres;
    // value noise clusters around 0.5: stretch it so the grain reads; three sizes of grain
    float g = clamp((vnoise(p / 3.0) * 0.45 + vnoise(p / 0.6) * 0.3 + vnoise(p / 0.15) * 0.25 - 0.5) * 2.8, -1.0, 1.0);
    float g2 = clamp((vnoise(p / 14.0) - 0.5) * 2.2, -1.0, 1.0);
    albedo *= 1.0 + near * (0.22 * g + 0.12 * g2);
  }
  vec3 col = albedo * (0.05 + mix(1.15, 0.92, uGround) * max(ndlFlat * 0.8 + 0.2, 0.0) * day) * rel;
  col = mix(col, min(col, vec3(0.93)), uGround);
  // aerial perspective: distant ground fades into blue haze, as seen from a plane
  float dkm = length(cameraPosition - vWorld) * 6371.0;
  // only inside the air: from space the globe's atmosphere shell does this job
  float camKm = (length(cameraPosition) - 1.0) * 6371.0;
  float haze = (1.0 - exp(-dkm / 900.0)) * 0.55 * (1.0 - smoothstep(25.0, 160.0, camKm));
  // standing on the ground the air is seen edge-on: hills fade to sky over a few tens of km
  haze = mix(haze, (1.0 - exp(-dkm / 45.0)) * 0.78, uGround);
  // the haze takes the sky's own horizon colour when standing on the ground
  col = mix(col, mix(vec3(0.52, 0.66, 0.86) * (0.2 + 0.8 * day), uHaze, uGround), haze);
  col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))) * 0.42, uDim);
  gl_FragColor = vec4(col, uOpacity * day);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** Height from the coarsest loaded ancestor of a tile (zoom 10 or below), where the sea floor is known */
function coarseHeightAt(t: Tile): ((lon: number, lat: number) => number) | null {
  for (let za = Math.min(10, t.z - 1); za >= MIN_Z; za--) {
    const a = tiles.get(`${za}/${t.x >> (t.z - za)}/${t.y >> (t.z - za)}`)
    if (!a?.heights || a.state !== 'ready') continue
    const { heights: h, n: N } = a
    const n = 2 ** za
    return (lon, lat) => {
      const fx = (((lon + 180) / 360) * n - a.x) * (N - 1)
      const r = (lat * Math.PI) / 180
      const fy = (((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n - a.y) * (N - 1)
      const x0 = Math.min(N - 2, Math.max(0, Math.floor(fx)))
      const y0 = Math.min(N - 2, Math.max(0, Math.floor(fy)))
      const ax = Math.min(1, Math.max(0, fx - x0))
      const ay = Math.min(1, Math.max(0, fy - y0))
      return (h[y0 * N + x0] * (1 - ax) + h[y0 * N + x0 + 1] * ax) * (1 - ay) + (h[(y0 + 1) * N + x0] * (1 - ax) + h[(y0 + 1) * N + x0 + 1] * ax) * ay
    }
  }
  return null
}

function buildMesh(t: Tile, img: HTMLImageElement, heights: Float32Array, mat: THREE.ShaderMaterial, exag: number) {
  const N = t.n
  const n = 2 ** t.z
  // the fine tiles have no bathymetry (sea reads 0), so the sea test takes the coarse ancestor's depth
  const coarse = t.z > 10 ? coarseHeightAt(t) : null
  const center = lonLatToVec3(lonOf(t.x + 0.5, n), latOf(t.y + 0.5, n), 1)
  // N×N surface plus a skirt ring hanging below the edges, hiding cracks between tiles of
  // different detail
  const ring = 4 * (N - 1)
  const count = N * N + ring
  const pos = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const hgt = new Float32Array(count)
  const v = new THREE.Vector3()
  const tileAngle = ((360 / n) * Math.PI) / 180
  const skirt = Math.min(0.01, tileAngle * 0.04)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const lon = lonOf(t.x + i / (N - 1), n)
      const lat = latOf(t.y + j / (N - 1), n)
      // 30 m above the globe's own sphere so sea level never flickers against it
      lonLatToVec3(lon, lat, TILE_BASE + (Math.max(0, heights[j * N + i]) / EARTH_M) * exag, v).sub(center)
      const k = j * N + i
      pos.set([v.x, v.y, v.z], k * 3)
      uv.set([i / (N - 1), 1 - j / (N - 1)], k * 2)
      // the raw height, sea floor included, for the shader's sea test
      const raw = heights[j * N + i]
      hgt[k] = coarse ? Math.min(raw, coarse(lon, lat)) : raw
    }
  // edge indices in order around the tile
  const edge: number[] = []
  for (let i = 0; i < N - 1; i++) edge.push(i)
  for (let j = 0; j < N - 1; j++) edge.push(j * N + N - 1)
  for (let i = N - 1; i > 0; i--) edge.push((N - 1) * N + i)
  for (let j = N - 1; j > 0; j--) edge.push(j * N)
  edge.forEach((k, e) => {
    const s = N * N + e
    v.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).add(center)
    v.multiplyScalar(1 - skirt).sub(center)
    pos.set([v.x, v.y, v.z], s * 3)
    uv.set([uv[k * 2], uv[k * 2 + 1]], s * 2)
    hgt[s] = hgt[k]
  })
  const index: number[] = []
  for (let j = 0; j < N - 1; j++)
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i
      index.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
    }
  // normals from the surface alone: the vertical skirts must not bend the edge normals, or every
  // tile border shows as a line
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(index.slice())
  g.computeVertexNormals()
  const normal = g.getAttribute('normal') as THREE.BufferAttribute
  edge.forEach((k, e) => normal.setXYZ(N * N + e, normal.getX(k), normal.getY(k), normal.getZ(k)))
  edge.forEach((k, e) => {
    const k2 = edge[(e + 1) % ring]
    const s = N * N + e
    const s2 = N * N + ((e + 1) % ring)
    index.push(k, s, k2, k2, s, s2)
  })
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('height', new THREE.BufferAttribute(hgt, 1))
  g.setIndex(index)
  const tex = new THREE.Texture(img)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.needsUpdate = true
  const m = mat.clone()
  // the tile's place on a 64-tile grid and its width in metres, so the grain runs on across tiles
  const widthM = (tileAngle * EARTH_M) * Math.cos((latOf(t.y + 0.5, n) * Math.PI) / 180)
  m.uniforms = { ...mat.uniforms, uMap: { value: tex }, uTileOrigin: { value: new THREE.Vector2(t.x % 64, (t.y % 64)) }, uTileMetres: { value: widthM } }
  const mesh = new THREE.Mesh(g, m)
  mesh.position.copy(center)
  mesh.frustumCulled = false
  mesh.raycast = () => {}
  mesh.renderOrder = 1
  return mesh
}

function disposeTile(t: Tile) {
  if (!t.mesh) return
  t.mesh.geometry.dispose()
  const m = t.mesh.material as THREE.ShaderMaterial
  ;(m.uniforms.uMap.value as THREE.Texture)?.dispose()
  m.dispose()
  t.mesh.removeFromParent()
}

/** Height (metres) of the ground at lon/lat from the finest tile loaded there; 0 if none */
export function groundHeightAt(lon: number, lat: number): number {
  let best: Tile | null = null
  for (const t of tiles.values()) {
    if (t.state !== 'ready' || !t.heights) continue
    const n = 2 ** t.z
    const fx = ((lon + 180) / 360) * n - t.x
    const r = (lat * Math.PI) / 180
    const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n - t.y
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue
    if (!best || t.z > best.z) best = t
  }
  if (!best?.heights) return 0
  const n = 2 ** best.z
  const N = best.n
  const fx = (((lon + 180) / 360) * n - best.x) * (N - 1)
  const r = (lat * Math.PI) / 180
  const fy = (((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n - best.y) * (N - 1)
  // bilinear, so walking over the grid does not step
  const x0 = Math.min(N - 2, Math.max(0, Math.floor(fx)))
  const y0 = Math.min(N - 2, Math.max(0, Math.floor(fy)))
  const ax = Math.min(1, Math.max(0, fx - x0))
  const ay = Math.min(1, Math.max(0, fy - y0))
  const h = best.heights
  const top = h[y0 * N + x0] * (1 - ax) + h[y0 * N + x0 + 1] * ax
  const bot = h[(y0 + 1) * N + x0] * (1 - ax) + h[(y0 + 1) * N + x0 + 1] * ax
  return Math.max(0, top * (1 - ay) + bot * ay)
}

const tiles = new Map<string, Tile>()
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tiles = { tiles, queue: () => ({ queued: queue.length, inFlight }) }

export function TerrainTiles() {
  const { camera, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const base = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uMap: { value: null }, uSun: { value: SUN }, uOpacity: { value: 0 }, uDim: { value: 0 }, uRelief: { value: 1 }, uGround: { value: 0 }, uHaze: { value: new THREE.Color(0.66, 0.77, 0.9) }, uTileOrigin: { value: new THREE.Vector2() }, uTileMetres: { value: 1 }, uSeaCut: { value: 0 } },
        transparent: true,
        depthWrite: true,
        // the skirts hang down from the tile edges and are seen from either side
        side: THREE.DoubleSide,
      }),
    [],
  )
  useEffect(
    () => () => {
      tiles.forEach(disposeTile)
      tiles.clear()
      base.dispose()
    },
    [base],
  )

  const opacity = useRef(0)
  const frame = useRef(0)
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const prefs = settings()
    const dist = camera.position.length()
    const alt = dist - 1
    const modern = world.drift < 0.01 && Math.abs(world.sea) < 5 && world.ice < 0.03 && world.green < 0.03
    const on = prefs.detail && modern && dist < 2.05
    opacity.current += ((on ? 1 - THREE.MathUtils.smoothstep(dist, 1.8, 2.05) : 0) - opacity.current) * 0.15
    world.detail = opacity.current > 0.3
    for (const child of g.children) {
      const u = ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms
      u.uOpacity.value = opacity.current
      u.uDim.value = world.dim
      u.uRelief.value = prefs.relief
      u.uGround.value = rig.groundBlend
      u.uSeaCut.value = rig.groundBlend > 0.6 ? 1 : 0
      ;(u.uHaze.value as THREE.Color).copy(skyHorizon)
    }
    if (rig.groundBlend > 0) horizonColour(camera.position, skyHorizon)
    if (!on && opacity.current < 0.01) {
      for (const c of [...g.children]) c.visible = false
      return
    }
    if (++frame.current % 3) return

    // choose tiles: split a tile while its texels would be bigger than ~1.4 screen pixels
    camDir.copy(camera.position).normalize()
    // from the ground the horizon formula gives a few km; mountains show from much further
    const horizon = Math.acos(Math.min(1, 1 / dist)) + rig.groundBlend * 0.035
    const pxPerRad = size.height / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360))
    const exag = prefs.terrain
    const want: Tile[] = []
    type Cand = { t: Tile; err: number }
    // a tile's on-screen blur: how many screen pixels one of its texels covers; null if hidden
    const measure = (z: number, x: number, y: number): { err: number; d: number } | null => {
      const n = 2 ** z
      const lat = latOf(y + 0.5, n)
      const c = lonLatToVec3(lonOf(x + 0.5, n), lat, 1, tmp)
      const ang = (((360 / n) * Math.PI) / 180) * Math.max(0.05, Math.cos((lat * Math.PI) / 180))
      const radius = ang * 0.75
      const toTile = Math.acos(Math.min(1, Math.max(-1, c.dot(camDir))))
      if (toTile - radius > horizon + 0.02) return null // over the horizon
      const d = Math.max(alt * 0.9, c.distanceTo(camera.position) - radius)
      return { err: ((ang / 256) * pxPerRad) / d, d }
    }
    // only a few new tiles are asked for per pass, for the blurriest ground first, so the
    // network works on what matters instead of a long queue of distant tiles
    let budget = 3 + Math.max(0, MAX_IN_FLIGHT * 2 - queue.length)
    const get = (z: number, x: number, y: number, err: number, d: number) => {
      const key = `${z}/${x}/${y}`
      // nearer and blurrier tiles load first
      const prio = err * 10 - d
      let t = tiles.get(key)
      if (!t) {
        if (budget-- <= 0) return null
        t = { key, z, x, y, state: 'loading', used: frame.current, exag, prio, n: gridOf(z) }
        tiles.set(key, t)
        load(t)
      }
      t.prio = prio
      t.used = frame.current
      if (t.state === 'failed' && (t.tries ?? 0) < 4 && performance.now() > (t.retryAt ?? 0)) load(t)
      return t
    }
    // start from the coarse tiles in view, then keep splitting the blurriest tile on screen
    // (only once its four children have loaded, so the ground never has holes)
    const open: Cand[] = []
    const n0 = 2 ** MIN_Z
    for (let y = 0; y < n0; y++)
      for (let x = 0; x < n0; x++) {
        const m = measure(MIN_Z, x, y)
        if (!m) continue
        const t = get(MIN_Z, x, y, m.err, m.d)
        if (t?.state === 'ready') open.push({ t, err: m.err })
      }
    const backfill = new Set<Tile>()
    while (open.length) {
      let bi = 0
      for (let i = 1; i < open.length; i++) if (open[i].err > open[bi].err) bi = i
      const { t, err } = open[bi]
      open.splice(bi, 1)
      if (t.z >= MAX_Z || err <= 1.3 || want.length + open.length + 4 > MAX_TILES) {
        want.push(t)
        continue
      }
      // split: draw the children that are ready; until all are, the parent stays underneath as a
      // backfill (pushed back in depth), so there is never a hole and never a wait for the slowest
      let missing = false
      for (const [kx, ky] of [[2 * t.x, 2 * t.y], [2 * t.x + 1, 2 * t.y], [2 * t.x, 2 * t.y + 1], [2 * t.x + 1, 2 * t.y + 1]]) {
        const m = measure(t.z + 1, kx, ky)
        if (!m) continue // over the horizon: not needed
        const kt = get(t.z + 1, kx, ky, m.err, m.d)
        if (kt?.state === 'ready') open.push({ t: kt, err: m.err })
        else missing = true
      }
      if (missing) {
        want.push(t)
        backfill.add(t)
      }
    }

    // rebuild visible tiles whose terrain scale changed
    for (const t of want)
      if (t.exag !== exag && t.img && t.heights) {
        disposeTile(t)
        t.mesh = buildMesh(t, t.img, t.heights, base, exag)
        t.exag = exag
        g.add(t.mesh)
      }
    const show = new Set(want.map((t) => t.mesh))
    for (const c of g.children) c.visible = show.has(c as THREE.Mesh)
    for (const t of want) {
      const m = t.mesh!.material as THREE.ShaderMaterial
      const back = backfill.has(t)
      if (m.polygonOffset !== back) {
        m.polygonOffset = back
        m.polygonOffsetFactor = 4
        m.polygonOffsetUnits = 8
        m.needsUpdate = true
      }
      t.mesh!.renderOrder = back ? 0 : 1
    }
    // evict tiles not used for a while
    if (tiles.size > CACHE) {
      // only tiles nothing has asked for in a while
      const old = [...tiles.values()].filter((t) => t.state !== 'loading' && frame.current - t.used > 90).sort((a, b) => a.used - b.used)
      for (const t of old.slice(0, tiles.size - CACHE)) {
        disposeTile(t)
        tiles.delete(t.key)
      }
    }
  })

  async function load(t: Tile) {
    t.state = 'loading'
    const alive = () => tiles.has(t.key) && frame.current - t.used < 30
    const [img, dem] = await Promise.all([loadImage(IMAGERY(t.z, t.x, t.y), t.prio, alive), loadImage(TERRAIN(t.z, t.x, t.y), t.prio, alive)])
    if (!tiles.has(t.key)) return
    // dropped from the queue because the view moved on: forget it, it will be asked for again
    if (!img && !alive()) {
      tiles.delete(t.key)
      return
    }
    if (!img) {
      t.state = 'failed'
      t.tries = (t.tries ?? 0) + 1
      t.retryAt = performance.now() + 3000 * t.tries
      return
    }
    t.heights = heightsFrom(dem, t.n)
    t.img = img
    t.exag = settings().terrain
    t.mesh = buildMesh(t, img, t.heights, base, t.exag)
    t.mesh.visible = false
    group.current?.add(t.mesh)
    t.state = 'ready'
  }

  return <group ref={group} />
}
