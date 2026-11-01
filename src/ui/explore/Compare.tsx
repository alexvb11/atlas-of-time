// Compare two years: the time slider is one year, this sheet picks the other. The other year's
// borders are drawn over the globe as a pink ghost, and the lists say which states and peoples are
// on one map and not the other. Closing the sheet removes the ghost.
import { useEffect, useMemo, useState } from 'react'
import { useTime } from '../../time/store'
import { getSnapshot, historyYears, loadHistoryIndex, loadSnapshot, onHistoryChange, snapshotIndexAt, type Snapshot } from '../../data/history'
import { formatYear } from '../../time/format'
import { parseYearQuery } from '../CommandPalette'
import { animateTo } from '../TimeBar'
import { timeToU } from '../../time/scale'

const PAIRS: { label: string; a: number; b: number }[] = [
  { label: 'Before and after the First World War', a: 1914, b: 1920 },
  { label: 'Europe before and after Napoleon', a: 1789, b: 1815 },
  { label: 'The Mongol Empire at its height', a: 1200, b: 1279 },
  { label: 'Rome: republic to empire', a: -199, b: 117 },
  { label: 'Decolonisation of Africa', a: 1950, b: 1970 },
  { label: 'The end of the Cold War', a: 1989, b: 1993 },
]

function useSnapshotAt(t: number | null): Snapshot | null {
  const [, bump] = useState(0)
  useEffect(() => {
    loadHistoryIndex()
    return onHistoryChange(() => bump((x) => x + 1))
  }, [])
  const i = t === null ? -1 : snapshotIndexAt(t)
  const y = i >= 0 ? historyYears[i] : null
  useEffect(() => {
    if (y !== null) loadSnapshot(y)
  }, [y])
  return y === null ? null : (getSnapshot(y) ?? null)
}

/** Names on map a and not on map b, largest first */
function onlyIn(a: Snapshot, b: Snapshot) {
  const names = new Set(b.polities.map((p) => p.name))
  const seen = new Set<string>()
  return a.polities
    .filter((p) => p.name && !names.has(p.name) && !seen.has(p.name) && seen.add(p.name))
    .sort((x, y) => y.area - x.area)
}

export default function Compare() {
  const time = useTime((s) => s.time)
  const other = useTime((s) => s.compare)
  const [q, setQ] = useState('')
  const [bad, setBad] = useState(false)
  // opening the sheet without a second year: start a century earlier
  useEffect(() => {
    if (useTime.getState().compare === null) useTime.getState().set({ compare: Math.floor(useTime.getState().time) - 100 })
    return () => useTime.getState().set({ compare: null })
  }, [])
  const a = useSnapshotAt(time)
  const b = useSnapshotAt(other)
  const diff = useMemo(() => (a && b ? { gone: onlyIn(a, b), added: onlyIn(b, a) } : null), [a, b])
  const yearA = Math.floor(time)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseYearQuery(q.trim())
    if (!p) return setBad(true)
    setBad(false)
    useTime.getState().set({ compare: p.year })
    setQ('')
  }

  return (
    <div className="text-[13px]">
      <p className="mb-3 leading-relaxed text-mist">
        The globe shows <b className="text-ink">{formatYear(time)}</b>; the borders of <b className="text-[#ff9ec7]">{other === null ? '…' : formatYear(other)}</b> are drawn over it in pink. Move the time slider to change the first year.
      </p>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Other year, e.g. 1648 or 44 BC"
          aria-label="Year to compare with"
          aria-invalid={bad}
          className="min-w-0 flex-1 rounded-full border border-white/12 bg-black/25 px-4 py-2 text-ink placeholder:text-dim focus:border-cyan/60 focus:outline-none"
        />
        <button type="submit" className="bubble px-4 py-2 text-ink">Compare</button>
      </form>
      {bad && <p className="-mt-2 mb-3 text-[12px] text-[#ff9ec7]">Type a year like 1648, 1066 or 44 BC.</p>}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {other !== null && (
          <button
            type="button"
            className="bubble px-3 py-1.5 text-[12px] text-mist"
            onClick={() => {
              useTime.getState().set({ compare: yearA })
              animateTo(timeToU(other + 0.5))
            }}
          >
            ⇄ Swap the two years
          </button>
        )}
        {PAIRS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="bubble px-3 py-1.5 text-[12px] text-mist"
            onClick={() => {
              useTime.getState().set({ compare: p.b })
              animateTo(timeToU(p.a + 0.5))
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {!diff ? (
        <div className="shimmer h-24 rounded-2xl" />
      ) : (
        <div className="grid gap-4">
          <DiffList title={`On the ${formatYear(time)} map only`} items={diff.gone} tone="text-cyan" />
          <DiffList title={`On the ${other === null ? '' : formatYear(other)} map only`} items={diff.added} tone="text-[#ff9ec7]" />
          <p className="text-[11px] leading-snug text-dim">Compared by name on each year’s border map. A state renamed between the two years appears in both lists.</p>
        </div>
      )}
    </div>
  )
}

function DiffList({ title, items, tone }: { title: string; items: Snapshot['polities']; tone: string }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 14)
  return (
    <section>
      <h3 className={`mb-1.5 text-[12px] font-semibold tracking-wide uppercase ${tone}`}>
        {title} <span className="text-dim">· {items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-mist">Nothing: the same names on both maps.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => useTime.getState().select(p.label)}
                className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[12px] text-ink hover:border-white/30"
              >
                {p.name}
              </button>
            </li>
          ))}
          {items.length > shown.length && (
            <li>
              <button type="button" onClick={() => setAll(true)} className="px-2 py-1 text-[12px] text-cyan hover:underline">
                +{items.length - shown.length} more
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
