import { useEffect, useRef, useState } from 'react'
import { useTime } from '../../time/store'
import { useReader } from '../wiki/store'
import { goTo } from '../TimeBar'
import { formatYear } from '../../time/format'
import { loadEvents } from '../../scene/Events'
import { JOURNEYS } from '../../data/journeys'
import { loadHistoryIndex, historyYears, snapshotIndexAt, loadSnapshot, polityAt } from '../../data/history'
import { loadPlaceEvents } from '../../data/places'
import { recordQuiz } from '../../data/journal'
import { loadArticleIndex } from '../../data/wiki'

// Two kinds of question, alternating over six rounds:
//   where: an event and its year; click the globe where it happened (scored by distance)
//   ruler: a pin and a year; pick who ruled there, as the border data for that date draws it
// Answers come from the atlas's own dated data, so the quiz never asks what the atlas can't show.

type Where = { kind: 'where'; title: string; t: number; at: [number, number]; article?: string }
type Ruler = { kind: 'ruler'; t: number; at: [number, number]; answer: string; options: string[]; place: string }
type Q = Where | Ruler
const ROUNDS = 6

const R = 6371
const km = ([a, b]: [number, number], [c, d]: [number, number]) => {
  const r = Math.PI / 180
  const h = Math.sin(((d - b) * r) / 2) ** 2 + Math.cos(b * r) * Math.cos(d * r) * Math.sin(((c - a) * r) / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])
// border-data labels that describe a way of life, not a ruler
const GENERIC = /hunter|gatherer|farmers|foragers|pastoral|nomads|cultures?$|peoples?$|tribes|states$|kingdoms$|city-states|chiefdoms|settlements|minor/i

async function whereQuestion(): Promise<Where> {
  const [{ events }, articles] = await Promise.all([loadEvents(), loadArticleIndex()])
  const pool: Where[] = [
    ...events.filter((e) => e.t > -3000).map((e) => ({ kind: 'where' as const, title: e.title, t: e.t, at: e.at, article: articles.events[`ev:${e.id}`] })),
    ...JOURNEYS.flatMap((j) => j.stops.filter((s) => !s.approx).map((s) => ({ kind: 'where' as const, title: s.title, t: s.t, at: s.at, article: s.article }))),
  ]
  return pick(pool)
}

async function rulerQuestion(): Promise<Ruler | null> {
  await loadHistoryIndex()
  const { events } = await loadPlaceEvents()
  for (let tries = 0; tries < 25; tries++) {
    const e = pick(events)
    const t = Math.floor(e[2])
    if (t < -1500 || t > 2020) continue
    const i = snapshotIndexAt(t)
    if (i < 0) continue
    const snap = await loadSnapshot(historyYears[i])
    const at: [number, number] = [e[0], e[1]]
    const p = polityAt(snap, at[0], at[1])
    if (!p || GENERIC.test(p.name)) continue
    const others = [...new Set(snap.polities.filter((q) => q.name !== p.name && !GENERIC.test(q.name) && q.area > 0.002).sort((a, b) => km(a.label, at) - km(b.label, at)).map((q) => q.name))].slice(0, 8)
    if (others.length < 3) continue
    return { kind: 'ruler', t, at, answer: p.name, options: shuffle([p.name, ...shuffle(others).slice(0, 3)]), place: e[3] }
  }
  return null
}

