import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { motion } from 'framer-motion'
import { useTime, type Speed } from '../time/store'
import { timeToU, ZONES, PRESENT, settle, stepFrom } from '../time/scale'
import { MILESTONES, SLIDER_LABELS } from '../time/eras'
import { formatDate } from '../time/format'
import { sound } from './sound'

/** One readout unit forward or back (a year in history): exact, not a slider fraction */
export function stepTime(n: number) {
  const s = useTime.getState()
  s.setPlaying(false)
  s.setTime(stepFrom(s.time, n))
  sound.tick()
}

export function jumpEra(dir: 1 | -1) {
  const s = useTime.getState()
  const us = [...new Set(MILESTONES.map(timeToU))].sort((a, b) => a - b)
  const next = dir > 0 ? us.find((m) => m > s.u + 1e-4) : [...us].reverse().find((m) => m < s.u - 1e-4)
  if (next !== undefined) animateTo(next)
}

/** Glide to time t and land exactly on it */
export const goTo = (t: number, duration = 0.9) => animateTo(timeToU(t), duration, t)

/** Glide the slider to u; with exact, land precisely on that time (slider positions round) */
export function animateTo(u: number, duration = 0.9, exact?: number) {
  const s = useTime.getState()
  const p = { u: s.u }
  gsap.killTweensOf(p)
  s.setPlaying(false)
  gsap.to(p, {
    u,
    duration: s.reducedMotion ? 0.01 : duration,
    ease: 'power3.inOut',
    onUpdate: () => useTime.getState().setU(p.u),
    onComplete: () => {
      if (exact !== undefined) useTime.getState().setTime(exact)
      sound.tick()
    },
  })
}

export function TimeBar() {
  const u = useTime((s) => s.u)
  const time = useTime((s) => s.time)
  const playing = useTime((s) => s.playing)
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  // Shift-drag scrubs at a twentieth of the speed, for landing on an exact year
  const fine = useRef<{ x: number; u: number } | null>(null)

  const uFromEvent = (e: { clientX: number }) => {
    const r = track.current!.getBoundingClientRect()
    return (e.clientX - r.left) / r.width
  }

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const s = useTime.getState()
    s.setScrubbing(true)
    s.setPlaying(false)
    fine.current = e.shiftKey ? { x: e.clientX, u: s.u } : null
    if (!fine.current) s.setU(uFromEvent(e))
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    if (e.shiftKey && !fine.current) fine.current = { x: e.clientX, u: useTime.getState().u }
    if (!e.shiftKey) fine.current = null
    if (fine.current) {
      const w = track.current!.getBoundingClientRect().width
      useTime.getState().setU(fine.current.u + (e.clientX - fine.current.x) / w / 20)
    } else useTime.getState().setU(uFromEvent(e))
  }
  const onUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const s = useTime.getState()
    s.setScrubbing(false)
    fine.current = null
    // stop exactly on the year shown, not between two
    s.setTime(settle(s.time))
  }
  // the wheel over the track steps one year (or readout unit) per notch
  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(d) < 2) return
    stepTime((d > 0 ? -1 : 1) * (e.shiftKey ? 10 : 1))
  }

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const dir = e.key === 'ArrowRight' ? 1 : -1
      if (e.shiftKey) jumpEra(dir)
      else stepTime(dir * (e.altKey ? 10 : 1))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      stepTime(e.key === 'PageUp' ? 100 : -100)
    } else if (e.key === 'Home') animateTo(0)
    else if (e.key === 'End') animateTo(1)
  }, [])

  // keep only labels that fit: majors first, then minors, no two closer than their half-widths
  const [trackW, setTrackW] = useState(800)
  useEffect(() => {
    const el = track.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const labels = useMemo(() => {
    const all = SLIDER_LABELS.map((l) => ({ ...l, u: timeToU(l.t), w: l.label.length * 5.6 + 14 }))
    const kept: typeof all = []
    for (const l of [...all.filter((x) => x.major), ...all.filter((x) => !x.major)]) {
      const x = l.u * trackW
      if (x - l.w / 2 < -6 || x + l.w / 2 > trackW + 6) continue
      if (kept.every((k) => Math.abs(k.u * trackW - x) > (k.w + l.w) / 2)) kept.push(l)
    }
    return kept
  }, [trackW])

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.1 }}
      className="glass pointer-events-auto relative mx-auto w-full max-w-[1040px] rounded-[28px] px-4 pt-2.5 pb-3 sm:px-6"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="bubble grid size-10 shrink-0 place-items-center text-ink"
          aria-label={playing ? 'Pause time' : 'Play through time'}
          onClick={() => useTime.getState().setPlaying(!playing)}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1.5" width="3.6" height="11" rx="1.2"/><rect x="8.4" y="1.5" width="3.6" height="11" rx="1.2"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3.5 1.8v10.4c0 .6.7 1 1.2.7l8.2-5.2a.8.8 0 0 0 0-1.4L4.7 1.1c-.5-.3-1.2 0-1.2.7Z"/></svg>
          )}
        </button>
        <SpeedPicker />

        {/* track */}
        <div className="relative min-w-0 flex-1">
          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-label="Time"
            aria-valuemin={0}
            aria-valuemax={1000}
            aria-valuenow={Math.round(u * 1000)}
            aria-valuetext={formatDate(time)}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
            onWheel={onWheel}
            className="group relative h-11 cursor-grab touch-none select-none rounded-xl active:cursor-grabbing"
          >
            {/* zones */}
            {ZONES.map((z, i) => (
              <div
                key={z.label}
                className="absolute top-[26px] h-[3px] rounded-full"
                style={{
                  left: `calc(${z.u0 * 100}% + ${i ? 2 : 0}px)`,
                  width: `calc(${(z.u1 - z.u0) * 100}% - ${i ? 2 : 0}px)`,
                  background: ['rgba(255,196,119,.22)', 'rgba(170,190,220,.2)', 'rgba(127,216,255,.24)'][i],
                }}
              >
                <span className="absolute -top-[25px] left-0 hidden text-[9.5px] font-semibold tracking-[0.18em] text-dim uppercase md:block">{z.label}</span>
              </div>
            ))}
            {/* elapsed glow */}
            <div className="pointer-events-none absolute top-[26px] left-0 h-[3px] rounded-full bg-gradient-to-r from-amber/50 via-mist/40 to-cyan" style={{ width: `${u * 100}%`, opacity: 0.55 }} />
            {/* era ticks */}
            {labels.map((l) => (
              <div key={l.label} className="pointer-events-none absolute top-[22px]" style={{ left: `${l.u * 100}%` }}>
                <div className={`mx-auto w-px ${l.major ? 'h-[11px] bg-ink/45' : 'h-[7px] translate-y-[2px] bg-ink/25'}`} />
                <div
                  className={`absolute top-[14px] -translate-x-1/2 whitespace-nowrap text-[10px] tracking-wide ${l.major ? 'text-mist' : 'text-dim'}`}
                >
                  {l.label}
                </div>
              </div>
            ))}
            {/* thumb */}
            <div className="pointer-events-none absolute top-[27.5px]" style={{ left: `${u * 100}%` }}>
              <div className="absolute -top-[13px] left-1/2 h-[26px] w-[2px] -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_14px_2px_rgba(127,216,255,.6)]" />
              <div className="absolute top-0 left-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-cyan shadow-[0_0_18px_4px_rgba(127,216,255,.45)] transition-transform duration-300 group-hover:scale-125 group-active:scale-110" />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="bubble shrink-0 px-3.5 py-2 text-[12px] font-medium text-ink disabled:opacity-40"
          onClick={() => animateTo(1, 1.4)}
          disabled={time >= PRESENT}
          aria-label="Return to today"
        >
          <span className="hidden sm:inline">Today</span>
          <svg className="sm:hidden" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2v10M12 2 6 7l6 5"/></svg>
        </button>
      </div>
    </motion.div>
  )
}

