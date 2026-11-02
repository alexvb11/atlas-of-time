// Ancient landscapes for deep time (back to 540 Ma): the PALEOMAP PaleoDEMs (Scotese & Wright
// 2018), one elevation and sea-depth map every 5 million years, crossfaded between maps and drawn
// with relief. Mountains, lowlands, shallow seas and deep ocean are where the reconstruction puts
// them; the colours are an informed guess, made explicit here:
//   - bare rock and soil before land plants (older than ~470 Ma), forests spreading from the
//     Devonian (~385 Ma);
//   - drier, paler land in the subtropical belts (15–35° from the equator of the time);
//   - polar ice only in the known ice ages: the Late Ordovician (~445 Ma), the Late Paleozoic
//     (~360–255 Ma, southern Gondwana) and the Cenozoic (Antarctica from ~34 Ma);
//   - snow on the highest ground.
// The drifting crust (DriftLand.tsx) uses the same PALEOMAP plate model, so clicks land on the
// right continent; today's coastlines stay as faint lines for orientation.
import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { lightingChunk } from './shaders'
import { SUN, world } from './world'

const MAX_MA = 540
let indexP: Promise<number[]> | null = null
const loadIndex = () =>
  (indexP ??= fetch(`${import.meta.env.BASE_URL}data/paleodem/index.json`)
    .then((r) => r.json())
    .then((j) => j.maps as number[]))
