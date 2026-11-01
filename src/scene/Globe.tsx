import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { atmosphereFragment, atmosphereVertex, cloudFragment, earthFragment, earthVertex } from './shaders'
import { SUN, world } from './world'
import { vec3ToLonLat } from '../geo/sphere'
import { useTime } from '../time/store'
import { pointerOnGlobe } from './CameraRig'
import { settings } from '../time/settings'

// keep in step with the preload media queries in index.html
const mobile = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700
const sfx = mobile ? '-2k' : ''

// createImageBitmap decodes off the main thread; uploading a plain <img> forces a synchronous decode
// (WebP made that a 400 ms stall on phones). Same support check as three's GLTFLoader.
const bitmapOk = (() => {
  if (typeof createImageBitmap === 'undefined') return false
  const ua = navigator.userAgent
  const safari = /^((?!chrome|android).)*safari/i.test(ua) ? parseInt(ua.match(/Version\/(\d+)/)?.[1] ?? '0', 10) : -1
  const firefox = ua.includes('Firefox') ? parseInt(ua.match(/Firefox\/([0-9]+)\./)?.[1] ?? '0', 10) : -1
  return !(safari >= 0 && safari < 17) && !(firefox >= 0 && firefox < 98)
})()

class EarthTextureLoader extends THREE.Loader<THREE.Texture> {
  load(url: string, onLoad: (t: THREE.Texture) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) {
    // a dropped request must not leave the loading screen up forever: retry twice before giving up
    const attempt = (n: number) => {
      const retry = (e: unknown) => (n < 2 ? setTimeout(() => attempt(n + 1), 800 * (n + 1)) : onError?.(e))
      if (!bitmapOk) return void new THREE.TextureLoader(this.manager).load(url, onLoad, onProgress, retry)
      const l = new THREE.ImageBitmapLoader(this.manager)
      // flipped at decode, since WebGL ignores flipY for bitmaps
      l.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
      l.load(
        url,
        (bmp) => {
          const t = new THREE.Texture(bmp)
          t.flipY = false
          t.needsUpdate = true
          onLoad(t)
        },
        onProgress,
        retry,
      )
    }
    attempt(0)
  }
}

const lateTexture = (colorSpace: THREE.ColorSpace) => {
  const t = new THREE.Texture()
  t.colorSpace = colorSpace
  t.anisotropy = 8
  t.wrapS = THREE.RepeatWrapping
  return t
}
/**
 * Night lights and clouds are not needed for the first frames, so the intro does not wait for them:
 * they load once the critical textures are in (through their own loading manager, which the progress
 * ring does not count) and fade in. Until then the shaders sample an empty texture.
 */
const late = {
  night: lateTexture(THREE.SRGBColorSpace),
  clouds: lateTexture(THREE.NoColorSpace),
  ready: { night: false, clouds: false },
  started: false,
}
function loadLateTextures() {
  if (late.started) return
  late.started = true
  const loader = new EarthTextureLoader(new THREE.LoadingManager())
  for (const [key, url] of [['night', `/textures/earth-night${sfx}.webp`], ['clouds', '/textures/clouds.webp']] as const)
    loader.load(url, (t) => {
      late[key].image = t.image
      late[key].flipY = t.flipY
      late[key].needsUpdate = true
      late.ready[key] = true
    })
}

export function useEarthTextures() {
  const [day, data, ice] = useLoader(EarthTextureLoader, [`/textures/earth-day${sfx}.webp`, '/textures/earth-data.webp', '/textures/ice.webp'])
  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace
    data.colorSpace = THREE.NoColorSpace
    for (const t of [day, data, ice]) {
      t.anisotropy = 8
      t.wrapS = THREE.RepeatWrapping
    }
  }, [day, data, ice])
  useEffect(loadLateTextures, [])
  return { day, night: late.night, data, ice, clouds: late.clouds }
}

export function Globe() {
  const tex = useEarthTextures()
  const earthMat = useRef<THREE.ShaderMaterial>(null)
  const cloudMat = useRef<THREE.ShaderMaterial>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 192, 128), [])
  const fadeIn = useRef({ night: 0, clouds: 0 })
  const atmo = useRef<THREE.Mesh>(null)
  const cloudMesh = useRef<THREE.Mesh>(null)

  const earthUniforms = useMemo(
    () => ({
      uDay: { value: tex.day },
      uNight: { value: tex.night },
      uData: { value: tex.data },
      uIceMap: { value: tex.ice },
      uSun: { value: SUN },
      uDrift: { value: 0 },
      uSea: { value: 0 },
      uIce: { value: 0 },
      uGreen: { value: 0 },
      uLights: { value: 1 },
      uDim: { value: 0 },
      uTime: { value: 0 },
    }),
    [tex],
  )
  const cloudUniforms = useMemo(
    () => ({
      uClouds: { value: tex.clouds },
      uSun: { value: SUN },
      uOpacity: { value: 0.85 },
      uDim: { value: 0 },
      uOffset: { value: 0 },
    }),
    [tex],
  )
  const atmoUniforms = useMemo(() => ({ uSun: { value: SUN }, uIntensity: { value: 1.25 }, uShell: { value: 1.065 } }), [])

  useFrame((state, dt) => {
    const f = fadeIn.current
    if (late.ready.night) f.night = Math.min(1, f.night + dt / 1.2)
    if (late.ready.clouds) f.clouds = Math.min(1, f.clouds + dt / 1.2)
    const prefs = settings()
    if (atmo.current) atmo.current.visible = prefs.atmosphere
    if (cloudMesh.current) cloudMesh.current.visible = prefs.clouds > 0.01
    const u = earthMat.current?.uniforms
    if (u) {
      u.uDrift.value = world.drift
      u.uSea.value = world.sea
      u.uIce.value = world.ice
      u.uGreen.value = world.green
      u.uLights.value = world.lights * f.night * (prefs.nightLights ? 1 : 0)
      u.uDim.value = world.dim
      u.uTime.value = state.clock.elapsedTime
    }
    const c = cloudMat.current?.uniforms
    if (c) {
      c.uOffset.value = (c.uOffset.value + dt * 0.0016) % 1
      // clouds thin out in deep time so the drifting continents read clearly
      c.uOpacity.value = 0.82 * (1 - world.drift * 0.75) * f.clouds * prefs.clouds
      c.uDim.value = world.dim
    }
  })

  // Pointer handling: hover resolves lon/lat; click selects (ignoring drags)
  const down = useRef<[number, number] | null>(null)
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (pointerOnGlobe.dragging) return
    const p = e.point.clone()
    useTime.getState().setHover({ lonlat: vec3ToLonLat(p), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
  }
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = [e.nativeEvent.clientX, e.nativeEvent.clientY]
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const d = down.current
    if (d && Math.hypot(e.nativeEvent.clientX - d[0], e.nativeEvent.clientY - d[1]) > 6) return
    useTime.getState().select(vec3ToLonLat(e.point.clone()))
  }

  return (
    <group>
      <mesh
        geometry={geo}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerOut={() => useTime.getState().setHover(null)}
        onClick={onClick}
        name="earth"
      >
        <shaderMaterial ref={earthMat} vertexShader={earthVertex} fragmentShader={earthFragment} uniforms={earthUniforms} />
      </mesh>
      <mesh ref={cloudMesh} geometry={geo} scale={1.009} raycast={() => null}>
        <shaderMaterial
          ref={cloudMat}
          vertexShader={earthVertex}
          fragmentShader={cloudFragment}
          uniforms={cloudUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh ref={atmo} geometry={geo} scale={1.065} raycast={() => null}>
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
