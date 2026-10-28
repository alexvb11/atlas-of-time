import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../time/store'
import { loadEvents, type GeoEvent } from '../scene/Events'
import { useEntityIndex, nameAt } from '../data/entities'
import { formatYear } from '../time/format'
import { ConfTag } from './panel/bits'
import { animateTo } from './TimeBar'
import { timeToU } from '../time/scale'

export function EventCard() {
  const id = useTime((s) => s.activeEvent)
  const idx = useEntityIndex()
  const [events, setEvents] = useState<GeoEvent[]>([])
  useEffect(() => {
    loadEvents().then((d) => setEvents(d.events))
  }, [])
  const ev = events.find((e) => e.id === id)
  const close = () => useTime.getState().set({ activeEvent: null })
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <AnimatePresence>
      {ev && (
        <motion.div
          key={ev.id}
          role="dialog"
          aria-label={ev.title}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="glass pointer-events-auto fixed bottom-20 left-4 z-30 w-[min(360px,calc(100vw-32px))] rounded-[24px] p-4"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold tracking-[0.2em] text-amber/90 uppercase">{ev.kind}</div>
              <h3 className="mt-0.5 font-display text-[22px] leading-tight text-ink">{ev.title}</h3>
              <button type="button" onClick={() => animateTo(timeToU(ev.t), 1)} className="mt-0.5 text-[12px] text-cyan tnum hover:underline">
                {formatYear(ev.t, ev.conf === 'estimated')}
              </button>
              <ConfTag conf={ev.conf} />
            </div>
            <button type="button" onClick={close} className="bubble grid size-8 shrink-0 place-items-center text-mist" aria-label="Close event">
              <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/85">{ev.text}</p>
          {idx && ev.entities && ev.entities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ev.entities.map((eid) => {
                const e = idx.entities.get(eid)
                if (!e) return null
                return (
                  <button
                    key={eid}
                    type="button"
                    className="bubble px-3 py-1.5 text-[12px] text-ink"
                    onClick={() => {
                      close()
                      useTime.getState().select(ev.at)
                    }}
                  >
                    {nameAt(e, ev.t)}
                  </button>
                )
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
