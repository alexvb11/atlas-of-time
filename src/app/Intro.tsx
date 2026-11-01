// Loading screen, then straight onto the globe: a short glide in with the sun coming round the
// limb while the UI eases in. No title card.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import { useTime } from '../time/store'
import { rig, DEFAULT_DIST } from '../scene/CameraRig'
import { SUN } from '../scene/world'

const SUN_FINAL = SUN.clone()

export function Intro() {
  const { progress, active } = useProgress()
  const [loaded, setLoaded] = useState(false)
  const [phase, setPhase] = useState<'loading' | 'intro' | 'done'>('loading')
  const tl = useRef<gsap.core.Timeline | null>(null)

  // hold the camera far out and the sun behind the globe until assets are ready
  useEffect(() => {
    rig.dist = DEFAULT_DIST * 1.8
    rig.lon = -10
    rig.lat = 14
    SUN.copy(SUN_FINAL).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.9).normalize()
  }, [])

  useEffect(() => {
    if (!active && progress >= 100) {
      const id = setTimeout(() => setLoaded(true), 350)
      return () => clearTimeout(id)
    }
  }, [active, progress])

  useEffect(() => {
    if (!loaded || phase !== 'loading') return
    setPhase('intro')
    const reduced = useTime.getState().reducedMotion
    const dur = reduced ? 0.01 : 1.4
    const sun = { a: 0.9 }
    const t = gsap.timeline({ onComplete: finish })
    tl.current = t
    t.to(rig, { dist: DEFAULT_DIST, lon: 20, lat: 22, duration: dur, ease: 'power3.inOut' }, 0)
    t.to(
      sun,
      {
        a: 0,
        duration: dur,
        ease: 'power2.inOut',
        onUpdate: () => void SUN.copy(SUN_FINAL).applyAxisAngle(new THREE.Vector3(0, 1, 0), sun.a).normalize(),
      },
      0,
    )
    return () => void t.kill()
  }, [loaded])

  function finish() {
    tl.current?.kill()
    rig.dist = DEFAULT_DIST
    rig.lon = 20
    rig.lat = 22
    rig.lastInput = performance.now()
    SUN.copy(SUN_FINAL)
    setPhase('done')
    useTime.getState().set({ introDone: true })
  }

  return (
    <>
      <AnimatePresence>
        {phase === 'loading' && (
          <motion.div
            key="loading"
            className="fixed inset-0 z-50 grid place-items-center bg-void"
            exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }}
            role="progressbar"
            aria-label="Loading the atlas"
            aria-valuenow={Math.round(progress)}
          >
            <Dust />
            <div className="relative flex flex-col items-center">
              <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
                <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(160,215,255,.1)" strokeWidth="2" />
                <motion.circle
                  cx="46"
                  cy="46"
                  r="40"
                  fill="none"
                  stroke="url(#ring)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 40}
                  animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - progress / 100) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                />
                <defs>
                  <linearGradient id="ring" x1="0" x2="1">
                    <stop offset="0" stopColor="#7fd8ff" />
                    <stop offset="1" stopColor="#ffc477" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-[34px] text-[13px] text-mist tnum">{Math.round(progress)}%</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  )
}

/** Slow drifting motes behind the progress ring */
function Dust() {
  const dots = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      x: (i * 37.7) % 100,
      y: (i * 61.3) % 100,
      s: 1 + ((i * 13) % 3),
      d: 8 + ((i * 7) % 10),
      o: 0.15 + ((i * 17) % 10) / 30,
    })),
  ).current
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {dots.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-cyan"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.o }}
          animate={{ y: [0, -30, 0], x: [0, 12, 0], opacity: [p.o, p.o * 2, p.o] }}
          transition={{ duration: p.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
