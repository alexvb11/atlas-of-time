// Big date readout, and the global HUD strip (world state at time T).
import { useEffect, useRef, useState } from 'react'
import { tr } from '../i18n'
import { motion } from 'framer-motion'
import { useTime } from '../time/store'
import { useSettings } from '../time/settings'
import { dateParts, formatPopulation } from '../time/format'
import { ageAt, periodAt, worldPopAt } from '../time/eras'
import { parseTime, PRESENT } from '../time/scale'
import { goTo, stepTime } from './TimeBar'

export function Readout() {
  const time = useTime((s) => s.time)
  useSettings((s) => s.era)
  const d = dateParts(time)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [bad, setBad] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) requestAnimationFrame(() => input.current?.select())
  }, [editing])
  const go = () => {
    const t = parseTime(text)
    if (t === null) {
      setBad(true)
      return
    }
    setBad(false)
    setEditing(false)
    goTo(t, 0.9)
  }
  const step = (n: number) => (e: React.MouseEvent) => stepTime(e.shiftKey ? n * 10 : n)
  const arrow = 'pointer-events-auto grid size-9 shrink-0 place-items-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-ink'
  return (
    <div className="pointer-events-none mt-4 flex flex-col items-center text-center select-none" aria-live="polite">
      <div className="flex items-center gap-1 sm:gap-2">
        <button type="button" className={arrow} onClick={step(-1)} aria-label="One year earlier (Shift: ten)" title="One step earlier · Shift: ten">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 2 3.5 6l4 4" /></svg>
        </button>
        {editing ? (
          <form
            className="pointer-events-auto flex flex-col items-center"
            onSubmit={(e) => {
              e.preventDefault()
              go()
            }}
          >
            <input
              ref={input}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setBad(false)
              }}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              aria-label={tr('Go to a year')}
              aria-invalid={bad}
              placeholder="1066, 44 BC, 20 ka, 65 Ma"
              className="glass w-[min(78vw,340px)] rounded-2xl px-4 py-2 text-center font-display text-[30px] text-ink placeholder:text-[18px] placeholder:text-dim focus:outline-none sm:text-[38px]"
            />
            <span className={`mt-1 text-[11.5px] ${bad ? 'text-[#ff9ec7]' : 'text-dim'}`}>{bad ? 'Try 1066, 44 BC, 12000 years ago, 20 ka or 65 Ma' : 'Enter to go · Esc to cancel'}</span>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setText(d.unit.includes('ago') ? '' : String(Math.floor(time) <= 0 ? `${1 - Math.floor(time)} BC` : Math.floor(time)))
              setEditing(true)
            }}
            className="pointer-events-auto flex items-baseline gap-2.5 rounded-2xl px-2 drop-shadow-[0_2px_18px_rgba(0,0,0,.7)] hover:bg-white/[.05] focus-visible:bg-white/[.05]"
            aria-label={`${d.value} ${d.unit}. Click to type a year`}
            title="Click to type any year"
          >
            {d.approx && !d.unit.includes('ago') && <span className="font-display text-2xl text-mist italic">c.</span>}
            <span className="font-display text-[44px] leading-none tracking-tight text-ink tnum sm:text-[60px]">{d.value}</span>
            <span className="font-display text-xl text-mist italic sm:text-2xl">{d.unit}</span>
          </button>
        )}
        <button type="button" className={arrow} onClick={step(1)} aria-label="One year later (Shift: ten)" title="One step later · Shift: ten" disabled={time >= PRESENT}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2l4 4-4 4" /></svg>
        </button>
      </div>
    </div>
  )
}

export function Hud() {
  const on = useSettings((s) => s.hud)
  const time = useTime((s) => s.time)
  const period = periodAt(time)
  const age = ageAt(time)
  const pop = worldPopAt(time)
  const items: { k: string; v: string }[] = []
  items.push({ k: age ? 'Era' : 'Period', v: age?.name ?? period?.name ?? '' })
  if (age && period && period.name !== 'Holocene') items.push({ k: 'Epoch', v: period.name })
  if (pop) items.push({ k: 'World population', v: `${pop.estimated ? '~' : ''}${formatPopulation(pop.value)}` })
  else if (period?.life) items.push({ k: 'Life', v: period.life })
  if (age?.powers) items.push({ k: 'Powers', v: age.powers })
  else if (period?.climate) items.push({ k: 'Climate', v: period.climate })
  if (!on) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.6 }}
      className="glass-soft pointer-events-auto mx-auto mt-2 hidden w-fit max-w-[min(1040px,calc(100vw-32px))] items-center gap-0 overflow-hidden rounded-full px-1 py-1 md:flex"
      role="status"
      aria-label="World at this time"
    >
      {items.map((it, i) => (
        <div key={it.k} className={`flex min-w-0 items-baseline gap-2 px-3.5 py-0.5 ${i ? 'border-l border-white/8' : ''}`}>
          <span className="shrink-0 text-[9.5px] font-semibold tracking-[0.16em] text-dim uppercase">{tr(it.k)}</span>
          <span className="truncate text-[12px] text-ink/90 tnum">{it.v}</span>
        </div>
      ))}
    </motion.div>
  )
}
