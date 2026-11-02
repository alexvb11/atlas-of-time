import { memo, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../../time/store'
import { useResolution, resolutionKey } from '../../data/useResolution'
import { nameAt, useEntityIndex, type EntityIndex, isModernAt } from '../../data/entities'
import type { Resolution } from '../../data/resolve'
import { OverviewTab } from './Overview'
import { LanguagesTab } from './Languages'
import { HistoryTab } from './History'
import { GeographyTab } from './Geography'
import { HereTab } from './Here'
import { HeldByTab } from './HeldBy'
import { dateRange } from './bits'
import { goTo } from '../TimeBar'
import { PRESENT } from '../../time/scale'
import { formatYear } from '../../time/format'
import { recordPlace } from '../../data/journal'
import { ageAt } from '../../time/eras'

const TABS = ['Overview', 'Here', 'Held by', 'History', 'Languages', 'Geography'] as const
type Tab = (typeof TABS)[number]

export function titleOf(r: Resolution, t: number): { title: string; kicker: string; dates?: string } {
  switch (r.kind) {
    case 'entity':
      return { title: nameAt(r.entity, t), kicker: r.entity.kind, dates: dateRange(r.entity.from, r.entity.to, r.entity.conf !== 'documented' || !!r.entity.datesFromMap) }
    case 'polity':
      return { title: r.polity.name, kicker: r.polity.subjectTo ? `under ${r.polity.subjectTo}` : 'polity' }
    case 'country':
      return { title: r.country.name, kicker: 'country' }
    case 'prehistory':
      return { title: r.title, kicker: r.who }
    case 'deep':
      return { title: r.title, kicker: 'landmass' }
    case 'ocean':
      return { title: r.title, kicker: 'ocean' }
  }
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const f = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return m
}

/** Memoized so the shared-layout pill is only measured when the tab changes, not on every panel update */
const TabBar = memo(function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="relative mx-5 mt-3 flex shrink-0 gap-1 rounded-full bg-black/20 p-1" role="tablist">
      {TABS.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={tab === t}
          onClick={() => setTab(t)}
          className={`relative flex-1 rounded-full py-1.5 text-[12px] font-medium transition-colors ${tab === t ? 'text-void' : 'text-mist hover:text-ink'}`}
        >
          {tab === t && (
            <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-gradient-to-b from-cyan to-cyan-deep shadow-[0_0_16px_-2px_rgba(127,216,255,.6)]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
          )}
          <span className="relative">{t}</span>
        </button>
      ))}
    </div>
  )
})

