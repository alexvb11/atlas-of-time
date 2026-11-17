// Ground mode: standing on the real terrain at eye height, looking and walking in first person.
// The camera rig (CameraRig.tsx) reads `rig.ground*` every frame; this store tells the interface
// whether we are on the ground and lets any part of the app put the viewer somewhere.
import { create } from 'zustand'
import gsap from 'gsap'
import { rig } from './CameraRig'
import { useTime } from '../time/store'
import { world } from './world'

export type Stance = { lon: number; lat: number; yaw?: number; pitch?: number; eye?: number }

type GroundState = {
  on: boolean
  /** 0..1 while dropping to the ground or lifting off */
  entering: boolean
  enter: (s: Stance, opts?: { instant?: boolean }) => void
  leave: () => void
  /** move to another stance while on the ground (a dolly; the time it takes in seconds) */
  moveTo: (s: Stance, seconds?: number) => void
}

export const useGround = create<GroundState>()((set) => ({
  on: false,
  entering: false,
  enter: (s, opts) => {
    const reduced = useTime.getState().reducedMotion || opts?.instant
    gsap.killTweensOf(rig)
    rig.flying = true
    rig.zoomTo = null
    useTime.getState().select(null, false)
    rig.lon = s.lon
    rig.lat = s.lat
    rig.yaw = s.yaw ?? rig.yaw
    rig.pitch = s.pitch ?? 2
    rig.eye = s.eye ?? 1.7
    rig.ground = true
    rig.groundH = NaN
    set({ on: true, entering: true })
    gsap.to(rig, {
      groundBlend: 1,
      duration: reduced ? 0.01 : 2.4,
      ease: 'power2.inOut',
      onComplete: () => {
        rig.flying = false
        rig.lastInput = performance.now()
        set({ entering: false })
      },
    })
  },
  leave: () => {
    if (!rig.ground) return
    const reduced = useTime.getState().reducedMotion
    gsap.killTweensOf(rig)
    rig.flying = true
    world.sunForce = null
    // lift off to a low drone view of the same spot
    rig.dist = 1 + (Math.max(rig.groundH || 0, 0) + 2600) / 6371000
    rig.focus = 1
    rig.tilt = 0
    set({ entering: true })
    gsap.to(rig, {
      groundBlend: 0,
      duration: reduced ? 0.01 : 1.8,
      ease: 'power2.inOut',
      onComplete: () => {
        rig.ground = false
        rig.flying = false
        rig.lastInput = performance.now()
        set({ on: false, entering: false })
      },
    })
  },
  moveTo: (s, seconds = 3) => {
    if (!rig.ground) return
    gsap.killTweensOf(rig, 'lon,lat,eye,yaw,pitch')
    const reduced = useTime.getState().reducedMotion
    // the short way round for the heading
    let yaw = s.yaw ?? rig.yaw
    yaw = rig.yaw + ((((yaw - rig.yaw) % 360) + 540) % 360) - 180
    gsap.to(rig, { lon: s.lon, lat: s.lat, eye: s.eye ?? rig.eye, yaw, pitch: s.pitch ?? rig.pitch, duration: reduced ? 0.01 : seconds, ease: 'power2.inOut' })
  },
}))

/** Turn to look somewhere over a few seconds (a slow pan); dragging cancels it */
export function panTo(yaw: number, pitch: number, seconds = 6) {
  gsap.killTweensOf(rig, 'yaw,pitch')
  const to = rig.yaw + ((((yaw - rig.yaw) % 360) + 540) % 360) - 180
  gsap.to(rig, { yaw: to, pitch, duration: useTime.getState().reducedMotion ? 0.01 : seconds, ease: 'sine.inOut' })
}

// dev, or ?qa in production builds, for the screenshot scripts
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) (window as unknown as { __ground: typeof useGround }).__ground = useGround
