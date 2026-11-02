import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { JOURNEYS } from '../../data/journeys'
import { useTourStore } from './tourStore'
import { useTime } from '../../time/store'
import { useReader } from '../wiki/store'
import { goTo } from '../TimeBar'
import { formatYear } from '../../time/format'
import { DOCUMENTARIES } from '../../data/documentaries'
import { flyTo } from '../../scene/CameraRig'

const STEP_MS = 9000

/** The list of journeys, and the stops of the one playing */
export default function Tours() {
  const { tour, step, playing, narrate } = useTourStore()
  const j = JOURNEYS.find((x) => x.id === tour)
  if (!j)
    return (
      <div className="space-y-2">
        <p className="mb-3 text-[12.5px] text-mist">Each journey moves the time and the camera from stop to stop. Voyages and marches are also drawn moving on the globe whenever the time is within their dates.</p>
        {JOURNEYS.map((x) => (
          <button key={x.id} type="button" onClick={() => useTourStore.getState().start(x.id)} className="group block w-full rounded-2xl bg-white/[.04] px-4 py-3 text-left hover:bg-white/[.08]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: x.color, boxShadow: `0 0 8px ${x.color}` }} />
              <span className="text-[14px] text-ink">{x.name}</span>
              <span className="ml-auto text-[11px] text-cyan opacity-0 transition-opacity group-hover:opacity-100">Play ▸</span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-mist">{x.blurb}</p>
            <p className="mt-1 text-[11px] text-dim tnum">
              {formatYear(x.stops[0].t)} – {formatYear(x.stops[x.stops.length - 1].t)} · {x.stops.length} stops
            </p>
          </button>
        ))}
      </div>
    )
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => useTourStore.getState().stop()} className="text-[12px] text-mist hover:text-ink">
          ‹ All journeys
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-[12px] text-mist">
          <input type="checkbox" checked={narrate} onChange={(e) => useTourStore.getState().set({ narrate: e.target.checked })} className="accent-[var(--color-cyan)]" />
          Narrate
        </label>
      </div>
      <h3 className="mt-2 font-display text-[22px] text-amber">{j.name}</h3>
      <p className="text-[12px] text-mist">{j.blurb}</p>
      <div className="mt-3 flex gap-1.5">
        <button type="button" onClick={() => useTourStore.getState().go(Math.max(0, step - 1))} className="bubble px-3 py-1.5 text-[12px] text-ink" aria-label="Previous stop">
          ‹ Back
        </button>
        <button type="button" onClick={() => useTourStore.getState().set({ playing: !playing })} className="bubble px-3.5 py-1.5 text-[12px] font-medium text-ink">
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => useTourStore.getState().go(Math.min(j.stops.length - 1, step + 1))} className="bubble px-3 py-1.5 text-[12px] text-ink" aria-label="Next stop">
          Next ›
        </button>
      </div>
      <ol className="mt-4 space-y-1">
        {j.stops.map((s, i) => (
          <li key={i}>
            <button type="button" onClick={() => useTourStore.getState().go(i)} aria-current={i === step} className={`flex w-full items-baseline gap-2 rounded-xl px-2.5 py-2 text-left ${i === step ? 'bg-white/[.09]' : 'hover:bg-white/[.05]'}`}>
              <span className={`w-20 shrink-0 text-[11.5px] tnum ${i === step ? 'text-amber' : 'text-cyan/80'}`}>
                {s.approx ? 'c. ' : ''}
                {formatYear(s.t)}
              </span>
              <span className={`text-[13px] ${i === step ? 'text-ink' : 'text-ink/75'}`}>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Drives a playing journey (mounted once in the app): time, camera, caption and narration */
export function TourPlayer() {
  const { tour, step, playing, narrate, doc, chapter } = useTourStore()
  const j = JOURNEYS.find((x) => x.id === tour)
  const s = j?.stops[step]
  const timer = useRef(0)
  const film = DOCUMENTARIES.find((d) => d.id === doc)

  // move time and camera to the stop; a documentary flies the camera without opening panels
  useEffect(() => {
    if (!s) return
    if (doc) {
      useTime.getState().select(null, false)
      goTo(s.t, 2.4)
      flyTo(s.at[0], s.at[1], 2.25, useTime.getState().reducedMotion)
    } else {
      goTo(s.t, 1.6)
      useTime.getState().select(s.at)
    }
  }, [s, doc])

  // Escape leaves a documentary
  useEffect(() => {
    if (!doc) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && useTourStore.getState().stop()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [doc])

  // narration, then the next stop
  useEffect(() => {
    if (!s || !j) return
    const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null
    synth?.cancel()
    let spoke = false
    const next = () => {
      const st = useTourStore.getState()
      if (!st.playing) return
      if (step < j.stops.length - 1) st.go(step + 1)
      else if (film && chapter < film.chapters.length - 1) st.set({ chapter: chapter + 1, tour: film.chapters[chapter + 1], step: 0 })
      else if (film) st.stop()
      else st.set({ playing: false })
    }
    if (narrate && synth) {
      const u = new SpeechSynthesisUtterance(`${s.title}. ${s.text}`)
      u.lang = 'en-GB'
      u.rate = 0.98
      u.onend = () => {
        spoke = true
        if (playing) timer.current = window.setTimeout(next, 1500)
      }
      // start after the fly-to settles; if no voice ever finishes (some browsers have none), move on anyway
      timer.current = window.setTimeout(() => {
        synth.speak(u)
        timer.current = window.setTimeout(() => !spoke && playing && next(), 4000 + u.text.length * 85)
      }, 1400)
    } else if (playing) timer.current = window.setTimeout(next, STEP_MS)
    return () => {
      clearTimeout(timer.current)
      if (!spoke) synth?.cancel()
    }
  }, [s, j, step, playing, narrate, film, chapter])

  useEffect(() => () => void (typeof speechSynthesis !== 'undefined' && speechSynthesis.cancel()), [])

  if (film && s && j)
    return (
      <>
        {/* letterbox and subtitles */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[8vh] bg-black" />
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-[8vh] bg-black" />
        <button type="button" onClick={() => useTourStore.getState().stop()} className="fixed top-[calc(8vh+12px)] right-4 z-[61] rounded-full bg-black/40 px-3 py-1.5 text-[12px] text-white/70 hover:text-white">
          Exit film (Esc)
        </button>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key={`title-${j.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="pointer-events-none fixed inset-x-0 top-[14vh] z-[61] text-center"
            >
              <div className="text-[11px] font-semibold tracking-[0.3em] text-white/60 uppercase">
                {film.title} · chapter {chapter + 1} of {film.chapters.length}
              </div>
              <div className="mt-2 font-display text-[clamp(30px,5vw,56px)] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,.8)]">{j.name}</div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${j.id}-${step}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(8vh+18px)] z-[61] px-6 text-center"
          >
            <div className="text-[13px] tracking-wide text-amber tnum drop-shadow-[0_1px_8px_rgba(0,0,0,.9)]">
              {s.approx ? 'c. ' : ''}
              {formatYear(s.t)}
            </div>
            <div className="mx-auto mt-1 max-w-[860px] font-display text-[clamp(20px,2.6vw,30px)] leading-snug text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.95)]">{s.title}</div>
            <div className="mx-auto mt-1 max-w-[760px] text-[clamp(13px,1.4vw,16px)] leading-relaxed text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,.95)]">{s.text}</div>
          </motion.div>
        </AnimatePresence>
      </>
    )

  return (
    <AnimatePresence>
      {s && j && (
        <motion.div
          key={`${j.id}-${step}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          className="glass pointer-events-auto fixed bottom-20 left-1/2 z-30 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 rounded-[22px] px-5 py-4 md:bottom-24"
        >
          <div className="flex items-baseline gap-2 text-[10.5px] font-semibold tracking-[0.18em] text-amber/90 uppercase">
            <span>{j.name}</span>
            <span className="text-dim">
              {step + 1}/{j.stops.length}
            </span>
            <span className="ml-auto tracking-normal text-cyan normal-case tnum">
              {s.approx ? 'c. ' : ''}
              {formatYear(s.t)}
            </span>
          </div>
          <h3 className="mt-1 font-display text-[22px] leading-tight text-ink">{s.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/85">{s.text}</p>
          <div className="mt-2.5 flex items-center gap-2">
            {s.article && (
              <button type="button" onClick={() => useReader.getState().open(s.article!)} className="bubble px-3 py-1.5 text-[12px] text-ink">
                Read the story →
              </button>
            )}
            <button type="button" onClick={() => useTourStore.getState().set({ playing: !playing })} className="ml-auto text-[12px] text-mist hover:text-ink">
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={() => useTourStore.getState().stop()} className="text-[12px] text-mist hover:text-ink">
              End
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
