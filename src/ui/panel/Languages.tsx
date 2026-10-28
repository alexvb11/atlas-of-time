import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTime } from '../../time/store'
import type { EntityIndex, Language, LangSpan } from '../../data/entities'
import type { Resolution } from '../../data/resolve'

/** Shares at t, blending into the next span over the last 20% of each span so charts morph */
function sharesAt(spans: LangSpan[], t: number): Map<string, number> {
  const out = new Map<string, number>()
  const i = spans.findIndex((s) => t >= s[0] && t < s[1])
  if (i < 0) return out
  const [a, b, list] = spans[i]
  const next = spans[i + 1]
  const blendStart = a + (b - a) * 0.8
  const f = next && next[0] === b && t > blendStart ? (t - blendStart) / (b - blendStart) : 0
  for (const [id, s] of list) out.set(id, s * (1 - f))
  if (f > 0) for (const [id, s] of next[2]) out.set(id, (out.get(id) ?? 0) + s * f)
  return out
}

const W = 380
const H = 210

/** Deterministic bubble packing: big ones near the centre, relaxed to avoid overlaps */
function pack(items: { id: string; r: number }[]) {
  const pos = items.map((it, i) => {
    const a = i * 2.39996
    const d = i === 0 ? 0 : 30 + i * 9
    return { id: it.id, r: it.r, x: W / 2 + Math.cos(a) * d * 1.5, y: H / 2 + Math.sin(a) * d * 0.7 }
  })
  for (let iter = 0; iter < 120; iter++) {
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const p = pos[i], q = pos[j]
        const dx = q.x - p.x, dy = q.y - p.y
        const d = Math.hypot(dx, dy) || 0.01
        const min = p.r + q.r + 6
        if (d < min) {
          const push = (min - d) / 2
          p.x -= (dx / d) * push; p.y -= (dy / d) * push
          q.x += (dx / d) * push; q.y += (dy / d) * push
        }
      }
    for (const p of pos) {
      p.x += (W / 2 - p.x) * 0.02
      p.y += (H / 2 - p.y) * 0.04
      p.x = Math.min(W - p.r - 2, Math.max(p.r + 2, p.x))
      p.y = Math.min(H - p.r - 2, Math.max(p.r + 2, p.y))
    }
  }
  return pos
}

const PALETTE = ['#7fd8ff', '#ffc477', '#9fb7ff', '#8fe3c2', '#e6a3ff', '#ffd8a8', '#a6c8de', '#c7f08a']
function colorFor(l: Language) {
  let h = 0
  for (const c of l.family[0] + (l.family[1] ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const f = () => setVoices(window.speechSynthesis.getVoices())
    f()
    window.speechSynthesis.addEventListener('voiceschanged', f)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', f)
  }, [])
  return voices
}

