import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../../time/store'
import { eventsNear, confirmYears, type Nearby } from '../../data/places'
import { formatYear } from '../../time/format'
import { goTo } from '../TimeBar'
import { PRESENT } from '../../time/scale'
import { ArticleView } from '../wiki/ArticleView'
import { zoomToFit } from '../../scene/CameraRig'

type Result = { list: Nearby[]; unconfirmed: number; window: number; radius: number; widened: boolean }

const fmtCoord = ([lon, lat]: [number, number]) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`
const fmtKm = (k: number) => (k < 1 ? 'right here' : k < 10 ? `${k.toFixed(1)} km` : `${Math.round(k)} km`)

/** "What happened here, then?": located, dated events around the selected point and time */
export function HereTab() {
  const sel = useTime((s) => s.selection)!
  const t = useTime((s) => s.time)
  // re-search when time settles on a new quarter-year, not on every frame of a scrub
  const tq = Math.round(t * 4) / 4
  const [res, setRes] = useState<Result | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [hot, setHot] = useState(-1)
  const ancient = PRESENT - t > 6000

  useEffect(() => {
    if (ancient) return
    let live = true
    const id = setTimeout(async () => {
      try {
        const near = await eventsNear(sel[0], sel[1], tq)
        const { confirmed, unconfirmed } = await confirmYears(near.list)
        if (live) {
          setRes({ ...near, list: confirmed, unconfirmed })
          setError(false)
        }
      } catch {
        if (live) setError(true)
      }
    }, 300)
    return () => {
      live = false
      clearTimeout(id)
    }
  }, [sel, tq, ancient])

  // numbered pins on the globe for the listed events
  useEffect(() => {
    useTime.getState().set({ herePins: (res?.list ?? []).slice(0, 12).map((e, i) => ({ lon: e.lon, lat: e.lat, n: i + 1, hot: i === hot })) })
  }, [res, hot])
  useEffect(() => () => useTime.getState().set({ herePins: [] }), [])

  // the first results for a spot: ease in until their pins are told apart (once, so it never fights the user)
  const framed = useRef<string | null>(null)
  useEffect(() => {
    const key = sel.join(',')
    if (!res?.list.length || framed.current === key) return
    framed.current = key
    const far = Math.max(...res.list.slice(0, 12).map((e) => e.km))
    zoomToFit(Math.max(40, far))
  }, [res, sel])

  if (ancient) return <p className="text-[13.5px] leading-relaxed text-mist">No events are recorded at a date and place this long ago. Move closer to recorded history to see what happened here.</p>

  return (
    <div>
      <div className="mb-3 text-[11.5px] leading-relaxed text-mist">
        <span className="text-ink tnum">{fmtCoord(sel)}</span>
        {res && (
          <>
            {' · '}within {res.radius} km, <span className="tnum">{formatYear(t - res.window)}</span>–<span className="tnum">{formatYear(Math.min(PRESENT, t + res.window))}</span>
            {res.widened && <span className="text-dim"> (searched wider: nothing closer)</span>}
          </>
        )}
      </div>
      {error ? (
        <p className="text-[13px] text-mist">Couldn’t reach Wikipedia to confirm the dates. Check the connection and try again.</p>
      ) : !res ? (
        <div className="space-y-2.5" aria-label="Searching">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-12 rounded-2xl" />
          ))}
        </div>
      ) : !res.list.length ? (
        <p className="text-[13.5px] leading-relaxed text-mist">No dated events are recorded this close to here and now. Try another spot, or move the time.</p>
      ) : (
        <ol className="space-y-1.5" onPointerLeave={() => setHot(-1)}>
          {res.list.map((e, i) => {
            const key = `${e.title}-${e.t}`
            const isOpen = open === key
            const exact = Math.floor(e.t) === Math.floor(t) && e.km < 60
            return (
              <li key={key} onPointerEnter={() => setHot(i)} className={`rounded-2xl px-3 py-2.5 transition-colors ${hot === i || isOpen ? 'bg-white/[.07]' : 'bg-white/[.03]'}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-semibold ${i < 12 ? (hot === i ? 'bg-amber text-void' : 'bg-cyan/15 text-cyan') : 'bg-white/10 text-mist'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)} className="group block w-full text-left">
                      <span className="text-[13.5px] text-ink group-hover:underline">{e.title}</span>
                      {exact && <span className="ml-1.5 rounded-full bg-amber/15 px-1.5 py-px text-[9.5px] font-semibold tracking-wider text-amber uppercase">here, this year</span>}
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-mist">
                      <button type="button" onClick={() => goTo(e.t, 1)} className="text-cyan tnum hover:underline" title="Go to this date">
                        {formatYear(e.t)}
                      </button>
                      <span>{e.kind}</span>
                      <span>· {e.km < 1 ? 'right here' : `${fmtKm(e.km)} ${e.bearing}`}</span>
                      <button type="button" onClick={() => useTime.getState().select([e.lon, e.lat])} className="ml-auto text-dim hover:text-cyan">
                        Go there
                      </button>
                    </div>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
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
      )}
      {res && (
        <p className="mt-4 text-[11px] leading-relaxed text-dim">
          Places and dates from Wikidata; each year is confirmed by the event’s Wikipedia article.
          {res.unconfirmed > 0 && ` ${res.unconfirmed} more nearby ${res.unconfirmed === 1 ? 'event is' : 'events are'} left out because the article does not give the same year.`}
        </p>
      )}
    </div>
  )
}
