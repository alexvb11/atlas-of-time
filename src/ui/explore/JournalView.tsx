import { useJournal, clearJournal } from '../../data/journal'
import { useTime } from '../../time/store'
import { useReader } from '../wiki/store'
import { goTo } from '../TimeBar'
import { formatYear } from '../../time/format'

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export default function JournalView() {
  const j = useJournal()
  const empty = !j.places.length && !j.articles.length
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {[
          [j.places.length, 'places'],
          [j.eras.length, 'eras'],
          [j.articles.length, 'articles'],
        ].map(([n, l]) => (
          <div key={l} className="glass-soft rounded-2xl px-3 py-2.5 text-center">
            <div className="font-display text-[26px] leading-none text-amber tnum">{n}</div>
            <div className="mt-1 text-[11px] text-mist">{l}</div>
          </div>
        ))}
      </div>
      {j.quiz.played > 0 && <p className="mt-2 text-[12px] text-mist">Quiz: {j.quiz.played} played, best score {j.quiz.best}.</p>}
      {empty && <p className="mt-4 text-[13.5px] leading-relaxed text-mist">Click anywhere on the globe or open an article, and it will be remembered here, in this browser only.</p>}
      {j.eras.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">Eras visited</h3>
          <div className="flex flex-wrap gap-1.5">
            {j.eras.map((e) => (
              <span key={e} className="rounded-full bg-white/[.06] px-2.5 py-1 text-[11.5px] text-ink">{e}</span>
            ))}
          </div>
        </section>
      )}
      {j.places.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">Places</h3>
          <ul className="space-y-1">
            {j.places.slice(0, 40).map((p) => (
              <li key={`${p.name}-${p.when}`}>
                <button
                  type="button"
                  onClick={() => {
                    goTo(p.t, 1.1)
                    useTime.getState().select(p.at)
                  }}
                  className="flex w-full items-baseline gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/[.06]"
                >
                  <span className="text-[13px] text-ink">{p.name}</span>
                  <span className="text-[11.5px] text-cyan tnum">{formatYear(p.t)}</span>
                  <span className="ml-auto text-[10.5px] text-dim">{ago(p.when)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {j.articles.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">Articles read</h3>
          <ul className="space-y-1">
            {j.articles.slice(0, 60).map((a) => (
              <li key={a.title}>
                <button type="button" onClick={() => useReader.getState().open(a.title)} className="flex w-full items-baseline gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/[.06]">
                  <span className="text-[13px] text-ink">{a.title}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-dim">{ago(a.when)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!empty && (
        <button type="button" onClick={() => confirm('Clear your journal in this browser?') && clearJournal()} className="mt-6 text-[11.5px] text-dim underline hover:text-mist">
          Clear journal
        </button>
      )}
    </div>
  )
}
