import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../time/store'
import { useSettings } from '../time/settings'
import { usePolityAt } from '../scene/Highlight'
import { supercontinentAt } from '../time/eras'
import { toMa } from '../time/scale'
import { useEntityIndex, flagFor } from '../data/entities'

export function HoverLabel() {
  const showLabel = useSettings((s) => s.hoverLabel)
  const hover = useTime((s) => s.hover)
  const deep = useTime((s) => toMa(s.time) > 2)
  const time = useTime((s) => s.time)
  const polity = usePolityAt(hover?.lonlat ?? null)
  const index = useEntityIndex()
  if (!hover || !showLabel) return null
  let title: string | null = null
  let sub: string | null = null
  let flag: string | null = null
  if (deep) {
    title = supercontinentAt(time).name
    sub = 'Reconstructed crust'
  } else if (polity) {
    const ent = index?.byPolity(polity.name, time)
    title = ent?.nameAt(time) ?? polity.name
    sub = polity.subjectTo ? `under ${polity.subjectTo}` : null
    flag = ent ? flagFor(ent, time) : null
  }
  if (!title) return null
  return (
    <AnimatePresence>
      <motion.div
        key={title}
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="glass pointer-events-none fixed z-20 flex items-center gap-2 rounded-2xl px-3 py-1.5"
        style={{ left: hover.x + 16, top: hover.y + 14 }}
      >
        {flag && <span className="text-base leading-none">{flag}</span>}
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-ink">{title}</div>
          {sub && <div className="text-[11px] text-mist">{sub}</div>}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
