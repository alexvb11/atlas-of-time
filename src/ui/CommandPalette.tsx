// Cmd/Ctrl+K: jump to any place or entity. Things that exist at the current time rank first;
// picking one from another era jumps the slider there (the row says so before you pick it).
// A year in the query ("Paris 1789", "Rome 44 BC", "1066") goes to that place in that year: the
// place comes from this atlas when it knows it, else from its Wikipedia article's coordinates.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Fuse from 'fuse.js'
import { useTime } from '../time/store'
import { nameAt, useEntityIndex, type Entity, type EntityIndex } from '../data/entities'
import { getSnapshot, historyYears, snapshotIndexAt } from '../data/history'
import { formatYear } from '../time/format'
import { animateTo } from './TimeBar'
import { timeToU, PRESENT } from '../time/scale'
import { term } from '../data/wiki'

type Item = {
  key: string
  label: string
  sub: string
  kind: 'entity' | 'country' | 'polity' | 'goto'
  from: number
  to: number
  where: [number, number] | null
  names: string[]
}

function entityLocation(idx: EntityIndex, e: Entity): [number, number] | null {
  for (const [iso, l] of Object.entries(idx.lineages)) {
    const span = l.spans.find((s) => s[2] === e.id)
    if (!span) continue
    const bb = span[4]
    if (bb) return [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]
    const c = idx.countries.get(iso)
    if (c) return [c.latlng[1], c.latlng[0]]
  }
  if (e.iso3) {
    const c = idx.countries.get(e.iso3)
    if (c) return [c.latlng[1], c.latlng[0]]
  }
  // fall back to where the border data draws it in its first snapshot
  for (const y of historyYears) {
    if (y < e.from || y >= e.to) continue
    const p = getSnapshot(y)?.polities.find((x) => e.match.includes(x.name))
    if (p) return p.label
  }
  return null
}

function buildItems(idx: EntityIndex, t: number): Item[] {
  const items: Item[] = []
  for (const e of idx.all) {
    const names = [e.name, ...e.names.map((n) => n[2]), ...e.match]
    items.push({ key: e.id, label: nameAt(e, Math.max(e.from, Math.min(t, e.to - 1))), sub: e.kind, kind: 'entity', from: e.from, to: e.to, where: entityLocation(idx, e), names })
  }
  for (const c of idx.countries.values()) {
    if (idx.all.some((e) => e.iso3 === c.iso3)) continue
    items.push({ key: c.iso3, label: `${c.flag} ${c.name}`, sub: 'country today', kind: 'country', from: 1945, to: 2027, where: [c.latlng[1], c.latlng[0]], names: [c.name, c.official] })
  }
  const snap = getSnapshot(historyYears[snapshotIndexAt(t)] ?? NaN)
  if (snap) {
    const seen = new Set(items.flatMap((i) => i.names))
    for (const p of snap.polities) {
      if (!p.name || seen.has(p.name)) continue
      seen.add(p.name)
      items.push({ key: p.id, label: p.name, sub: `on the map in ${formatYear(snap.year)}`, kind: 'polity', from: t - 1, to: t + 1, where: p.label, names: [p.name] })
    }
  }
  return items
}

/** "Paris 1789" → { place: 'Paris', year: 1789 }; "44 BC" → astronomical -43; "1066" → year only */
export function parseYearQuery(q: string): { place: string; year: number } | null {
  const m = q.match(/(^|\s)(\d{1,4})\s*(bce|bc|b\.c\.|ce|ad|a\.d\.)?(?=\s|$)/i)
  if (!m) return null
  const n = Number(m[2])
  const bc = /^b/i.test(m[3] ?? '')
  const year = bc ? 1 - n : n
  if (year > PRESENT || (!bc && n === 0)) return null
  const place = (q.slice(0, m.index) + ' ' + q.slice((m.index ?? 0) + m[0].length)).replace(/\s+(in|at|of)\s*$|^\s*(in|at)\s+/i, ' ').trim()
  return { place, year }
}