/** Global keyboard: arrows nudge time when nothing else is focused */
export function useTimeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.getAttribute?.('role') === 'slider') return
      // the reader and hover cards keep arrows, space and Escape for themselves
      if ((e.target as HTMLElement)?.closest?.('[data-keys-local]')) return
      const s = useTime.getState()
      if (s.paletteOpen) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir = e.key === 'ArrowRight' ? 1 : -1
        if (e.shiftKey) jumpEra(dir)
        else stepTime(dir * (e.altKey ? 10 : 1))
      } else if (e.key === ' ' && tag !== 'BUTTON') {
        e.preventDefault()
        s.setPlaying(!s.playing)
      } else if (e.key === 'Escape' && s.selection) s.select(null, false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * Its own component so the shared-layout pill is not re-rendered (and re-measured by Framer Motion)
 * on every frame while the time bar scrubs.
 */
const SpeedPicker = memo(function SpeedPicker() {
  const speed = useTime((s) => s.speed)
  return (
    <div className="glass-soft hidden shrink-0 items-center rounded-full p-0.5 sm:flex" role="radiogroup" aria-label="Playback speed">
      {([1, 5, 25] as Speed[]).map((sp) => (
        <button
          key={sp}
          type="button"
          role="radio"
          aria-checked={speed === sp}
          onClick={() => useTime.getState().setSpeed(sp)}
          className={`relative rounded-full px-2.5 py-1 text-[11px] font-medium tnum transition-colors ${speed === sp ? 'text-void' : 'text-mist hover:text-ink'}`}
        >
          {speed === sp && (
            <motion.span layoutId="speed-pill" className="absolute inset-0 rounded-full bg-cyan" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
          <span className="relative">{sp}×</span>
        </button>
      ))}
    </div>
  )
})