const textures = new Map<number, Promise<THREE.Texture>>()
function mapTexture(ma: number) {
  let p = textures.get(ma)
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}data/paleodem/${ma}.webp`).then((t) => {
      t.colorSpace = THREE.NoColorSpace
      t.wrapS = THREE.RepeatWrapping
      t.magFilter = THREE.LinearFilter
      t.minFilter = THREE.LinearMipmapLinearFilter
      return t
    })
    textures.set(ma, p)
  }
  return p
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
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uF;
uniform float uOpacity;
uniform float uMa;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
${lightingChunk}

// elevation in metres from the packed grey value: 128..255 land, 0..127 sea floor
float elev(vec2 uv) {
  float v = mix(texture2D(uA, uv).r, texture2D(uB, uv).r, uF) * 255.0;
  return v >= 127.5 ? (v - 128.0) / 127.0 * 6000.0 : -(127.0 - v) / 127.0 * 6000.0;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec3 N0 = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  // the loader flips the image, so north (the map's first row) is at v = 1, as on the sphere.
  // A little noise in the lookup breaks up the 1° grid so coasts do not look stair-stepped.
  float lat = vUv.y * 180.0 - 90.0;
  vec2 jitter = (vec2(noise(vUv * vec2(1440.0, 720.0)), noise(vUv * vec2(1440.0, 720.0) + 17.0)) - 0.5) * uTexel * 0.9;
  vec2 uv = vUv + jitter;
  float e = elev(uv);
  // coast from a small neighbourhood, so it is smooth rather than blocky
  float land = 0.0;
  for (int i = -1; i <= 1; i++)
    for (int j = -1; j <= 1; j++)
      land += smoothstep(-60.0, 60.0, elev(uv + vec2(float(i), float(j)) * uTexel * 0.45));
  land /= 9.0;

  // relief from the elevation gradient
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), N0) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(N0, east);
  float ex = elev(uv + vec2(uTexel.x, 0.0)) - elev(uv - vec2(uTexel.x, 0.0));
  float ey = elev(uv + vec2(0.0, uTexel.y)) - elev(uv - vec2(0.0, uTexel.y));
  vec3 N = normalize(N0 - (east * ex + north * ey) * 0.00028 * land);

  // land: bare before plants, greener after the Devonian; arid subtropics; rock and snow up high
  float n = noise(uv * vec2(360.0, 180.0) * 1.5) * 0.5 + noise(uv * vec2(360.0, 180.0) * 5.0) * 0.5;
  float plants = 1.0 - smoothstep(380.0, 470.0, uMa);
  vec3 bare = mix(vec3(0.42, 0.33, 0.26), vec3(0.52, 0.42, 0.32), n);
  vec3 green = mix(vec3(0.17, 0.27, 0.12), vec3(0.27, 0.34, 0.16), n);
  // drier belts in the subtropics of the time, with ragged edges; a tendency, not a map
  float alat = abs(lat) + (noise(vUv * vec2(90.0, 45.0)) - 0.5) * 14.0;
  float arid = smoothstep(12.0, 20.0, alat) * (1.0 - smoothstep(30.0, 38.0, alat)) * (0.55 + 0.45 * noise(vUv * vec2(40.0, 20.0)));
  vec3 lowland = mix(bare, mix(green, vec3(0.56, 0.47, 0.32), arid * 0.6), plants);
  vec3 rock = vec3(0.45, 0.42, 0.38);
  vec3 col = mix(lowland, rock, smoothstep(1500.0, 3200.0, e));
  col = mix(col, vec3(0.88, 0.90, 0.93), smoothstep(3800.0, 5200.0, e));

  // polar ice in the known ice ages only
  float icehouse = max(max(1.0 - smoothstep(30.0, 38.0, uMa), smoothstep(250.0, 262.0, uMa) * (1.0 - smoothstep(355.0, 365.0, uMa))),
                       smoothstep(440.0, 443.0, uMa) * (1.0 - smoothstep(446.0, 449.0, uMa)));
  float south = smoothstep(-62.0, -72.0, lat);
  float northIce = smoothstep(68.0, 78.0, lat) * (1.0 - smoothstep(3.0, 3.5, uMa));
  col = mix(col, vec3(0.86, 0.90, 0.95), clamp((south + northIce) * icehouse, 0.0, 1.0) * land);

  // sea: turquoise shelves, deep blue ocean
  vec3 shelf = vec3(0.10, 0.36, 0.44);
  vec3 deep = mix(vec3(0.012, 0.05, 0.11), vec3(0.02, 0.08, 0.16), n);
  vec3 sea = mix(shelf, deep, smoothstep(-80.0, -2500.0, e));
  col = mix(sea, col, land);

  gl_FragColor = vec4(shade(col, N, V, 1.0 - land, vec3(0.0)), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function PaleoLand() {
  const [maps, setMaps] = useState<number[] | null>(null)
  useEffect(() => {
    loadIndex().then(setMaps, () => {})
  }, [])
  const [pair, setPair] = useState<{ a: number; b: number } | null>(null)
  const [tex, setTex] = useState<{ a: THREE.Texture; b: THREE.Texture } | null>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uA: { value: null },
          uB: { value: null },
          uF: { value: 0 },
          uOpacity: { value: 0 },
          uMa: { value: 0 },
          uTexel: { value: new THREE.Vector2(1 / 360, 1 / 180) },
          uSun: { value: SUN },
          uDim: { value: 0 },
          uLights: { value: 0 },
        },
        transparent: true,
      }),
    [],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(1.0008, 192, 128), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  useEffect(() => {
    if (!pair) return
    let live = true
    Promise.all([mapTexture(pair.a), mapTexture(pair.b)]).then(([a, b]) => live && setTex({ a, b }))
    return () => void (live = false)
  }, [pair])

  useFrame(() => {
    const ma = world.ma
    // takes over from the photo globe as the drift begins; the older Merdith-based view beyond 540 Ma
    const weight = maps ? world.drift * (1 - THREE.MathUtils.smoothstep(ma, MAX_MA - 8, MAX_MA + 2)) : 0
    world.paleo = weight * (tex ? 1 : 0)
    mat.uniforms.uOpacity.value = world.paleo
    mat.uniforms.uMa.value = ma
    mat.uniforms.uDim.value = world.dim * 0.3
    if (!maps || weight <= 0) return
    // the maps bracketing this time
    let i = maps.findIndex((m) => m >= ma)
    if (i < 0) i = maps.length - 1
    const b = maps[i]
    const a = maps[Math.max(0, i - 1)]
    if (!pair || pair.a !== a || pair.b !== b) setPair({ a, b })
    if (tex && pair) {
      mat.uniforms.uA.value = tex.a
      mat.uniforms.uB.value = tex.b
      mat.uniforms.uF.value = b === a ? 0 : (ma - a) / (b - a)
    }
  })
  return <mesh geometry={geo} material={mat} raycast={() => null} renderOrder={1} />
}
