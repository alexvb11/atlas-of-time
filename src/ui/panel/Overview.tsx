import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTime } from '../../time/store'
import { useReader } from '../wiki/store'
import { interpSeries, spanAt, type Conf, type EntityIndex, isModernAt, useEntityText } from '../../data/entities'
import type { Resolution } from '../../data/resolve'
import { ConfTag, Stat, Ticker } from './bits'
import { formatNumber, formatPopulation } from '../../time/format'
import { periodAt } from '../../time/eras'

/** Wikipedia extracts lose their pronunciation spans and leave "()" or "( ; )" behind */
const cleanSummary = (t?: string) => t?.replace(/\s*\(\s*[;,]?\s*\)/g, '').replace(/\s{2,}/g, ' ')

function popFor(res: Resolution, idx: EntityIndex, t: number): { value: number; conf: Conf; label: string } | null {
  if (res.kind === 'entity') {
    const e = res.entity
    if (isModernAt(e, t)) {
      const v = interpSeries(idx.population[e.iso3!] ?? [], t)
      if (v) return { value: v, conf: t < 1950 ? 'estimated' : 'documented', label: 'Population' }
    }
    if (e.pop.length) {
      const v = interpSeries(e.pop, t)
      const near = e.pop.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a))
      if (v) return { value: v, conf: near[2], label: 'Population' }
      if (Math.abs(near[0] - t) < 200) return { value: near[1], conf: near[2], label: 'Population' }
    }
  }
  if (res.kind === 'country') {
    const v = interpSeries(idx.population[res.country.iso3] ?? [], t)
    if (v) return { value: v, conf: 'documented', label: 'Population' }
  }
  return null
}

