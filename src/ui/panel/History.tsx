import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../../time/store'
import { nameAt, type Conf, type EntityIndex } from '../../data/entities'
import type { Resolution } from '../../data/resolve'
import { useArticleIndex } from '../../data/wiki'
import { ArticleView } from '../wiki/ArticleView'
import { ConfTag } from './bits'
import { formatYear, formatDate } from '../../time/format'
import { animateTo } from '../TimeBar'
import { timeToU } from '../../time/scale'

type Ev = { t: number; title: string; detail: string | null; conf?: Conf; entity: string; era?: boolean; article?: string }

export function HistoryTab({ res, idx }: { res: Resolution; idx: EntityIndex }) {
  const t = useTime((s) => s.time)
  const listRef = useRef<HTMLOListElement>(null)
  const articles = useArticleIndex()
  const [open, setOpen] = useState<string | null>(null)

  const events = useMemo(() => {
    const ids = new Set<string>()
    if ('lineage' in res && res.lineage) res.lineage.chain.forEach((c) => ids.add(c.id))
    if (res.kind === 'entity') ids.add(res.entity.id)
    const out: Ev[] = []
    for (const id of ids) {
      const e = idx.entities.get(id)
      if (!e) continue
      out.push({ t: e.from, title: nameAt(e, e.from), detail: null, conf: e.conf, entity: e.name, era: true, article: articles?.entities[id] })
      for (const [et, title, detail, conf] of e.events) out.push({ t: et, title, detail, conf, entity: e.name, article: articles?.events[`${id}|${title}`] })
    }
    out.sort((a, b) => a.t - b.t)
    return out
  }, [res, idx, articles])

  const nowIndex = events.findIndex((e) => e.t > t)
  const ni = nowIndex < 0 ? events.length : nowIndex

  // keep the "now" marker in view as time moves, unless the reader has an article open
  useEffect(() => {
    if (open) return
    const el = listRef.current?.querySelector<HTMLElement>('[data-now]')
    el?.scrollIntoView({ block: 'center', behavior: useTime.getState().reducedMotion ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ni])

  if (!events.length) {
    return <p className="text-[13.5px] leading-relaxed text-mist">Little is recorded here for this period. As coverage grows, dated events will appear on this timeline.</p>
  }

  return (
    <ol ref={listRef} className="relative ml-2 border-l border-white/10 pl-5">
      {events.map((e, i) => {
        const past = i < ni
        const key = `${e.t}-${e.title}`
        const isOpen = open === key
        return (
          <Fragment key={key}>
            {i === ni && <NowMarker t={t} />}
            <li className={`relative py-2 transition-opacity duration-500 ${past || isOpen ? 'opacity-100' : 'opacity-55'}`}>
              <span
                className={`absolute top-[15px] -left-[25px] rounded-full transition-all duration-500 ${
                  e.era ? 'size-[9px] -translate-x-px border border-amber bg-void' : 'size-[7px]'
                } ${past && !e.era ? 'bg-cyan shadow-[0_0_8px_rgba(127,216,255,.8)]' : !e.era ? 'bg-white/25' : ''}`}
              />
              <div className="flex items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => animateTo(timeToU(e.t), 1)}
                  title={`Go to ${formatYear(e.t, e.conf === 'estimated')}`}
                  className="shrink-0 rounded px-0.5 text-[11.5px] text-cyan/90 tnum hover:bg-cyan/10 hover:text-cyan"
                >
                  {formatYear(e.t, e.conf === 'estimated')}
                </button>
                <button
                  type="button"
                  aria-expanded={e.article ? isOpen : undefined}
                  disabled={!e.article}
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="group flex min-w-0 flex-1 items-baseline gap-2 text-left disabled:cursor-default"
                >
                  <span className={`${e.era ? 'font-display text-[16px] text-amber' : 'text-[13.5px] text-ink'} ${e.article ? 'group-hover:underline' : ''}`}>{e.title}</span>
                  <ConfTag conf={e.conf === 'disputed' ? 'disputed' : undefined} note={e.detail ?? undefined} />
                  {e.article && (
                    <span className={`ml-auto shrink-0 text-[11px] text-mist transition-transform duration-300 group-hover:text-cyan ${isOpen ? 'rotate-180' : ''}`} aria-hidden>
                      ▾
                    </span>
                  )}
                </button>
              </div>
              {e.detail && <p className="mt-0.5 text-[12px] leading-relaxed text-mist">{e.detail}</p>}
              <AnimatePresence initial={false}>
                {isOpen && e.article && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2.5 pb-2">
                      <ArticleView title={e.article} inline />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          </Fragment>
        )
      })}
      {ni === events.length && <NowMarker t={t} />}
    </ol>
  )
}

function NowMarker({ t }: { t: number }) {
  return (
    <li data-now className="relative my-1 py-1" aria-label={`Current time: ${formatDate(t)}`}>
      <span className="absolute top-1/2 -left-[29px] size-[15px] -translate-y-1/2 rounded-full border-2 border-amber bg-amber/30 shadow-[0_0_14px_rgba(255,196,119,.8)]" />
      <div className="rounded-full bg-amber/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-amber uppercase">
        Now · {formatDate(t)}
      </div>
    </li>
  )
}