export function LanguagesTab({ res, idx }: { res: Resolution; idx: EntityIndex }) {
  const t = useTime((s) => s.time)
  const voices = useVoices()

  const { langs, shares, unranked } = useMemo(() => {
    if (res.kind === 'entity') {
      const sh = sharesAt(res.entity.langs, t)
      const list = [...sh.entries()].filter(([, s]) => s > 0.004).sort((a, b) => b[1] - a[1])
      return { langs: list.map(([id]) => idx.languages.get(id)!).filter(Boolean), shares: sh, unranked: [] as string[] }
    }
    if (res.kind === 'country') return { langs: [], shares: new Map(), unranked: res.country.languages }
    return { langs: [], shares: new Map(), unranked: [] as string[] }
  }, [res, idx, t])

  if (!langs.length && !unranked.length) {
    return (
      <p className="text-[13.5px] leading-relaxed text-mist">
        {res.kind === 'deep'
          ? 'No language existed: this was millions of years before humans.'
          : res.kind === 'prehistory' && res.who === 'No humans'
            ? 'No people lived here yet.'
            : 'No written records survive from this place and time, so the languages spoken here are unknown.'}
      </p>
    )
  }

  if (!langs.length) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-dim">Official languages today (speaker shares not yet in this atlas):</p>
        {unranked.map((n) => (
          <div key={n} className="glass-soft rounded-2xl px-3.5 py-2.5 text-[13.5px]">{n}</div>
        ))}
      </div>
    )
  }

  const total = [...shares.values()].reduce((a, b) => a + b, 0) || 1
  const items = langs.map((l) => ({ id: l.id, r: 14 + Math.sqrt((shares.get(l.id) ?? 0) / total) * 70 }))
  const placed = pack(items)

  return (
    <div className="space-y-4">
      <div className="glass-soft relative overflow-hidden rounded-3xl">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Approximate share of speakers">
          <defs>
            <radialGradient id="bub" cx="35%" cy="30%">
              <stop offset="0" stopColor="#fff" stopOpacity=".35" />
              <stop offset=".6" stopColor="#fff" stopOpacity=".04" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {placed.map((p, i) => {
            const l = idx.languages.get(p.id)!
            const c = colorFor(l)
            const share = (shares.get(p.id) ?? 0) / total
            return (
              <motion.g
                key={p.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1, x: p.x, y: p.y }}
                transition={{ type: 'spring', stiffness: 90, damping: 14, delay: i * 0.04 }}
              >
                <motion.circle animate={{ r: p.r }} transition={{ type: 'spring', stiffness: 90, damping: 14 }} fill={c} fillOpacity={0.16} stroke={c} strokeOpacity={0.55} />
                <motion.circle animate={{ r: p.r }} transition={{ type: 'spring', stiffness: 90, damping: 14 }} fill="url(#bub)" />
                {p.r > 22 && (
                  <>
                    <text textAnchor="middle" y={-2} className="fill-ink text-[10.5px] font-medium">{l.name.length > 16 && p.r < 40 ? l.name.split(' ')[0] : l.name}</text>
                    <text textAnchor="middle" y={12} className="fill-mist text-[9.5px]">~{Math.round(share * 100)}%</text>
                  </>
                )}
              </motion.g>
            )
          })}
        </svg>
        <div className="absolute right-3 bottom-2 text-[9.5px] text-dim italic">approximate shares, estimated</div>
      </div>

      <FamilyTree langs={langs} />

      <ul className="space-y-2">
        {langs.map((l, i) => {
          const voice = l.voice ? voices.find((v) => v.lang.toLowerCase().startsWith(l.voice!.toLowerCase().slice(0, 2))) : undefined
          const g = l.hello ?? (l.attested ? { text: l.attested.text, roman: l.attested.roman } : null)
          return (
            <motion.li
              key={l.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 24 }}
              className="glass-soft flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorFor(l), boxShadow: `0 0 10px ${colorFor(l)}` }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] text-ink">{l.name}</span>
                  <span className="truncate text-[12px] text-mist">{l.native !== '—' ? l.native : ''}</span>
                </div>
                {g ? (
                  <div className="mt-0.5 text-[12.5px] text-ink/80">
                    <span className="font-display text-[16px]">{g.text}</span> <span className="text-mist italic">{g.roman}</span>
                    {l.hello?.note && <span className="text-dim">, {l.hello.note}</span>}
                    {!l.hello && l.attested && <span className="text-dim">: attested word, {l.attested.meaning}</span>}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[12px] text-dim">{l.note ?? 'No greeting recorded.'}</div>
                )}
                {l.reconstructed && g && <div className="text-[10.5px] text-dim italic">Pronunciation is a scholarly reconstruction.</div>}
              </div>
              {l.hello && voice && (
                <button
                  type="button"
                  className="bubble grid size-8 shrink-0 place-items-center text-cyan"
                  aria-label={`Hear "${l.hello.text}" in ${l.name}`}
                  onClick={() => {
                    const u = new SpeechSynthesisUtterance(l.hello!.text)
                    u.voice = voice
                    u.lang = voice.lang
                    u.rate = 0.9
                    window.speechSynthesis.cancel()
                    window.speechSynthesis.speak(u)
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M1 4.2h2.2L6.4 1.5v9L3.2 7.8H1z" /><path d="M8.2 3.5a3.2 3.2 0 0 1 0 5M9.8 2a5.2 5.2 0 0 1 0 8" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
                </button>
              )}
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

/** Compact family tree: every node on an active language's path is lit */
function FamilyTree({ langs }: { langs: Language[] }) {
  type Node = { name: string; children: Map<string, Node>; leaf?: Language }
  const root: Node = { name: '', children: new Map() }
  for (const l of langs) {
    let n = root
    l.family.forEach((f, i) => {
      if (!n.children.has(f)) n.children.set(f, { name: f, children: new Map() })
      n = n.children.get(f)!
      if (i === l.family.length - 1) n.leaf = l
    })
  }
  const rows: { depth: number; name: string; leaf: boolean }[] = []
  const walk = (n: Node, d: number) => {
    for (const c of n.children.values()) {
      // collapse single-child chains of inner nodes to keep it compact
      let cur = c
      let label = c.name
      while (!cur.leaf && cur.children.size === 1) {
        cur = [...cur.children.values()][0]
        label += ` › ${cur.name}`
      }
      rows.push({ depth: d, name: label, leaf: !!cur.leaf })
      walk(cur, d + 1)
    }
  }
  walk(root, 0)
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">Language families</h3>
      <div className="glass-soft rounded-2xl px-3 py-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center text-[12px] leading-6" style={{ paddingLeft: r.depth * 14 }}>
            {r.depth > 0 && <span className="mr-1.5 inline-block h-px w-2.5 bg-cyan/40" />}
            <span className={r.leaf ? 'text-ink' : 'text-cyan/80'}>{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
