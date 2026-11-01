// The Layers menu (bottom left): switches for optional map layers, and the legend and source notes
// for whichever are showing at the current date.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLayers, type LayerKey } from '../time/layers'
import { useTime } from '../time/store'
import { TRADE_ROUTES, routeAlpha } from '../data/trade'
import { DENSITY_STOPS } from '../scene/Density'
import { greenSaharaAt, iceAt, seaLevelAt } from '../time/climate'
import { subsolarAt } from '../scene/world'
import { PRESENT, toMa } from '../time/scale'

const ITEMS: { id: LayerKey; label: string; sub: string }[] = [
  { id: 'trade', label: 'Trade routes', sub: 'Silk Road, Hansa, galleons… while in use' },
  { id: 'density', label: 'Population density', sub: 'People per km², today’s borders, 10,000 BCE on' },
  { id: 'cities', label: 'Cities', sub: 'Recorded populations of major cities' },
  { id: 'sun', label: 'Seasons and daylight', sub: 'The sun’s height for the time of year; live today' },
]

export function LayersMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const layers = useLayers()
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} className="bubble flex items-center gap-2 px-3.5 py-2 text-[12px] text-mist">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M8 2 1.5 5.5 8 9l6.5-3.5zM1.5 8.5 8 12l6.5-3.5M1.5 11.5 8 15l6.5-3.5" /></svg>
        <span className="hidden sm:inline">Layers</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="group"
            aria-label="Map layers"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass absolute bottom-12 left-0 w-[300px] rounded-[20px] p-1.5"
          >
            {ITEMS.map((it) => (
              <label key={it.id} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/[.07]">
                <span className="flex-1">
                  <span className="block text-[13px] text-ink">{it.label}</span>
                  <span className="block text-[11px] text-mist">{it.sub}</span>
                </span>
                <input type="checkbox" role="switch" checked={layers[it.id]} onChange={() => layers.toggle(it.id)} className="peer sr-only" />
                <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-white/12 transition-colors peer-checked:bg-cyan/70 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/60 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-4" />
              </label>
            ))}
            <p className="px-3 pt-1 pb-2 text-[10.5px] leading-snug text-dim">
              Ice sheets, sea level and the Green Sahara follow the date automatically.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Legend and source notes for the layers visible at the current date (above the corner buttons) */
export function LayerNotes() {
  const t = useTime((s) => s.time)
  const { density, trade, sun } = useLayers()
  const notes: { key: string; node: React.ReactNode }[] = []
  const deep = toMa(t) > 0.02
  if (density && !deep && t >= -9999)
    notes.push({
      key: 'density',
      node: (
        <div>
          <div className="mb-1 text-mist">People per km²</div>
          <div className="h-2 w-[168px] rounded-full" style={{ background: `linear-gradient(90deg, ${DENSITY_STOPS.map(([, c]) => c).join(',')})` }} />
          <div className="mt-0.5 mb-1 flex w-[168px] justify-between text-[10px] text-dim tnum">
            <span>0.1</span><span>1</span><span>10</span><span>100</span><span>1k+</span>
          </div>
          <div className="text-dim">Within today’s borders · HYDE 3.2 and UN estimates via Our World in Data</div>
        </div>
      ),
    })
  if (trade && !deep) {
    const live = TRADE_ROUTES.filter((r) => routeAlpha(r, t) > 0)
    if (live.length) notes.push({ key: 'trade', node: <span className="text-dim">Trade routes: schematic paths between attested stops; years of use approximate</span> })
  }
  if (sun && !deep) {
    const [, lat] = subsolarAt(t)
    const live = t >= PRESENT - 0.002
    notes.push({
      key: 'sun',
      node: (
        <span className="text-dim">
          Sun overhead at {Math.abs(lat).toFixed(1)}°{lat >= 0 ? 'N' : 'S'}
          {live ? ', where it is noon now (live)' : ' for this time of year; time of day not known'}
        </span>
      ),
    })
  }
  const green = greenSaharaAt(t)
  if (green > 0.2) notes.push({ key: 'green', node: <span className="text-dim">Green Sahara: African Humid Period, about 14,800–5,000 years ago · extent approximate</span> })
  else if (iceAt(t) > 0.15 && !deep)
    notes.push({ key: 'ice', node: <span className="text-dim">Ice age: sea level about {Math.round(-seaLevelAt(t))} m lower than today · ice-sheet extent estimated</span> })
  return (
    <div className="pointer-events-none fixed bottom-[max(64px,calc(env(safe-area-inset-bottom)+48px))] left-4 z-[44] hidden max-w-[380px] flex-col gap-1.5 text-[11px] md:flex">
      <AnimatePresence>
        {notes.map((n) => (
          <motion.div key={n.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-xl px-3 py-2 leading-snug">
            {n.node}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
