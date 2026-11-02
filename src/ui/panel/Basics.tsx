// "The basics": a short, plain overview of the selected place at the current date, so a reader
// knows what they are looking at before the details: what it was, where, who ruled it and from
// where, how old it was, what came before and after on this spot, its neighbours and size, and
// the wider world. Every clause comes from the atlas's data for that date and is left out when
// the data is missing; nothing is generated. Below it, "What was happening": the opening of the
// Wikipedia section whose heading covers this year, quoted and linked.
import { useEffect, useMemo, useState } from 'react'
import { useTime } from '../../time/store'
import { nameAt, spanAt, isModernAt, type EntityIndex, type Conf } from '../../data/entities'
import type { Resolution } from '../../data/resolve'
import { getSnapshot, historyYears, neighboursOf, polityAt, snapshotIndexAt, timelineAt, type Hold, type Polity } from '../../data/history'
import { periodSection, useAsync, type PeriodSection } from '../../data/wiki'
import { ageAt } from '../../time/eras'
import { formatNumber, formatPopulation, formatYear } from '../../time/format'
import { PRESENT } from '../../time/scale'
import { Parts } from '../wiki/ArticleView'
import { useReader } from '../wiki/store'

const R2 = 6371 * 6371
const an = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a')
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const yr = (t: number, conf?: Conf) => formatYear(t, conf !== undefined && conf !== 'documented')
/** "the Kingdom of France", "the Qing dynasty", but "Ukraine", "Dacia" */
const withThe = (n: string) =>
  /^(the |[a-z])/.test(n) || !/\b(Empire|Kingdom|Dynasty|dynasty|Republic|Sultanate|Caliphate|Khanate|Khaganate|Union|Confederation|Confederacy|League|Duchy|Principality|Emirate|Tsardom|Shogunate|Monarchy|Crown|Commonwealth|Federation|States|Horde|Electorate|County|Margraviate|Period|period)\b/.test(n)
    ? n
    : `the ${n}`
const cap1 = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
/** "Until 1791" for a hold ending at the start of 1792; fractional ends are dates within that year */
const lastYear = (to: number) => formatYear(Number.isInteger(to) ? to - 1 : to)
/**
 * Two names for one state, as the border sources differ: "Qing dynasty" and "Qing China", "Ming
 * Dynasty" and "Ming". Words that only label a ruling house or a place are ignored; words for the
 * form of state are not, so the Roman Republic and the Roman Empire stay different.
 */