export default function Quiz() {
  const [round, setRound] = useState(0)
  const [q, setQ] = useState<Q | null>(null)
  const [result, setResult] = useState<{ points: number; text: string } | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const asked = useRef(0)

  const next = async (r: number) => {
    setResult(null)
    setQ(null)
    const nq = r % 2 === 0 ? await whereQuestion() : ((await rulerQuestion()) ?? (await whereQuestion()))
    asked.current = performance.now()
    setQ(nq)
    goTo(nq.t, 1.2)
    if (nq.kind === 'ruler') {
      useTime.getState().select(nq.at)
      useTime.getState().set({ herePins: [{ lon: nq.at[0], lat: nq.at[1], n: 1, hot: true }] })
    } else {
      useTime.getState().select(null, false)
      useTime.getState().set({ herePins: [] })
    }
  }
  useEffect(() => {
    next(0)
    return () => useTime.getState().set({ herePins: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a "where" guess is the first click on the globe after the question appears
  useEffect(() => {
    if (q?.kind !== 'where' || result) return
    return useTime.subscribe(
      (s) => s.selection,
      (sel) => {
        if (!sel || performance.now() - asked.current < 500) return
        const d = km(sel, q.at)
        const points = Math.round(1000 * Math.exp(-d / 900))
        setResult({ points, text: `${Math.round(d).toLocaleString('en-US')} km away.` })
        setScore((s) => s + points)
        useTime.getState().set({ herePins: [{ lon: q.at[0], lat: q.at[1], n: 1, hot: true }] })
      },
    )
  }, [q, result])

  const answerRuler = (opt: string) => {
    if (q?.kind !== 'ruler' || result) return
    const ok = opt === q.answer
    setResult({ points: ok ? 1000 : 0, text: ok ? 'Right.' : `It was ${q.answer}.` })
    if (ok) setScore((s) => s + 1000)
  }

  const advance = () => {
    const r = round + 1
    if (r >= ROUNDS) {
      setDone(true)
      recordQuiz(score)
      useTime.getState().set({ herePins: [] })
      return
    }
    setRound(r)
    next(r)
  }

  if (done)
    return (
      <div className="text-center">
        <div className="mt-6 font-display text-[54px] leading-none text-amber tnum">{score.toLocaleString('en-US')}</div>
        <p className="mt-1 text-[13px] text-mist">out of {(ROUNDS * 1000).toLocaleString('en-US')}</p>
        <button
          type="button"
          onClick={() => {
            setDone(false)
            setScore(0)
            setRound(0)
            next(0)
          }}
          className="bubble mt-5 px-4 py-2 text-[13px] font-medium text-ink"
        >
          Play again
        </button>
      </div>
    )

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-mist">
        <span>
          Question {round + 1} of {ROUNDS}
        </span>
        <span className="tnum">Score {score.toLocaleString('en-US')}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-cyan to-amber transition-all duration-500" style={{ width: `${((round + (result ? 1 : 0)) / ROUNDS) * 100}%` }} />
      </div>
      {!q ? (
        <div className="shimmer mt-4 h-28 rounded-2xl" />
      ) : q.kind === 'where' ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan uppercase">Find the place</p>
          <h3 className="mt-1 font-display text-[24px] leading-tight text-ink">{q.title}</h3>
          <p className="mt-1 text-[13px] text-mist">
            {formatYear(q.t)}. {result ? '' : 'Click the globe where it happened.'}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan uppercase">Name the ruler</p>
          <h3 className="mt-1 font-display text-[22px] leading-tight text-ink">In {formatYear(q.t)}, who held the place marked on the globe?</h3>
          <p className="mt-1 text-[12px] text-mist">The site of: {q.place}</p>
          <div className="mt-3 grid gap-1.5">
            {q.options.map((o) => (
              <button
                key={o}
                type="button"
                disabled={!!result}
                onClick={() => answerRuler(o)}
                className={`rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${result ? (o === q.answer ? 'bg-emerald-400/20 text-ink' : 'bg-white/[.03] text-mist') : 'bg-white/[.06] text-ink hover:bg-white/[.12]'}`}
              >
                {o}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-dim">Answers follow the atlas’s border data for that date{q.t < 1886 ? ', which before 1886 is approximate' : ''}.</p>
        </div>
      )}
      {result && q && (
        <div className="mt-4 rounded-2xl bg-white/[.05] px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[28px] text-amber tnum">+{result.points}</span>
            <span className="text-[13px] text-ink">{result.text}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => useReader.getState().open(q.kind === 'where' ? (q.article ?? q.title) : q.answer)} className="text-[12px] text-cyan hover:underline">
              Read about it
            </button>
            <button type="button" onClick={advance} className="bubble ml-auto px-3.5 py-1.5 text-[12.5px] font-medium text-ink">
              {round + 1 >= ROUNDS ? 'See score' : 'Next →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