export function Panel() {
  const selection = useTime((s) => s.selection)
  const res = useResolution()
  const idx = useEntityIndex()
  const mobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('Overview')
  const closeRef = useRef<HTMLButtonElement>(null)
  const asideRef = useRef<HTMLElement>(null)

  // the journal remembers each place visited, once its view has settled
  const resKey = res ? resolutionKey(res) : null
  useEffect(() => {
    if (!res || !selection) return
    const id = setTimeout(() => {
      const t = useTime.getState().time
      recordPlace({ name: titleOf(res, t).title, t, at: selection }, ageAt(t)?.name ?? null)
    }, 1500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resKey, selection])

  // move focus into the dialog for keyboard and screen-reader users without drawing a ring
  useEffect(() => {
    if (selection) setTimeout(() => asideRef.current?.focus({ preventScroll: true }), 50)
  }, [selection])

  const variants = mobile
    ? { hidden: { y: '100%', opacity: 1 }, shown: { y: 0, opacity: 1 } }
    : { hidden: { x: 460, opacity: 0 }, shown: { x: 0, opacity: 1 } }

  return (
    <AnimatePresence>
      {selection && res && idx && (
        <motion.aside
          key="panel"
          ref={asideRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Place details"
          initial="hidden"
          animate="shown"
          exit="hidden"
          variants={variants}
          transition={{ type: 'spring', stiffness: 170, damping: 22, mass: 0.9 }}
          className={
            mobile
              ? 'glass pointer-events-auto fixed inset-x-0 bottom-0 z-30 outline-none flex h-[64vh] flex-col rounded-t-[30px] pb-[env(safe-area-inset-bottom)]'
              : 'glass pointer-events-auto fixed top-[168px] outline-none right-4 bottom-4 z-30 flex w-[420px] flex-col rounded-[30px]'
          }
        >
          {mobile && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" />}
          <Header res={res} idx={idx} closeRef={closeRef} />
          <TabBar tab={tab} setTab={setTab} />
          <div className="scroll-thin relative mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-5" role="tabpanel">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab + resolutionKey(res)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {tab === 'Overview' && <OverviewTab res={res} idx={idx} />}
                {tab === 'Languages' && <LanguagesTab res={res} idx={idx} />}
                {tab === 'Here' && <HereTab />}
                {tab === 'Held by' && <HeldByTab />}
                {tab === 'History' && <HistoryTab res={res} idx={idx} />}
                {tab === 'Geography' && <GeographyTab res={res} idx={idx} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function Header({ res, idx, closeRef }: { res: Resolution; idx: EntityIndex; closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const time = useTime((s) => s.time)
  const { title, kicker, dates } = titleOf(res, time)
  const flag = res.kind === 'country' ? res.country.flag : res.kind === 'entity' && isModernAt(res.entity, time) ? idx.countries.get(res.entity.iso3!)?.flag : null
  const lineage = 'lineage' in res ? res.lineage : null
  return (
    <div className="shrink-0 px-5 pt-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-[0.2em] text-cyan/80 uppercase">{kicker}</div>
          <AnimatePresence mode="wait">
            <motion.h2
              key={title}
              initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-0.5 flex items-center gap-2.5 font-display text-[30px] leading-[1.05] text-ink"
            >
              {flag && <span className="flag-wave inline-block text-[26px] leading-none">{flag}</span>}
              <span>{title}</span>
            </motion.h2>
          </AnimatePresence>
          {dates && <div className="mt-1 text-[12px] text-mist tnum">{dates}</div>}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={() => useTime.getState().select(null, false)}
          className="bubble grid size-9 shrink-0 place-items-center text-mist"
          aria-label="Close panel (Escape)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
        </button>
      </div>
      {lineage && lineage.chain.length > 1 && <Breadcrumb lineage={lineage} current={res.kind === 'entity' ? res.entity.id : null} time={time} />}
    </div>
  )
}

function Breadcrumb({ lineage, current, time }: { lineage: NonNullable<Extract<Resolution, { lineage: unknown }>['lineage']>; current: string | null; time: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [current])
  return (
    <nav aria-label={`Lineage of ${lineage.name}`} className="mt-3">
      <div ref={ref} className="scroll-thin flex items-center gap-1 overflow-x-auto pb-1.5 [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)]">
        <span className="shrink-0 pl-3 text-[9.5px] font-semibold tracking-[0.16em] text-dim uppercase">Lineage</span>
        {lineage.chain.map((c, i) => {
          const active = c.id === current && time >= c.from && time < c.to
          return (
            <span key={c.id + c.from} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span className="text-dim/70">→</span>}
              <button
                type="button"
                data-active={active}
                onClick={() => goTo(Math.min(PRESENT, c.from + Math.min(40, (c.to - c.from) / 3)), 1.1)}
                title={`${c.name} · ${formatYear(c.from)}${c.related ? ' (outside today\'s borders)' : ''}`}
                className={`rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap transition-all duration-300 ${
                  active ? 'bg-amber/90 text-void shadow-[0_0_14px_-2px_rgba(255,196,119,.7)]' : c.related ? 'text-dim italic hover:text-mist' : 'text-mist hover:bg-white/8 hover:text-ink'
                }`}
              >
                {c.name}
              </button>
            </span>
          )
        })}
        <span className="w-3 shrink-0" />
      </div>
    </nav>
  )
}
