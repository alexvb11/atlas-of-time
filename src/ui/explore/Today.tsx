import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { onThisDay, confirmYears, type PlaceEvent } from '../../data/places'
import { useTime } from '../../time/store'
import { animateTo } from '../TimeBar'
import { timeToU } from '../../time/scale'
import { formatYear } from '../../time/format'
import { ArticleView } from '../wiki/ArticleView'

/** What happened on today's month and day, in any year: events Wikidata dates to the day */
export default function Today() {
  const [list, setList] = useState<PlaceEvent[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const today = new Date()
  useEffect(() => {
    onThisDay(today)
      .then((l) => confirmYears(l))
      .then(({ confirmed }) => setList(confirmed.sort((a, b) => a.t - b.t)), () => setError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const label = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  return (
    <div>
      <p className="mb-3 text-[12.5px] text-mist">
        Events on <span className="text-ink">{label}</span> in any year, where Wikidata gives the exact day and the article confirms the year.
      </p>
      {error && <p className="text-[13px] text-mist">Couldn’t reach Wikipedia to confirm the dates.</p>}
      {!list && !error && <div className="shimmer h-24 rounded-2xl" />}
      {list && !list.length && <p className="text-[13px] text-mist">Nothing dated to this day is in the atlas yet.</p>}
      <ol className="space-y-1.5">
        {list?.map((e) => {
          const key = `${e.title}-${e.t}`
          const isOpen = open === key
          return (
            <li key={key} className={`rounded-2xl px-3 py-2.5 ${isOpen ? 'bg-white/[.07]' : 'bg-white/[.03]'}`}>
              <div className="flex items-baseline gap-2.5">
                <span className="w-16 shrink-0 text-[12px] text-cyan tnum">{formatYear(e.t)}</span>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)} className="min-w-0 flex-1 text-left text-[13.5px] text-ink hover:underline">
                  {e.title}
                </button>
              </div>
              <div className="mt-0.5 flex gap-3 pl-[74px] text-[11px] text-mist">
                <span>{e.kind}</span>
                <button
                  type="button"
                  className="ml-auto text-dim hover:text-cyan"
                  onClick={() => {
                    animateTo(timeToU(e.t), 1.1)
                    useTime.getState().select([e.lon, e.lat])
                  }}
                >
                  Go there
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-3">
                      <ArticleView title={e.title} inline />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