const LABEL = /^(the|of|dynasty|china|state|people|peoples)$/i
const sameState = (a: string, b: string) => {
  const words = (x: string) => [...new Set(x.toLowerCase().split(/[^a-zà-ÿ'’-]+/i).filter((w) => w.length > 2 && !LABEL.test(w)))].sort().join(' ')
  return a === b || words(a) === words(b)
}
const ORDER = ['Rule', 'People', 'Time', 'Around it', 'Size']
const KIND: Record<string, string> = { polity: 'state', country: 'country', state: 'state', people: 'people', culture: 'culture' }

/** The previous and next holders of this spot that differ from the current one */
function beforeAfter(holds: Hold[] | null, t: number, current: string) {
  if (!holds) return { before: null, after: null }
  const i = holds.findIndex((h) => t >= h.from && t < h.to)
  const pick = (from: number, dir: -1 | 1) => {
    for (let k = from; k >= 0 && k < holds.length; k += dir) if (!sameState(holds[k].name, current) && (i < 0 || !sameState(holds[k].name, holds[i].name))) return holds[k]
    return null
  }
  if (i < 0) return { before: [...holds].reverse().find((h) => h.to <= t) ?? null, after: holds.find((h) => h.from > t) ?? null }
  return { before: pick(i - 1, -1), after: pick(i + 1, 1) }
}

export function Basics({ res, idx, pop }: { res: Resolution; idx: EntityIndex; pop: { value: number; conf: Conf } | null }) {
  const t = useTime((s) => s.time)
  const sel = useTime((s) => s.selection)

  // the polity drawn here on the current map
  const snapYear = historyYears[snapshotIndexAt(t)]
  const snap = snapYear !== undefined ? getSnapshot(snapYear) : undefined
  const polity: Polity | null = ('polity' in res && res.polity) || (snap && sel ? polityAt(snap, sel[0], sel[1]) : null)
  const neighbours = useMemo(() => (snap && polity ? neighboursOf(snap, polity).map((p) => p.name) : []), [snap, polity])

  const [holds, setHolds] = useState<Hold[] | null>(null)
  useEffect(() => {
    if (!sel) return
    let live = true
    timelineAt(sel[0], sel[1]).then((h) => live && setHolds(h))
    return () => void (live = false)
  }, [sel])

  if (res.kind !== 'entity' && res.kind !== 'polity' && res.kind !== 'country') return null
  const e = res.kind === 'entity' ? res.entity : null
  const modern = e ? isModernAt(e, t) : res.kind === 'country'
  const name = res.kind === 'entity' ? nameAt(res.entity, t) : res.kind === 'polity' ? res.polity.name : res.country.name
  const kindWord = e ? (KIND[e.kind] ?? e.kind) : res.kind === 'polity' ? 'state or people' : 'country'
  const centre = (polity && idx.countryAt(polity.label[0], polity.label[1])) || ('country' in res ? res.country : null)
  // a lead sentence, then labelled rows; each part only when the data has it
  let lead = ''
  const rows: [string, string[]][] = []
  const add = (label: string, text: string) => {
    const r = rows.find((x) => x[0] === label)
    if (r) r[1].push(text)
    else rows.push([label, [text]])
  }

  // what and where
  const the = withThe(name)
  let what = `${the} was ${an(kindWord)} ${kindWord}`
  if (modern && res.kind !== 'polity') what = `${the} is ${an(kindWord)} ${kindWord}`
  if (centre && centre.name !== name && !modern) what += ` centred on what is now ${centre.name}`
  else if (centre?.subregion) what += ` in ${centre.subregion}`
  if (polity?.subjectTo) what += `, under ${polity.subjectTo}`
  else if (polity?.partOf) what += `, part of ${polity.partOf}`
  lead = t < PRESENT ? `In ${formatYear(t)}, ${what}.` : `${cap1(what)}.`

  // who ruled, from where, how
  if (e) {
    const ruler = spanAt(e.rulers, t)
    const cap = spanAt(e.capitals, t)
    const gov = spanAt(e.gov, t)
    if (ruler && cap) add('Rule', `${modern ? 'It is led' : 'It was ruled'} by ${ruler[2]} from ${cap[2]}.`)
    else if (ruler) add('Rule', `${modern ? 'Its leader is' : 'Its ruler was'} ${ruler[2]}.`)
    else if (cap) add('Rule', `${modern ? 'Its capital is' : 'Its capital was'} ${cap[2]}.`)
    // Wikidata lists every form at once ("republic, representative democracy, unitary state, …"): the first two say enough
    if (gov) add('Rule', `Government: ${e.tier === 2 ? gov[2].split(', ').slice(0, 2).join(', ') : gov[2]}.`)
    const rel = spanAt(e.religion, t)
    if (rel) add('People', `Religion: ${rel[2]}.`)
    const shares = spanAt(e.langs, t)?.[2]
    const lang = shares
      ? [...shares].filter(([, v]) => v >= 0.1).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id]) => idx.languages.get(id)?.name ?? id)
      : spanAt(e.langNames ?? [], t)?.[2].slice(0, 3)
    if (lang?.length) add('People', `Main ${lang.length > 1 ? 'languages' : 'language'}: ${list(lang)}.`)

    // how old, how long it would last. Automated modern countries take their start from Wikidata's
    // inception, which is often a predecessor's ("Ukraine" from 900): say nothing rather than mislead.
    const phase = spanAt(e.names, t)
    if (phase && phase[2] !== e.name) {
      add('Time', `This was one period of ${withThe(e.name)}: ${phase[2]} (${yr(phase[0], e.conf)} – ${phase[1] > PRESENT ? 'today' : lastYear(phase[1])}); ${withThe(e.name)} as a whole lasted ${yr(e.from, e.conf)} – ${e.to > PRESENT ? 'today' : lastYear(e.to)}.`)
    } else if (e.datesFromMap) {
      add('Time', `The border maps show it from ${formatYear(e.from)} to ${lastYear(e.to)}.`)
    } else if (!(e.tier === 2 && e.iso3) && t >= e.from && t < e.to) {
      const age = Math.floor(t - e.from)
      const until = e.to > PRESENT ? 'and still exists today' : `and would last until ${yr(e.to, e.conf)}`
      add('Time', age >= 1 ? `It had existed for about ${formatNumber(age)} ${age === 1 ? 'year' : 'years'} (since ${yr(e.from, e.conf)}) ${until}.` : `It was founded in ${yr(e.from, e.conf)} ${until}.`)
    }
  }

  // what came before and after on this spot
  const { before, after } = beforeAfter(holds, t, polity?.name ?? name)
  if (before || after)
    add(
      'Time',
      [before && `Before it here: ${before.name} (until ${lastYear(before.to)})`, after && `after it: ${after.name} (from ${formatYear(after.from)})`].filter(Boolean).join('; ').replace(/^after/, 'After') + '.',
    )
  if (neighbours.length) add('Around it', `Its neighbours on this map: ${list(neighbours)}.`)

  // size and people
  if (polity && !modern) add('Size', `It covered about ${formatNumber(Math.round((polity.area * R2) / 1000) * 1000)} km² as drawn on this map.`)
  if (pop) add('People', `About ${formatPopulation(pop.value)} people ${modern ? 'live' : 'lived'} there${pop.conf === 'documented' ? '' : ' (estimate)'}.`)

  const age = ageAt(t)
  return (
    <section aria-label="The basics" className="rounded-2xl border border-cyan/15 bg-cyan/[0.04] px-3.5 py-3">
      <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-cyan/90 uppercase">The basics · {formatYear(t)}</h3>
      <p className="text-[14px] leading-relaxed text-ink">{lead}</p>
      {rows.length > 0 && (
        <dl className="mt-2 space-y-1.5">
          {ORDER.filter((k) => rows.some((r) => r[0] === k)).map((k) => (
            <div key={k} className="grid grid-cols-[72px_1fr] gap-2 text-[13px] leading-snug">
              <dt className="pt-px text-[10.5px] font-semibold tracking-wider text-dim uppercase">{k}</dt>
              <dd className="text-ink/85">{rows.find((r) => r[0] === k)![1].join(' ')}</dd>
            </div>
          ))}
        </dl>
      )}
      {age && (
        <p className="mt-2 text-[12px] leading-snug text-mist">
          <span className="text-dim">The wider world: </span>
          {age.name}
          {age.powers ? ` · leading powers: ${age.powers}` : ''}
        </p>
      )}
      <Period titles={periodTitles(res, centre?.name ?? null)} t={t} />
    </section>
  )
}

/** Articles to search for the period, most specific first: the entity's own, then the history of the country there */
function periodTitles(res: Resolution, centre: string | null): string[] {
  const out: string[] = []
  if (res.kind === 'entity' && res.entity.wiki) out.push(res.entity.wiki)
  if ('polity' in res && res.polity?.wiki) out.push(res.polity.wiki)
  const country = 'country' in res && res.country ? res.country.name : centre
  if (country) out.push(`History of ${country}`)
  return [...new Set(out)]
}

function Period({ titles, t }: { titles: string[]; t: number }) {
  // re-query per decade: sections rarely change within one, and scrubbing stays quiet
  const decade = Math.floor(t / 10) * 10 + 5
  const key = titles.length ? `${titles.join('|')}@${decade}` : null
  const { data, error } = useAsync<PeriodSection | null>(key, () => periodSection(titles, Math.min(t, PRESENT - 0.01)))
  if (!key || error || data === null) return null
  if (data === undefined) return <div className="shimmer mt-3 h-14 rounded-xl" />
  return (
    <div className="mt-3 border-t border-white/[.07] pt-2.5">
      <h4 className="mb-1 text-[11px] text-mist">
        What was happening · <span className="text-dim">Wikipedia, {data.article} › {data.heading}</span>
      </h4>
      <div className="line-clamp-[9] text-[13px] leading-relaxed text-ink/85">
        {data.blocks.slice(0, 2).map((b, i) => (
          <p key={i} className={i ? 'mt-1.5' : ''}>
            <Parts parts={b.parts} />
          </p>
        ))}
      </div>
      <button type="button" onClick={() => useReader.getState().open(`${data.article}#${data.heading}`)} className="mt-1 py-1 text-[12px] text-cyan hover:underline">
        Read this section →
      </button>
    </div>
  )
}
