// The interface while standing on the ground: a compass, where and when you are, how to move,
// and the way back up. Touch screens get a hold-to-walk button.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { rig } from '../scene/CameraRig'
import { useGround } from '../scene/ground'
import { useTime } from '../time/store'
import { formatYear } from '../time/format'
import { useT } from '../i18n'
import { useMomentStore } from './explore/momentStore'
import { useTraveller } from './explore/travellerStore'

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function GroundHud() {
  const t = useT()
  const on = useGround((s) => s.on)
  const entering = useGround((s) => s.entering)
  const time = useTime((s) => s.time)
  const moment = useMomentStore((s) => s.moment)
  const game = useTraveller((s) => s.playing)
  const [yaw, setYaw] = useState(0)
  const [hint, setHint] = useState(true)
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  useEffect(() => {
    if (!on) return
    let raf = 0
    const tick = () => {
      setYaw(Math.round(rig.yaw))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useGround.getState().leave()
    }
    window.addEventListener('keydown', k)
    const h = setTimeout(() => setHint(false), 9000)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', k)
      clearTimeout(h)
    }
  }, [on])
  useEffect(() => {
    if (on) setHint(true)
  }, [on])

  return (
    <AnimatePresence>
      {on && (
        <motion.div key="ground" initial={{ opacity: 0 }} animate={{ opacity: entering ? 0.4 : 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="pointer-events-none fixed inset-0 z-[40]">
          {/* compass strip */}
          <div className="absolute top-[max(92px,calc(env(safe-area-inset-top)+80px))] left-1/2 w-[260px] -translate-x-1/2 overflow-hidden text-center">
            <div className="relative h-5">
              {DIRS.map((d, i) => {
                const a = i * 45
                let delta = ((a - yaw + 540) % 360) - 180
                if (Math.abs(delta) > 70) return null
                return (
                  <span key={d} className={`absolute top-0 -translate-x-1/2 text-[11px] font-semibold tracking-[0.2em] ${d.length === 1 ? 'text-ink' : 'text-dim'}`} style={{ left: `${50 + delta * 0.7}%`, opacity: 1 - Math.abs(delta) / 80 }}>
                    {d}
                  </span>
                )
              })}
              <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-cyan" />
            </div>
          </div>

          {/* leave */}
          {!moment && !game && (
            <button type="button" onClick={() => useGround.getState().leave()} className="bubble pointer-events-auto absolute top-[max(92px,calc(env(safe-area-inset-top)+80px))] right-4 px-3.5 py-2 text-[12px] text-mist">
              {t('Leave the ground')} <kbd className="ml-1 rounded border border-white/12 px-1 text-[10px] text-dim">Esc</kbd>
            </button>
          )}

          {/* where and when */}
          {!moment && !game && (
            <div className="absolute bottom-[max(72px,calc(env(safe-area-inset-bottom)+56px))] left-1/2 -translate-x-1/2 text-center">
              {!game && <div className="font-display text-[22px] text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,.9)] tnum">{formatYear(time)}</div>}
              <AnimatePresence>
                {hint && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1 text-[11.5px] text-mist drop-shadow-[0_1px_6px_rgba(0,0,0,.9)]">
                    {touch ? t('Drag to look around · hold Walk to move · pinch in to leave') : t('Drag to look around · W A S D to walk · Shift to run · scroll out to leave')}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {touch && (
            <button
              type="button"
              className="bubble pointer-events-auto absolute right-5 bottom-[max(120px,calc(env(safe-area-inset-bottom)+104px))] grid size-16 place-items-center text-[12px] font-medium text-ink select-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                rig.walk.f = 1
              }}
              onPointerUp={() => (rig.walk.f = 0)}
              onPointerCancel={() => (rig.walk.f = 0)}
              aria-label={t('Walk forward (hold)')}
            >
              {t('Walk')}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
