// Plays a Moment (src/data/moments.ts): sets the date and the sun, drops the viewer onto the
// ground, moves between shots with slow pans, shows the captions as subtitles and reads them aloud.
// The viewer can look around at any time; dragging stops the pan. After the last shot they may stay.
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MOMENTS } from '../data/moments'
import { useMomentStore } from './explore/momentStore'
import { useGround, panTo } from '../scene/ground'
import { subsolarFor, world } from '../scene/world'
import { goTo } from './TimeBar'
import { useTime } from '../time/store'
import { useReader } from './wiki/store'
import { formatYear } from '../time/format'
import { useTourStore } from './explore/tourStore'
import { useT } from '../i18n'

export function MomentPlayer() {
  const t = useT()
  const { moment, shot, free } = useMomentStore()
  const m = MOMENTS.find((x) => x.id === moment)
  const s = m?.shots[shot]
  const timer = useRef(0)
  const narrate = useTourStore((st) => st.narrate)

  // the date, the sun and the stance for the shot
  useEffect(() => {
    if (!m || !s) return
    const g = useGround.getState()
    world.sunForce = subsolarFor(m.t, s.hour ?? m.hour, s.at[0])
    if (shot === 0) {
      goTo(m.t, 1.6)
      useTime.getState().set({ side: null, paletteOpen: false })
      g.enter({ lon: s.at[0], lat: s.at[1], yaw: s.yaw, pitch: s.pitch, eye: s.eye ?? 1.7 })
    } else g.moveTo({ lon: s.at[0], lat: s.at[1], yaw: s.yaw, pitch: s.pitch, eye: s.eye ?? 1.7 }, 3)
    const panDelay = window.setTimeout(() => s.pan && panTo(s.pan.yaw, s.pan.pitch, 9), shot === 0 ? 2800 : 3200)
    return () => clearTimeout(panDelay)
  }, [m, s, shot])

  // narration, then the next shot
  useEffect(() => {
    if (!m || !s || free) return
    const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null
    synth?.cancel()
    let spoke = false
    const next = () => {
      const st = useMomentStore.getState()
      if (st.moment !== m.id) return
      if (shot < m.shots.length - 1) st.go(shot + 1)
      else st.set({ free: true })
    }
    const lead = shot === 0 ? 2600 : 2200
    if (narrate && synth) {
      const u = new SpeechSynthesisUtterance(s.text)
      u.lang = 'en-GB'
      u.rate = 0.96
      u.onend = () => {
        spoke = true
        timer.current = window.setTimeout(next, 2500)
      }
      timer.current = window.setTimeout(() => {
        synth.speak(u)
        timer.current = window.setTimeout(() => !spoke && next(), 5000 + s.text.length * 85)
      }, lead)
    } else timer.current = window.setTimeout(next, lead + 3500 + s.text.length * 55)
    return () => {
      clearTimeout(timer.current)
      if (!spoke) synth?.cancel()
    }
  }, [m, s, shot, narrate, free])

  // Escape leaves the scene; leaving the ground by any means ends it
  const on = useGround((g) => g.on)
  const entering = useGround((g) => g.entering)
  useEffect(() => {
    if (!m) return
    // read the live state: the effect above has just asked to enter the ground
    const g = useGround.getState()
    if (!g.on && !g.entering) useMomentStore.getState().stop()
  }, [on, entering, m])
  useEffect(() => {
    if (!m) return
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      useMomentStore.getState().stop()
      useGround.getState().leave()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [m])
  useEffect(() => () => void (typeof speechSynthesis !== 'undefined' && speechSynthesis.cancel()), [])

  if (!m || !s) return null
  const exit = () => {
    useMomentStore.getState().stop()
    useGround.getState().leave()
  }
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[7vh] bg-black" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-[7vh] bg-black" />
      <div className="fixed top-[calc(7vh+12px)] right-4 z-[61] flex gap-2">
        {!free && shot < m.shots.length - 1 && (
          <button type="button" onClick={() => useMomentStore.getState().go(shot + 1)} className="rounded-full bg-black/40 px-3 py-1.5 text-[12px] text-white/70 hover:text-white">
            {t('Next')} ›
          </button>
        )}
        <button type="button" onClick={exit} className="rounded-full bg-black/40 px-3 py-1.5 text-[12px] text-white/70 hover:text-white">
          {t('Leave')} (Esc)
        </button>
      </div>
      <AnimatePresence mode="wait">
        {shot === 0 && !free && (
          <motion.div key={`title-${m.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none fixed inset-x-0 top-[13vh] z-[61] text-center">
            <div className="text-[11px] font-semibold tracking-[0.3em] text-white/60 uppercase">{m.place}</div>
            <div className="mt-2 font-display text-[clamp(28px,4.6vw,52px)] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,.8)]">{m.title}</div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${m.id}-${shot}-${free}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(7vh+18px)] z-[61] px-6 text-center"
        >
          <div className="text-[13px] tracking-wide text-amber tnum drop-shadow-[0_1px_8px_rgba(0,0,0,.9)]">
            {m.approx ? 'c. ' : ''}
            {formatYear(m.t)}
          </div>
          {free ? (
            <div className="pointer-events-auto mx-auto mt-2 flex max-w-[760px] flex-wrap items-center justify-center gap-2">
              <span className="w-full text-[clamp(14px,1.5vw,17px)] text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,.95)]">{t('Stay as long as you like: look around, walk, and drag the year to watch this place change.')}</span>
              <button type="button" onClick={() => useReader.getState().open(m.article)} className="rounded-full bg-white/15 px-4 py-2 text-[13px] text-white hover:bg-white/25">
                {t('Read the story')} →
              </button>
              <button type="button" onClick={() => useMomentStore.getState().stop()} className="rounded-full bg-white/15 px-4 py-2 text-[13px] text-white hover:bg-white/25">
                {t('Stay here')}
              </button>
              <button type="button" onClick={exit} className="rounded-full bg-white/15 px-4 py-2 text-[13px] text-white hover:bg-white/25">
                {t('Back to the globe')}
              </button>
            </div>
          ) : (
            <div className="mx-auto mt-1 max-w-[800px] text-[clamp(14px,1.55vw,19px)] leading-relaxed text-white drop-shadow-[0_1px_8px_rgba(0,0,0,.95)]">{s.text}</div>
          )}
          {m.fx && !free && <div className="mt-1 text-[10.5px] tracking-[0.18em] text-white/45 uppercase">{t('dramatisation')}</div>}
        </motion.div>
      </AnimatePresence>
    </>
  )
}