export function OverviewTab({ res, idx }: { res: Resolution; idx: EntityIndex }) {
  const t = useTime((s) => s.time)
  const [more, setMore] = useState(false)
  useEntityText() // re-render when automated summaries arrive
  const country = 'country' in res ? res.country : null
  const pop = popFor(res, idx, t)
  // people living within today's borders (HYDE), a consistent comparison for every era
  const territory = country && t > -10000 ? interpSeries(idx.population[country.iso3] ?? [], t) : null

  let summary: string | undefined
  const stats: React.ReactNode[] = []
  let facts: string[] = []
  let note: string | null = null

  if (res.kind === 'entity') {
    const e = res.entity
    // automated country summaries describe the present day; never show them in the past
    summary =
      e.tier === 2 && e.iso3 && !isModernAt(e, t)
        ? `The territory of present-day ${e.name}. The lineage above shows its predecessors where known, and the History tab lists dated events.`
        : cleanSummary(e.summary)
    const cap = spanAt(e.capitals, t)
    const gov = spanAt(e.gov, t)
    const ruler = spanAt(e.rulers, t)
    const rel = spanAt(e.religion, t)
    if (cap) stats.push(<Stat key="cap" label="Capital">{cap[2]}<ConfTag conf={cap[3]} /></Stat>)
    if (ruler) stats.push(<Stat key="ruler" label="Ruler">{ruler[2]}<ConfTag conf={ruler[3]} /></Stat>)
    if (gov) stats.push(<Stat key="gov" label="Government" wide>{gov[2]}<ConfTag conf={gov[3]} /></Stat>)
    if (rel) stats.push(<Stat key="rel" label="Religion" wide>{rel[2]}</Stat>)
    if (isModernAt(e, t) && country) {
      stats.push(<Stat key="area" label="Area"><span className="tnum">{formatNumber(country.area)}</span> km²</Stat>)
      if (country.currencies.length) stats.push(<Stat key="cur" label="Currency">{country.currencies[0]}</Stat>)
    }
    facts = e.facts.filter(([a, b]) => (a === null || t >= a) && (b === null || t < b)).map((f) => f[2])
    if (t < e.from || t >= e.to) note = 'Outside this entity\'s recorded lifetime.'
    if (res.via === 'map' || res.polity) note = 'Borders are approximate reconstructions.'
    if (res.outlineFromCountry && res.via === 'lineage') note = 'Highlighted: today\'s borders, for reference. Historical extent differed.'
  } else if (res.kind === 'country') {
    const c = res.country
    stats.push(<Stat key="cap" label="Capital">{c.capital.join(', ') || '—'}</Stat>)
    stats.push(<Stat key="region" label="Region">{c.subregion || c.region}</Stat>)
    stats.push(<Stat key="area" label="Area"><span className="tnum">{formatNumber(c.area)}</span> km²</Stat>)
    if (c.currencies.length) stats.push(<Stat key="cur" label="Currency">{c.currencies.join(', ')}</Stat>)
    summary = `${c.official}. Detailed history for this country is coming in a later data tier; present-day facts are shown.`
  } else if (res.kind === 'polity') {
    summary = `${res.polity.name}${res.polity.subjectTo ? `, under ${res.polity.subjectTo}` : ''}, as drawn in the historical border data for this period. Little more is recorded here in this atlas yet.`
    note = 'Borders are approximate reconstructions.'
  } else if (res.kind === 'prehistory') {
    summary = res.text
  } else if (res.kind === 'deep') {
    const p = periodAt(t)
    summary = `This crust was part of ${res.title}: ${res.note}.`
    if (p) {
      stats.push(<Stat key="period" label="Period">{p.name}</Stat>)
      if (p.climate) stats.push(<Stat key="climate" label="Climate">{p.climate}</Stat>)
      if (p.life) stats.push(<Stat key="life" label="Life" wide>{p.life}</Stat>)
    }
  } else {
    summary = res.text
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div>
          <p className={`text-[13.5px] leading-relaxed text-ink/85 ${more ? '' : 'line-clamp-5'}`}>{summary}</p>
          {summary.length > 320 && (
            <button type="button" onClick={() => setMore(!more)} className="mt-0.5 py-1 text-[12px] text-cyan hover:underline">
              {more ? 'Less' : 'More'}
            </button>
          )}
          {res.kind === 'entity' && res.entity.wiki && (
            <button type="button" onClick={() => useReader.getState().open(res.entity.wiki!)} className="bubble mt-2 block px-3.5 py-1.5 text-[12.5px] font-medium text-ink">
              Read the story of {res.entity.name} →
            </button>
          )}
        </div>
      )}

      {(pop || stats.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {pop && (
            <Stat label={pop.label}>
              {pop.conf !== 'documented' && <span className="text-mist">c. </span>}
              <Ticker value={pop.value} format={formatPopulation} />
              <ConfTag conf={pop.conf} />
              {pop.conf !== 'documented' && <div className="mt-1 h-[3px] rounded-full bg-gradient-to-r from-transparent via-cyan/40 to-transparent" title="Uncertainty band" />}
            </Stat>
          )}
          {stats}
        </div>
      )}

      {territory && country && (res.kind !== 'country' && !(res.kind === 'entity' && isModernAt(res.entity, t))) && (
        <div className="glass-soft flex items-baseline justify-between gap-3 rounded-2xl px-3.5 py-2.5">
          <span className="text-[11.5px] text-mist">People within today's {country.name} <span className="text-dim">(HYDE est.)</span></span>
          <span className="text-[13px] text-ink">
            ~<Ticker value={territory} format={formatPopulation} />
          </span>
        </div>
      )}

      {facts.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-amber/90 uppercase">Did you know</h3>
          <ul className="space-y-2">
            {facts.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i, type: 'spring', stiffness: 260, damping: 24 }}
                className="relative rounded-2xl border border-amber/10 bg-amber/[0.04] py-2 pr-3 pl-7 text-[13px] leading-relaxed text-ink/85"
              >
                <span className="absolute top-[13px] left-3 size-1.5 rounded-full bg-amber shadow-[0_0_8px_rgba(255,196,119,.8)]" />
                {f}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {res.kind === 'entity' && (res.entity.tier ?? 1) > 1 && (
        <p className="flex items-start gap-2 rounded-2xl border border-white/8 px-3 py-2 text-[11px] leading-relaxed text-dim">
          <span className="mt-[3px] inline-block size-1.5 shrink-0 rounded-full bg-mist/60" />
          {res.entity.tier === 2
            ? 'Assembled automatically from Wikidata and Wikipedia; not yet reviewed by hand.'
            : 'Matched automatically from the border data to Wikipedia and Wikidata; not yet reviewed by hand.'}
          {res.entity.datesFromMap && ' Dates are those of the border maps that show it.'}
        </p>
      )}
      {note && <p className="text-[11px] text-dim italic">{note}</p>}
      {res.kind === 'entity' && res.entity.sources.length > 0 && (
        <p className="text-[11px] text-dim">
          Sources:{' '}
          {res.entity.sources.filter((s) => !s.includes('wikidata.org')).map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="text-mist underline-offset-2 hover:text-cyan hover:underline">
              {i ? ', ' : ''}
              {decodeURIComponent(s.split('/').pop() ?? s).replaceAll('_', ' ')}
            </a>
          ))}
          {res.entity.qid && <span> · Wikidata {res.entity.qid}</span>}
        </p>
      )}
    </div>
  )
}
