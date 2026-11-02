import { useEffect, useState } from 'react'
import { recordArticle } from '../../data/journal'
import { article, film, term, useAsync, LANGS, getLang, displayTitle, type Block, type Inline } from '../../data/wiki'
import { Film } from './Film'
import { TermLink } from './Term'
import { useReader } from './store'
import { ReportMistake } from '../ReportMistake'

export function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return p
        const inner = p.b ? <b className="font-semibold text-ink">{p.text}</b> : p.i ? <i>{p.text}</i> : p.text
        return p.link ? (
          <TermLink key={i} title={p.link}>
            {inner}
          </TermLink>
        ) : (
          <span key={i}>{inner}</span>
        )
      })}
    </>
  )
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-2.5 text-[13.5px] leading-[1.65] text-ink/85">
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>
            <Parts parts={b.parts} />
          </p>
        ) : (
          <p key={i} className="relative pl-4 before:absolute before:top-[0.7em] before:left-1 before:size-1 before:rounded-full before:bg-cyan/70">
            <Parts parts={b.parts} />
          </p>
        ),
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2.5" aria-label="Loading article">
      {[100, 96, 92, 98, 70].map((w, i) => (
        <div key={i} className="shimmer h-3.5 rounded" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

/**
 * One article: the film of its pictures, the whole lead, and Background / Aftermath.
 * `inline` is the History-tab dropdown: sections fold, and a button carries it into the reader.
 */
export function ArticleView({ title, inline = false, subtitle }: { title: string; inline?: boolean; subtitle?: string | null }) {
  const a = useAsync(title, article)
  const f = useAsync(title, film)
  const t = useAsync(title.split('#')[0], term)
  const [retry, setRetry] = useState(0)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  useEffect(() => {
    if (a.data) recordArticle(a.data.title)
  }, [a.data])

  return (
    <div>
      <div className={`overflow-hidden ${inline ? 'rounded-2xl' : 'rounded-[22px]'} ring-1 ring-white/10`}>
        <Film title={a.data?.title ?? displayTitle(title)} subtitle={subtitle ?? t.data?.description} shots={f.data} poster={t.data?.thumb} failed={f.error} />
      </div>
      <div className="mt-3.5">
        {a.error ? (
          <div className="rounded-2xl bg-white/5 p-3 text-[13px] text-mist">
            Couldn’t reach Wikipedia.{' '}
            <button
              type="button"
              className="text-cyan underline"
              onClick={() => {
                setRetry(retry + 1)
                article(title).catch(() => {})
              }}
            >
              Try again
            </button>
          </div>
        ) : !a.data ? (
          <Skeleton />
        ) : (
          <>
            {a.data.fallback && <p className="mb-2 text-[11.5px] text-dim italic">No {LANGS[getLang()]} article on this; showing the English one.</p>}
            <Blocks blocks={a.data.lead} />
            {a.data.sections.map((s, i) =>
              inline ? (
                <div key={s.heading} className="mt-3 border-t border-white/8 pt-2">
                  <button
                    type="button"
                    aria-expanded={!!open[i]}
                    onClick={() => setOpen({ ...open, [i]: !open[i] })}
                    className="flex w-full items-center justify-between py-1 text-left font-display text-[17px] text-amber hover:text-ink"
                  >
                    {s.heading}
                    <span className={`text-[12px] text-mist transition-transform ${open[i] ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {open[i] && (
                    <div className="mt-1.5">
                      <Blocks blocks={s.blocks} />
                    </div>
                  )}
                </div>
              ) : (
                <section key={s.heading} className="mt-5">
                  <h4 className="mb-1.5 font-display text-[20px] text-amber">{s.heading}</h4>
                  <Blocks blocks={s.blocks} />
                </section>
              ),
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {inline && (
                <button type="button" onClick={() => useReader.getState().open(title)} className="bubble px-3 py-1.5 text-[12px] font-medium text-ink">
                  Open in reader ↗
                </button>
              )}
              <ReportMistake subject={`article “${a.data.title}”`} context={`Article: ${a.data.url} (if the article itself is wrong, it can also be corrected on Wikipedia)`} />
              <a href={a.data.url} target="_blank" rel="noreferrer" className="ml-auto text-[10.5px] text-dim hover:text-mist">
                From Wikipedia ({LANGS[a.data.lang] ?? a.data.lang}), CC BY-SA 4.0 · full article ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
