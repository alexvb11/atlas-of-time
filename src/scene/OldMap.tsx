// A historical world map laid over the globe (scripts/build-data/oldmaps.mjs). It is reprojected
// with the map's own graticule and never bent to fit today's coastlines, so Mercator's swollen
// Caspian and missing Australia show as he drew them. Tinted as paper, lit by the sun.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSettings } from '../time/settings'
import { SUN, world } from './world'

export const OLD_MAPS = {
  'mercator-1569': {
    file: 'mercator-1569.webp',
    title: 'Gerardus Mercator, Nova et Aucta Orbis Terrae Descriptio, 1569',
    article: 'Mercator 1569 world map',
    credit: 'Composite of the 18 sheets, Wikimedia Commons (public domain)',
  },
} as const

const textures = new Map<string, THREE.Texture>()
function load(file: string) {
  let tex = textures.get(file)
  if (!tex) {
    tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}data/oldmaps/${file}`)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    textures.set(file, tex)
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
  // ink on aged paper
  float ink = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 paper = vec3(0.93, 0.86, 0.70);
  vec3 col = mix(vec3(0.22, 0.15, 0.09), paper, smoothstep(0.08, 0.92, ink));
  float lit = 0.35 + 0.65 * smoothstep(-0.3, 0.4, dot(normalize(vN), uSun));
  gl_FragColor = vec4(col * lit, c.a * uOpacity);
  #include <colorspace_fragment>
}
`

export function OldMapLayer() {
  const id = useSettings((s) => s.oldMap)
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
  const geo = useMemo(() => new THREE.SphereGeometry(1.0013, 192, 120), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  useEffect(() => {
    if (id !== 'off') mat.uniforms.uMap.value = load(OLD_MAPS[id].file)
  }, [id, mat])
  useFrame(({ camera }) => {
    const s = useSettings.getState()
    // out of the way of the close-up imagery and of the moving continents of deep time
    const alt = camera.position.length() - 1
    const want = id !== 'off' && world.drift < 0.01 ? s.oldMapOpacity * THREE.MathUtils.smoothstep(alt, 0.02, 0.08) : 0
    mat.uniforms.uOpacity.value += (want - mat.uniforms.uOpacity.value) * 0.12
  })
  if (id === 'off') return null
  return <mesh geometry={geo} material={mat} raycast={() => null} renderOrder={3} />
}
