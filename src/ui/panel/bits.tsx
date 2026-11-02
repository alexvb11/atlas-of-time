import { useEffect, useRef } from 'react'
import { animate, useMotionValue, useTransform, motion } from 'framer-motion'
import type { Conf } from '../../data/entities'
import { formatYear } from '../../time/format'
import { useTime } from '../../time/store'
import { goTo } from '../TimeBar'

/** Ticking counter: numbers glide to their new value as time changes */
export function Ticker({ value, format }: { value: number; format: (n: number) => string }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))
  const first = useRef(true)
  const reduced = useTime((s) => s.reducedMotion)
  useEffect(() => {
    if (first.current || reduced) {
      mv.set(value)
      first.current = false
      return
    }
    const c = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] })
    return () => c.stop()
  }, [value, mv, reduced])
  return <motion.span className="tnum">{text}</motion.span>
}

export function ConfTag({ conf, note }: { conf?: Conf; note?: string }) {
  if (!conf || conf === 'documented') return null
  if (conf === 'estimated')
    return (
      <span title={note ?? 'Estimated'} className="ml-1.5 align-middle text-[10px] text-dim italic">
        est.
      </span>
    )
  return (
    <span
      title={note ?? 'Disputed among historians'}
      className="ml-1.5 inline-flex items-center rounded-full border border-amber/30 bg-amber/10 px-1.5 py-px align-middle text-[9.5px] font-semibold tracking-wider text-amber uppercase"
    >
      disputed
    </span>
  )
}

export function Stat({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`glass-soft rounded-2xl px-3.5 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[9.5px] font-semibold tracking-[0.16em] text-dim uppercase">{label}</div>
      <div className="mt-0.5 text-[13.5px] leading-snug text-ink">{children}</div>
    </div>
  )
}

export function YearLink({ t, approx, className = '' }: { t: number; approx?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => goTo(t, 1)}
      className={`rounded-md text-cyan/90 underline-offset-2 transition-colors hover:text-cyan hover:underline ${className}`}
      aria-label={`Jump to ${formatYear(t, approx)}`}
    >
      {formatYear(t, approx)}
    </button>
  )
}

export function dateRange(from: number, to: number, approx = false): string {
  const end = to > 2025 ? 'today' : formatYear(to)
  return `${approx ? 'c. ' : ''}${formatYear(from)} – ${end}`
}
