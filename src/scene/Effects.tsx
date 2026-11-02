import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import { BlendFunction, type ChromaticAberrationEffect } from 'postprocessing'
import * as THREE from 'three'
import { world } from './world'
import { sound } from '../ui/sound'

export function Effects({ lite }: { lite: boolean }) {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const offset = useRef(new THREE.Vector2(0, 0))
  useFrame(() => {
    // faint chromatic aberration only while time is moving fast
    const w = world.warp
    offset.current.set(0.0022 * w, 0.0012 * w)
    if (ca.current) ca.current.offset = offset.current
    sound.warp(w)
    sound.era(world.t)
  })
  if (lite) {
    return (
      <EffectComposer multisampling={0}>
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    )
  }
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.55} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
      <ChromaticAberration
        ref={ca}
        offset={offset.current}
        radialModulation
        modulationOffset={0.25}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette eskil={false} offset={0.22} darkness={0.78} />
    </EffectComposer>
  )
}
