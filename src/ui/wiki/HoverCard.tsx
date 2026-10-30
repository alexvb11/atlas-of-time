import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { term, film, useAsync } from '../../data/wiki'
import { useEntityIndex } from '../../data/entities'
import { useTime } from '../../time/store'
import { animateTo } from '../TimeBar'
import { timeToU, PRESENT } from '../../time/scale'
import { formatYear } from '../../time/format'
import { Film } from './Film'
import { useReader } from './store'
import { cancelClose, scheduleClose, quietFocus } from './Term'

const W = 380
const GAP = 10

/** The single floating card: a picture film on top, the definition below, in one bubble */
export function HoverCardHost() {
  const card = useReader((s) => s.card)
  return createPortal(<AnimatePresence>{card && <Card key={card.title + '|' + card.anchor.textContent} title={card.title} anchor={card.anchor} />}</AnimatePresence>, document.body)
}

function Card({ title, anchor }: { title: string; anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null)
  const t = useAsync(title, term)
  const f = useAsync(title, film)
  const idx = useEntityIndex()
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; width: number } | null>(null)

  // the atlas's own entity for this subject, when it has one (matched by Wikidata id)
  const entity = useMemo(() => {
    if (!idx || !t.data?.qid) return null
    for (const e of idx.entities.values()) if (e.qid === t.data.qid) return e
    return null
  }, [idx, t.data])

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(W, vw - 24)
      const h = ref.current?.offsetHeight ?? width * 0.5625 + 230
      const below = r.bottom + GAP + h < vh - 8 || r.top - GAP - h < 8
      const left = Math.min(vw - width - 12, Math.max(12, r.left + r.width / 2 - width / 2))
      const top = below ? Math.min(r.bottom + GAP, vh - h - 8) : Math.max(8, r.top - GAP - h)
      setPos({ left, top, below, width })
    }
    place()
    const ro = new ResizeObserver(place)
    if (ref.current) ro.observe(ref.current)
    window.addEventListener('resize', place)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchor])

  useEffect(() => {
    const hide = () => useReader.getState().hideCard()
    // the link scrolled away: the card would float over nothing
    const onScroll = (e: Event) => !ref.current?.contains(e.target as Node) && hide()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      hide()
      quietFocus()
      anchor.focus()
    }
    // tap outside closes (touch screens have no pointer-leave)
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node) && hide()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [anchor])

  const d = t.data
  const showOnGlobe = () => {
    if (!d?.coords) return
    useReader.getState().close()
    useTime.getState().select(d.coords)
    if (entity) animateTo(timeToU(Math.min(PRESENT, entity.from + Math.min(30, (entity.to - entity.from) / 3))), 1.1)
  }

  return (
    <motion.div
      ref={ref}
      data-keys-local
      role="dialog"
      aria-label={title}
      onPointerEnter={cancelClose}
      onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleClose()}
      onFocus={cancelClose}
      initial={{ opacity: 0, scale: 0.94, y: pos?.below === false ? 8 : -8 }}
      animate={{ opacity: pos ? 1 : 0, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: pos?.width ?? W, transformOrigin: pos?.below === false ? '50% 100%' : '50% 0%' }}
      className="glass pointer-events-auto fixed z-50 overflow-hidden rounded-[22px]"
    >
      <Film title={d?.title ?? title} subtitle={d?.description} shots={f.data} poster={d?.thumb} failed={f.error} />
      <div className="px-4 pt-3 pb-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[22px] leading-tight text-ink">{d?.title ?? title}</h3>
          {entity && <span className="shrink-0 text-[11px] text-amber tnum">{formatYear(entity.from)}</span>}
        </div>
        {d?.description && <div className="mt-0.5 text-[10.5px] font-semibold tracking-[0.14em] text-amber/90 uppercase">{d.description}</div>}
        {t.error ? (
          <p className="mt-2 text-[12.5px] text-mist">Couldn’t reach Wikipedia. Check the connection and hover again.</p>
        ) : d ? (
          <p className="mt-2 line-clamp-[8] text-[13px] leading-relaxed text-ink/85">{d.disambiguation ? 'This name can mean several things. Open it to choose.' : d.extract}</p>
        ) : (
          <div className="mt-2.5 space-y-2" aria-label="Loading">
            <div className="shimmer h-3 rounded" />
            <div className="shimmer h-3 w-11/12 rounded" />
            <div className="shimmer h-3 w-4/6 rounded" />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => useReader.getState().open(d?.title ?? title)} className="bubble px-3 py-1.5 text-[12px] font-medium text-ink">
            Read the story →
          </button>
          {d?.coords && (
            <button type="button" onClick={showOnGlobe} className="bubble px-3 py-1.5 text-[12px] text-cyan">
              Show on globe
            </button>
          )}
          <a href={d?.url} target="_blank" rel="noreferrer" className="ml-auto py-1 text-[10.5px] text-dim hover:text-mist">
            Wikipedia · CC BY-SA ↗
          </a>
        </div>
      </div>
    </motion.div>
  )
}
