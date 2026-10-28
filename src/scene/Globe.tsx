import { useMemo, useRef } from 'react'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { atmosphereFragment, atmosphereVertex, cloudFragment, earthFragment, earthVertex } from './shaders'
import { SUN, world } from './world'
import { vec3ToLonLat } from '../geo/sphere'
import { useTime } from '../time/store'
import { pointerOnGlobe } from './CameraRig'

const mobile = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700
const sfx = mobile ? '-2k' : ''

export function useEarthTextures() {
  const [day, night, data, ice, clouds] = useLoader(THREE.TextureLoader, [
    `/textures/earth-day${sfx}.jpg`,
    `/textures/earth-night${sfx}.jpg`,
    '/textures/earth-data.png',
    '/textures/ice.png',
    '/textures/clouds.jpg',
  ])
  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace
    night.colorSpace = THREE.SRGBColorSpace
    clouds.colorSpace = THREE.NoColorSpace
    data.colorSpace = THREE.NoColorSpace
    for (const t of [day, night, data, ice, clouds]) {
      t.anisotropy = 8
      t.wrapS = THREE.RepeatWrapping
    }
  }, [day, night, data, ice, clouds])
  return { day, night, data, ice, clouds }
}

export function Globe() {
  const tex = useEarthTextures()
  const earthMat = useRef<THREE.ShaderMaterial>(null)
  const cloudMat = useRef<THREE.ShaderMaterial>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 192, 128), [])

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
    const u = earthMat.current?.uniforms
    if (u) {
      u.uDrift.value = world.drift
      u.uSea.value = world.sea
      u.uIce.value = world.ice
      u.uLights.value = world.lights
      u.uDim.value = world.dim
      u.uTime.value = state.clock.elapsedTime
    }
    const c = cloudMat.current?.uniforms
    if (c) {
      c.uOffset.value = (c.uOffset.value + dt * 0.0016) % 1
      // clouds thin out in deep time so the drifting continents read clearly
      c.uOpacity.value = 0.82 * (1 - world.drift * 0.75)
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
      <mesh geometry={geo} scale={1.009} raycast={() => null}>
        <shaderMaterial
          ref={cloudMat}
          vertexShader={earthVertex}
          fragmentShader={cloudFragment}
          uniforms={cloudUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geo} scale={1.065} raycast={() => null}>
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
