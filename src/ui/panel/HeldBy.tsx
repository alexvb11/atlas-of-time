// "Held by": every state, empire or people the border sources put at the selected spot, from the
// earliest map to today, with the years. Click a row to go to that time.
import { useEffect, useRef, useState } from 'react'
import { useTime } from '../../time/store'
import { timelineAt, type Hold } from '../../data/history'
import { formatYear } from '../../time/format'
import { animateTo } from '../TimeBar'
import { PRESENT, timeToU } from '../../time/scale'
import { useReader } from '../wiki/store'

const SOURCE: Record<number, string> = { 3: 'CShapes', 2: 'Cliopatria', 1: 'approximate', 0: 'approximate' }

export function HeldByTab() {
  // the panel keeps rendering while it animates closed, after the selection is cleared
  const sel = useTime((s) => s.selection)
  const t = useTime((s) => s.time)
  const [holds, setHolds] = useState<Hold[] | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (!sel) return
    let live = true
    setHolds(null)
    timelineAt(sel[0], sel[1]).then((h) => live && setHolds(h))
    return () => void (live = false)
  }, [sel])

  const nowIndex = holds ? holds.findIndex((h) => t >= h.from && t < h.to) : -1
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-now]')?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [holds, nowIndex])

  if (!holds) return <p className="text-[13px] text-mist">Reading every border map for this spot…</p>
  if (!holds.length) return <p className="text-[13.5px] leading-relaxed text-mist">No state or people is drawn at this spot in any of the border maps (open sea, ice, or a place the sources leave blank).</p>

  return (
    <div>
      <p className="mb-3 text-[12px] leading-snug text-dim">
        Who held this exact spot, as the border sources draw it. Earlier rows are coarser: dashed borders on the map mark the approximate ones.
      </p>
      <ol ref={listRef} className="relative ml-2 border-l border-white/10 pl-5">
        {holds.map((h, i) => {
          const now = i === nowIndex
          const to = h.to >= PRESENT ? 'today' : formatYear(h.to - (h.to % 1 === 0 ? 1 : 0))
          return (
            <li key={`${h.name}${h.from}`} data-now={now || undefined} className="relative mb-2.5">
              <span className={`absolute top-[7px] -left-[25px] size-2.5 rounded-full border ${now ? 'border-cyan bg-cyan shadow-[0_0_10px_rgba(127,216,255,.8)]' : h.from <= t ? 'border-white/40 bg-white/30' : 'border-white/25 bg-transparent'}`} />
              <button
                type="button"
                onClick={() => animateTo(timeToU(Math.min(PRESENT, h.from + Math.min(1, (h.to - h.from) / 2))))}
                className={`block w-full rounded-xl px-2 py-1 text-left hover:bg-white/[.06] ${now ? 'bg-white/[.06]' : ''}`}
              >
                <span className="block text-[11px] text-dim tnum">
                  {formatYear(h.from)} – {to}
                  <span className="ml-1.5 opacity-70">· {SOURCE[h.precision]}</span>
                </span>
                <span className={`block text-[13.5px] ${now ? 'text-ink' : 'text-mist'}`}>{h.name}</span>
                {(h.partOf || h.under) && <span className="block text-[11.5px] text-dim">{h.under ? `under ${h.under}` : `part of ${h.partOf}`}</span>}
              </button>
              {h.wiki && (
                <button type="button" onClick={() => useReader.getState().open(h.wiki!)} className="ml-2 text-[11.5px] text-cyan hover:underline">
                  Read about it →
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
