// Loading screen and the opening "movie" moment: drift in from deep space, sunrise over the limb,
// title resolves, UI eases in. Full sequence on first visit only (remembered in localStorage).
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import { useTime } from '../time/store'
import { rig, DEFAULT_DIST } from '../scene/CameraRig'
import { SUN } from '../scene/world'

const KEY = 'atlas.introSeen.v1'
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode: replay next time, harmless */
  }
}

const SUN_FINAL = SUN.clone()

export function Intro() {
  const { progress, active } = useProgress()
  const [loaded, setLoaded] = useState(false)
  const [phase, setPhase] = useState<'loading' | 'intro' | 'done'>('loading')
  const [showTitle, setShowTitle] = useState(false)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const full = useRef(!seen())

  // hold the camera far out and the sun behind the globe until assets are ready
  useEffect(() => {
    rig.dist = 26
    rig.lon = -40
    rig.lat = 8
    SUN.copy(SUN_FINAL).applyAxisAngle(new THREE.Vector3(0, 1, 0), 2.1).normalize()
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
    const dur = reduced ? 0.01 : full.current ? 5.2 : 1.8
    const sun = { a: 2.1 }
    const t = gsap.timeline({ onComplete: finish })
    tl.current = t
    t.to(rig, { dist: DEFAULT_DIST, lon: 20, lat: 22, duration: dur, ease: 'power3.inOut' }, 0)
    t.to(
      sun,
      {
        a: 0,
        duration: dur * 0.85,
        ease: 'power2.inOut',
        onUpdate: () => void SUN.copy(SUN_FINAL).applyAxisAngle(new THREE.Vector3(0, 1, 0), sun.a).normalize(),
      },
      dur * 0.1,
    )
    if (full.current && !reduced) {
      t.call(() => setShowTitle(true), [], 0.9)
      t.call(() => setShowTitle(false), [], dur - 0.9)
    }
    return () => void t.kill()
  }, [loaded])

  function finish() {
    tl.current?.kill()
    rig.dist = DEFAULT_DIST
    rig.lon = 20
    rig.lat = 22
    rig.lastInput = performance.now()
    SUN.copy(SUN_FINAL)
    setShowTitle(false)
    setPhase('done')
    markSeen()
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
              <div className="mt-6 font-display text-[22px] tracking-wide text-ink/80 italic">Gathering the ages…</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTitle && (
          <motion.div
            key="title"
            className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 1 } }}
          >
            <div className="text-center">
              <motion.h1
                className="font-display text-[clamp(48px,9vw,120px)] leading-none text-ink"
                initial={{ letterSpacing: '0.5em', opacity: 0, filter: 'blur(14px)' }}
                animate={{ letterSpacing: '0.04em', opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
              >
                Atlas of Time
              </motion.h1>
              <motion.p
                className="mt-4 text-[13px] tracking-[0.4em] text-mist uppercase"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 1.2 }}
              >
                750 million years · one planet
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'intro' && full.current && (
          <motion.button
            key="skip"
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.6 } }}
            exit={{ opacity: 0 }}
            onClick={finish}
            className="bubble fixed right-6 bottom-6 z-50 px-4 py-2 text-[12px] text-mist"
          >
            Skip intro
          </motion.button>
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