export function CommandPalette() {
  const open = useTime((s) => s.paletteOpen)
  const time = useTime((s) => s.time)
  const idx = useEntityIndex()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [open])

  const items = useMemo(() => (idx && open ? buildItems(idx, time) : []), [idx, open, time])
  const fuse = useMemo(() => new Fuse(items, { keys: ['label', 'names'], threshold: 0.35, ignoreLocation: true }), [items])
  const yq = useMemo(() => parseYearQuery(q), [q])
  const results = useMemo(() => {
    const text = (yq ? yq.place : q).trim()
    const list = text ? fuse.search(text, { limit: 40 }).map((r) => r.item) : yq ? [] : items.filter((i) => i.kind === 'entity')
    const now = (i: Item) => time >= i.from && time < i.to
    const ranked = [...list.filter(now), ...list.filter((i) => !now(i))].slice(0, yq ? 8 : 12)
    if (!yq) return ranked
    const go: Item = { key: `goto:${yq.place}:${yq.year}`, label: yq.place ? `${yq.place} in ${formatYear(yq.year)}` : `Go to ${formatYear(yq.year)}`, sub: 'jump there', kind: 'goto', from: yq.year, to: yq.year + 1, where: ranked[0]?.where ?? null, names: [yq.place] }
    return [go, ...ranked]
  }, [q, yq, fuse, items, time])

  const close = () => useTime.getState().set({ paletteOpen: false })
  const pick = (it: Item) => {
    close()
    const s = useTime.getState()
    if (it.kind === 'goto') {
      animateTo(timeToU(it.from), 1.2)
      const place = it.names[0]
      if (!place) return
      // Wikipedia knows where most places are; the atlas's own match is the fallback
      term(place)
        .then((d) => d.coords ?? it.where)
        .catch(() => it.where)
        .then((at) => at && setTimeout(() => s.select(at), 500))
      return
    }
    const inEra = time >= it.from && time < it.to
    if (!inEra) animateTo(timeToU(Math.min(it.to - 1, it.from + Math.min(50, (it.to - it.from) / 3))), 1.2)
    if (it.where) setTimeout(() => s.select(it.where), inEra ? 0 : 500)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette"
          className="fixed inset-0 z-50 flex items-start justify-center bg-void/40 px-4 pt-[14vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-label="Search places and eras"
            className="glass w-full max-w-[560px] overflow-hidden rounded-[26px]"
            initial={{ y: -16, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-mist"><circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" strokeLinecap="round" /></svg>
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setActive(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActive((a) => Math.min(results.length - 1, a + 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((a) => Math.max(0, a - 1))
                  } else if (e.key === 'Enter' && results[active]) pick(results[active])
                  else if (e.key === 'Escape') close()
                }}
                placeholder="Search a place, empire, or “Paris 1789”…"
                className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-dim"
                aria-label="Search"
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
              />
              <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-dim">esc</kbd>
            </div>
            <ul id="palette-list" role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
              {results.map((it, i) => {
                const inEra = time >= it.from && time < it.to
                return (
                  <motion.li
                    key={it.key}
                    role="option"
                    aria-selected={i === active}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.018 }}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(it)}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-colors ${i === active ? 'bg-cyan/12' : ''}`}
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${inEra ? 'bg-cyan shadow-[0_0_8px_rgba(127,216,255,.9)]' : 'bg-white/20'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-ink">{it.label}</div>
                      <div className="text-[11.5px] text-dim">
                        {it.sub}
                        {it.kind === 'entity' && ` · ${formatYear(it.from)} – ${it.to > 2025 ? 'today' : formatYear(it.to)}`}
                      </div>
                    </div>
                    {!inEra && it.kind !== 'goto' && <span className="shrink-0 rounded-full bg-amber/12 px-2.5 py-1 text-[11px] text-amber">Jump to {formatYear(it.from)}</span>}
                    {it.kind === 'goto' && <span className="shrink-0 rounded-full bg-cyan/12 px-2.5 py-1 text-[11px] text-cyan">↵ Go</span>}
                  </motion.li>
                )
              })}
              {!results.length && <li className="px-4 py-6 text-center text-[13px] text-dim">Nothing found in this atlas yet.</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
