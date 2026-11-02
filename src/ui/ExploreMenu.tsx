// The Explore menu (bottom left) and the sheet it opens on the left of the globe: guided journeys,
// the history quiz, "on this day" and the discovery journal.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../time/store'
import { useReader } from './wiki/store'
import { useT } from '../i18n'

type Side = NonNullable<ReturnType<typeof useTime.getState>['side']>
const ITEMS: { id: Side; label: string; sub: string; icon: string }[] = [
  { id: 'films', label: 'Documentaries', sub: 'Sit back: narrated films across the map', icon: 'M2 3.5h12v9H2zM6.5 6v4l3.5-2z' },
  { id: 'tours', label: 'Guided journeys', sub: 'Follow a story across the map, narrated', icon: 'M2 12c2-6 4-9 6-9s3 4 6 4M2 12h12' },
  { id: 'quiz', label: 'History quiz', sub: 'Find the place, name the ruler', icon: 'M5 5.5a3 3 0 1 1 4 2.8c-.6.3-1 .8-1 1.5V11M8 13.5v.1' },
  { id: 'compare', label: 'Compare two years', sub: 'Lay one year’s borders over another', icon: 'M2 3.5h5v9H2zM9 3.5h5v9H9z' },
  { id: 'today', label: 'On this day', sub: 'What happened on today’s date', icon: 'M3 4h10v9H3zM3 7h10M6 2.5v3M10 2.5v3' },
  { id: 'journal', label: 'Your journal', sub: 'Places, eras and articles you have explored', icon: 'M4 2.5h7.5v11H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5zM6 6h3.5M6 8.5h3.5' },
]

export function ExploreMenu() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)} className="bubble flex items-center gap-2 px-3.5 py-2 text-[12px] text-mist">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><circle cx="8" cy="8" r="6.5" /><path d="M10.8 5.2 9.2 9.2 5.2 10.8 6.8 6.8z" /></svg>
        <span className="hidden sm:inline">{t('Explore')}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass absolute bottom-12 left-0 w-[280px] rounded-[20px] p-1.5"
          >
            {ITEMS.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  useReader.getState().close()
                  useTime.getState().set({ side: it.id })
                }}
                className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/[.07] focus-visible:bg-white/[.07]"
              >
                <svg className="mt-0.5 shrink-0 text-cyan" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
                <span>
                  <span className="block text-[13px] text-ink">{t(it.label)}</span>
                  <span className="block text-[11px] text-mist">{t(it.sub)}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const Tours = lazy(() => import('./explore/Tours'))
const Quiz = lazy(() => import('./explore/Quiz'))
const Today = lazy(() => import('./explore/Today'))
const JournalView = lazy(() => import('./explore/JournalView'))
const Compare = lazy(() => import('./explore/Compare'))
const Films = lazy(() => import('./explore/Films'))
const SettingsView = lazy(() => import('./explore/SettingsView'))
const TITLES: Record<Side, string> = { tours: 'Guided journeys', quiz: 'History quiz', today: 'On this day', journal: 'Your journal', compare: 'Compare two years', settings: 'Settings', films: 'Documentaries' }

/** The sheet the Explore menu opens, on the left of the globe (full screen on phones) */
export function SideSheet() {
  const t = useT()
  const side = useTime((s) => s.side)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!side) return
    ref.current?.focus({ preventScroll: true })
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useReader.getState().stack.length || useReader.getState().card) return
      e.stopImmediatePropagation()
      useTime.getState().set({ side: null })
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [side])
  return (
    <AnimatePresence>
      {side && (
        <motion.aside
          ref={ref}
          tabIndex={-1}
          data-keys-local
          role="dialog"
          aria-label={t(TITLES[side])}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          className="glass pointer-events-auto fixed inset-x-0 bottom-0 z-[35] flex h-[70vh] flex-col rounded-t-[28px] outline-none md:inset-auto md:top-[168px] md:bottom-[72px] md:left-4 md:h-auto md:w-[min(440px,calc(100vw-470px))] md:min-w-[360px] md:rounded-[30px]"
        >
          <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-display text-[26px] leading-tight text-ink">{t(TITLES[side])}</h2>
            <button type="button" onClick={() => useTime.getState().set({ side: null })} className="bubble grid size-9 place-items-center text-mist" aria-label={t('Close (Escape)')}>
              <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
            </button>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <Suspense fallback={<div className="shimmer mt-2 h-24 rounded-2xl" />}>
              {side === 'tours' && <Tours />}
              {side === 'quiz' && <Quiz />}
              {side === 'today' && <Today />}
              {side === 'journal' && <JournalView />}
              {side === 'compare' && <Compare />}
              {side === 'films' && <Films />}
              {side === 'settings' && <SettingsView />}
            </Suspense>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
