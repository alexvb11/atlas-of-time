// Big date readout, and the global HUD strip (world state at time T).
import { motion } from 'framer-motion'
import { useTime } from '../time/store'
import { dateParts, formatPopulation } from '../time/format'
import { ageAt, periodAt, worldPopAt } from '../time/eras'

export function Readout() {
  const time = useTime((s) => s.time)
  const d = dateParts(time)
  return (
    <div className="pointer-events-none mt-4 flex flex-col items-center text-center select-none" aria-live="polite">
      <div className="flex items-baseline gap-2.5 drop-shadow-[0_2px_18px_rgba(0,0,0,.7)]">
        {d.approx && !d.unit.includes('ago') && <span className="font-display text-2xl text-mist italic">c.</span>}
        <span className="font-display text-[44px] leading-none tracking-tight text-ink tnum sm:text-[60px]">{d.value}</span>
        <span className="font-display text-xl text-mist italic sm:text-2xl">{d.unit}</span>
      </div>
    </div>
  )
}

export function Hud() {
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
          <span className="shrink-0 text-[9.5px] font-semibold tracking-[0.16em] text-dim uppercase">{it.k}</span>
          <span className="truncate text-[12px] text-ink/90 tnum">{it.v}</span>
        </div>
      ))}
    </motion.div>
  )
}
