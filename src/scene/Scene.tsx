import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Globe } from './Globe'
import { DriftLand } from './DriftLand'
import { Nebula, Stars } from './Space'
import { Sky } from './Sky'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { Borders } from './Borders'
import { Highlight } from './Highlight'
import { EventsLayer, HerePins } from './Events'
import { JourneysLayer } from './Journeys'
import { CitiesLayer } from './Cities'
import { TradeRoutesLayer } from './TradeRoutes'
import { DensityLayer } from './Density'
import { PoliticalFill } from './PoliticalFill'
import { updateWorld, world } from './world'
import { useTime } from '../time/store'
import { useSettings } from '../time/settings'

const PLAY_RATE = { 1: 0.0055, 5: 0.0275, 25: 0.1375 } as const

/** Advances playback and measures scrub velocity; runs first every frame. */
function TimeDriver() {
  const lastU = useRef(useTime.getState().u)
  const vel = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = useTime.getState()
    if (s.playing && !s.scrubbing) {
      const next = s.u + PLAY_RATE[s.speed] * dt
      if (next >= 1) {
        s.setU(1)
        s.setPlaying(false)
      } else s.setU(next)
    }
    const u = useTime.getState().u
    const inst = dt > 0 ? Math.abs(u - lastU.current) / dt : 0
    lastU.current = u
    vel.current += (inst - vel.current) * (1 - Math.exp(-dt * (inst > vel.current ? 14 : 4)))
    if (Math.abs(vel.current - s.velocity) > 0.004 || (vel.current < 0.004 && s.velocity !== 0)) {
      useTime.setState({ velocity: vel.current < 0.004 ? 0 : vel.current })
    }
    updateWorld(dt)
  }, -10)
  return null
}

export function Scene() {
  const quality = useSettings((s) => s.quality)
  const showStars = useSettings((s) => s.stars)
  const showNebula = useSettings((s) => s.nebula)
  const lite = quality === 'low' || (quality === 'auto' && world.isMobile)
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={[1, quality === 'low' ? 1 : lite ? 1.5 : 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ fov: 38, near: 0.01, far: 400, position: [0, 0, 30] }}
      onPointerMissed={() => {
        const s = useTime.getState()
        if (s.selection) s.select(null, false)
      }}
      aria-label="Interactive 3D globe"
      role="img"
    >
      <color attach="background" args={['#020409']} />
      <TimeDriver />
      <CameraRig />
      {showNebula && <Nebula />}
      {showStars && <Stars count={lite ? 3000 : 6500} />}
      <Suspense fallback={null}>
        <Sky />
        <Globe />
        <DensityLayer />
        <PoliticalFill />
        <DriftLand />
        <Borders />
        <Highlight />
        <EventsLayer />
        <HerePins />
        <JourneysLayer />
        <CitiesLayer />
        <TradeRoutesLayer />
      </Suspense>
      <Effects lite={lite} />
    </Canvas>
  )
}
