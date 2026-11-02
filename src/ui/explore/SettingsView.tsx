// The Settings sheet: every layer, display and behaviour option, grouped, searchable, with a few
// presets. Changes apply at once and are remembered in this browser.
import { useMemo, useState, type ReactNode } from 'react'
import { DEFAULTS, useSettings, type Settings } from '../../time/settings'
import { useTime } from '../../time/store'
import { sound } from '../sound'
import { LANGS, setLang, useLang } from '../../data/wiki'
import { clearJournal } from '../../data/journal'

type Row = { label: string; sub?: string; keywords?: string; control: ReactNode }
type Section = { title: string; rows: Row[] }

function Toggle<K extends keyof Settings>({ k, label }: { k: K; label: string }) {
  const v = useSettings((s) => s[k]) as boolean
  return (
    <label className="relative inline-flex cursor-pointer">
      <input type="checkbox" role="switch" aria-label={label} checked={v} onChange={() => useSettings.getState().set(k, !v as Settings[K])} className="peer sr-only" />
      <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-white/12 transition-colors peer-checked:bg-cyan/70 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/60 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  )
}

function Slider<K extends keyof Settings>({ k, label, min, max, step, fmt }: { k: K; label: string; min: number; max: number; step: number; fmt: (v: number) => string }) {
  const v = useSettings((s) => s[k]) as number
  return (
    <span className="flex items-center gap-2">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => useSettings.getState().set(k, Number(e.target.value) as Settings[K])}
        className="h-6 w-28 accent-[var(--color-cyan)]"
      />
      <span className="w-10 text-right text-[11.5px] text-mist tnum">{fmt(v)}</span>
    </span>
  )
}

function Choice<K extends keyof Settings>({ k, label, options }: { k: K; label: string; options: [Settings[K], string][] }) {
  const v = useSettings((s) => s[k])
  return (
    <span role="radiogroup" aria-label={label} className="flex shrink-0 rounded-full bg-black/25 p-0.5">
      {options.map(([val, name]) => (
        <button
          key={String(val)}
          type="button"
          role="radio"
          aria-checked={v === val}
          onClick={() => useSettings.getState().set(k, val)}
          className={`min-h-6 rounded-full px-2.5 text-[11.5px] transition-colors ${v === val ? 'bg-cyan/80 text-void' : 'text-mist hover:text-ink'}`}
        >
          {name}
        </button>
      ))}
    </span>
  )
}

function SoundToggle() {
  const on = useTime((s) => s.soundOn)
  return (
    <label className="relative inline-flex cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        aria-label="Ambient sound"
        checked={on}
        onChange={() => {
          sound.setEnabled(!on)
          useTime.getState().set({ soundOn: !on })
        }}
        className="peer sr-only"
      />
      <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-white/12 transition-colors peer-checked:bg-cyan/70 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/60 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  )
}

function LangSelect() {
  const lang = useLang()
  return (
    <select aria-label="Reading language" value={lang} onChange={(e) => setLang(e.target.value)} className="min-h-7 rounded-full border border-white/12 bg-black/30 px-3 text-[12px] text-ink focus:border-cyan/60 focus:outline-none">
      {Object.entries(LANGS).map(([k, name]) => (
        <option key={k} value={k}>
          {name}
        </option>
      ))}
    </select>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const times = (v: number) => `${v.toFixed(1)}×`

const SECTIONS: Section[] = [
  {
    title: 'Layers',
    rows: [
      { label: 'Trade routes', sub: 'Silk Road, Hansa, galleons… flowing while in use', control: <Toggle k="trade" label="Trade routes" /> },
      { label: 'Voyages and marches', sub: 'Magellan, Hannibal, Marco Polo… moving on the globe', keywords: 'journeys travellers', control: <Toggle k="journeys" label="Voyages and marches" /> },
      { label: 'Spreads', sub: 'The Black Death, printing, the early Muslim conquests, Polynesian voyages… moving across the map', keywords: 'plague migration diffusion', control: <Toggle k="spreads" label="Spreads" /> },
      { label: 'Event markers', sub: 'Battles, foundings and discoveries near their date', keywords: 'pins dots', control: <Toggle k="events" label="Event markers" /> },
      { label: 'Cities', sub: 'Recorded populations of major cities', control: <Toggle k="cities" label="Cities" /> },
      { label: 'City names and populations', control: <Toggle k="cityLabels" label="City names and populations" /> },
      { label: 'Population density', sub: 'People per km², today’s borders, from 10,000 BCE', control: <Toggle k="density" label="Population density" /> },
      { label: 'Density strength', keywords: 'opacity population', control: <Slider k="densityOpacity" label="Density strength" min={0.2} max={1} step={0.05} fmt={pct} /> },
    ],
  },
  {
    title: 'Borders and labels',
    rows: [
      { label: 'Political borders', control: <Toggle k="borders" label="Political borders" /> },
      { label: 'Country and empire names', keywords: 'labels polity', control: <Toggle k="borderLabels" label="Country and empire names" /> },
      { label: 'Approximate borders', sub: 'Dashed lines for peoples and uncertain borders', keywords: 'dashed uncertain', control: <Toggle k="approxBorders" label="Approximate borders" /> },
      { label: 'Political map', sub: 'Colour each state and people on the map', keywords: 'fill colour regions countries', control: <Toggle k="politicalFill" label="Political map" /> },
      { label: 'Border thickness', sub: 'Above 1.5 px uses heavier lines that cost some speed', keywords: 'width lines', control: <Slider k="borderWidth" label="Border thickness" min={1} max={4} step={0.5} fmt={(v) => `${v.toFixed(1)} px`} /> },
      { label: 'Border brightness', control: <Slider k="borderBrightness" label="Border brightness" min={0.3} max={2.5} step={0.1} fmt={pct} /> },
      { label: 'Label size', sub: 'Names on the globe', keywords: 'text font', control: <Choice k="labelSize" label="Label size" options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} /> },
    ],
  },
  {
    title: 'Earth and sky',
    rows: [
      { label: 'Clouds', keywords: 'weather', control: <Slider k="clouds" label="Clouds" min={0} max={1} step={0.05} fmt={(v) => (v < 0.01 ? 'off' : pct(v))} /> },
      { label: 'Sharp close-ups', sub: 'Stream 10 m satellite imagery and 3D terrain when zoomed in (present day)', keywords: 'zoom tiles detail hd', control: <Toggle k="detail" label="Sharp close-ups" /> },
      { label: 'Terrain height', sub: 'How much mountains rise in close-ups (1× is true scale)', keywords: '3d exaggeration elevation', control: <Slider k="terrain" label="Terrain height" min={1} max={4} step={0.25} fmt={(v) => `${v}×`} /> },
      { label: 'Mountain relief', sub: 'Shading from real elevation, stronger up close', keywords: 'terrain 3d elevation mountains', control: <Slider k="relief" label="Mountain relief" min={0} max={2} step={0.1} fmt={(v) => (v < 0.05 ? 'off' : pct(v))} /> },
      { label: 'City lights at night', keywords: 'night lights electric', control: <Toggle k="nightLights" label="City lights at night" /> },
      { label: 'Atmosphere glow', control: <Toggle k="atmosphere" label="Atmosphere glow" /> },
      { label: 'Stars', sub: 'The real night sky (Yale Bright Star Catalogue), moved to the date', keywords: 'space background constellations sky', control: <Toggle k="stars" label="Stars" /> },
      { label: 'Moon and Sun', sub: 'The Moon in its place and phase for the date', keywords: 'moon phase sun', control: <Toggle k="moonSun" label="Moon and Sun" /> },
      { label: 'Milky Way haze', keywords: 'nebula space background', control: <Toggle k="nebula" label="Milky Way haze" /> },
      { label: 'Ice ages', sub: 'Ice sheets and lower seas at glacial times', keywords: 'climate sea level glacial', control: <Toggle k="climate" label="Ice ages" /> },
      { label: 'Green Sahara', sub: 'Grassland in the African Humid Period', keywords: 'climate desert', control: <Toggle k="greenSahara" label="Green Sahara" /> },
      {
        label: 'Sunlight',
        sub: 'Fixed light; the sun for the time of year (live today); or always day',
        keywords: 'seasons daylight night sun',
        control: <Choice k="sun" label="Sunlight" options={[['fixed', 'Fixed'], ['seasons', 'Seasons'], ['always-day', 'Day']]} />,
      },
    ],
  },
  {
    title: 'Camera and motion',
    rows: [
      { label: 'Spin when idle', keywords: 'rotate auto', control: <Toggle k="autoRotate" label="Spin when idle" /> },
      { label: 'Lean toward the horizon up close', sub: 'An oblique, aerial view when zoomed in', keywords: 'tilt 3d camera perspective', control: <Toggle k="tiltClose" label="Lean toward the horizon up close" /> },
      { label: 'Spin speed', keywords: 'rotate', control: <Slider k="rotateSpeed" label="Spin speed" min={0.3} max={4} step={0.1} fmt={times} /> },
      { label: 'Motion', sub: 'Follow the system setting, or choose', keywords: 'reduced animation accessibility', control: <Choice k="motion" label="Motion" options={[['system', 'System'], ['full', 'Full'], ['reduced', 'Reduced']]} /> },
      { label: 'Time-warp effects', sub: 'Streaking stars and colour fringes while scrubbing fast', keywords: 'blur aberration', control: <Toggle k="warpEffects" label="Time-warp effects" /> },
    ],
  },
  {
    title: 'Time',
    rows: [
      { label: 'Playback speed', sub: 'Used when you press play', keywords: 'play', control: <Choice k="defaultSpeed" label="Playback speed" options={[[1, '1×'], [5, '5×'], [25, '25×']]} /> },
      { label: 'Year labels', sub: '44 BCE / 1914 CE, or 44 BC / AD 1914', keywords: 'era bc ad bce ce date format', control: <Choice k="era" label="Year labels" options={[['BCE', 'BCE / CE'], ['BC', 'BC / AD']]} /> },
    ],
  },
  {
    title: 'Interface',
    rows: [
      { label: 'Era and population strip', sub: 'The bar under the time slider', keywords: 'hud', control: <Toggle k="hud" label="Era and population strip" /> },
      { label: 'Source notes', sub: 'Where borders and layers come from, bottom left', keywords: 'credits legend', control: <Toggle k="sourceNotes" label="Source notes" /> },
      { label: 'Name under the pointer', keywords: 'hover tooltip', control: <Toggle k="hoverLabel" label="Name under the pointer" /> },
      { label: 'Definition cards on links', sub: 'Film and definition when pointing at a link', keywords: 'hover cards popups', control: <Toggle k="hoverCards" label="Definition cards on links" /> },
      { label: 'Reading language', sub: 'Articles, cards and films', keywords: 'language translate', control: <LangSelect /> },
    ],
  },
  {
    title: 'Sound',
    rows: [
      { label: 'Ambient sound', keywords: 'audio music', control: <SoundToggle /> },
      { label: 'Read journeys aloud', sub: 'Narration by your browser’s voice', keywords: 'narration speech voice', control: <Toggle k="narrate" label="Read journeys aloud" /> },
    ],
  },
  {
    title: 'Performance',
    rows: [
      { label: 'Graphics quality', sub: 'Low drops glow effects and sharpness for slower devices', keywords: 'fps speed battery', control: <Choice k="quality" label="Graphics quality" options={[['auto', 'Auto'], ['high', 'High'], ['low', 'Low']]} /> },
    ],
  },
]

const PRESETS: { name: string; sub: string; values: Partial<Settings> }[] = [
  { name: 'Standard', sub: 'The default view', values: DEFAULTS },
  {
    name: 'Clean map',
    sub: 'Borders and names only',
    values: { ...DEFAULTS, trade: false, journeys: false, events: false, cities: false, density: false, clouds: 0, hud: false, sourceNotes: false, autoRotate: false },
  },
  {
    name: 'Everything',
    sub: 'Every layer on, seasons included',
    values: { ...DEFAULTS, trade: true, journeys: true, events: true, cities: true, cityLabels: true, density: true, sun: 'seasons' },
  },
  {
    name: 'Calm',
    sub: 'Less motion, no clouds or effects',
    values: { motion: 'reduced', warpEffects: false, autoRotate: false, clouds: 0, quality: 'low' },
  },
]

export default function SettingsView() {
  const [q, setQ] = useState('')
  const [cleared, setCleared] = useState(false)
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return SECTIONS
    return SECTIONS.map((s) => ({ ...s, rows: s.rows.filter((r) => `${s.title} ${r.label} ${r.sub ?? ''} ${r.keywords ?? ''}`.toLowerCase().includes(n)) })).filter((s) => s.rows.length)
  }, [q])

  return (
    <div className="text-[13px]">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a setting"
        aria-label="Find a setting"
        className="mb-3 w-full rounded-full border border-white/12 bg-black/25 px-4 py-2 text-ink placeholder:text-dim focus:border-cyan/60 focus:outline-none"
      />
      {!q && (
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                const st = useSettings.getState()
                for (const [k, v] of Object.entries(p.values)) st.set(k as keyof Settings, v as never)
              }}
              className="rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2 text-left hover:border-white/25"
            >
              <span className="block text-[13px] text-ink">{p.name}</span>
              <span className="block text-[11px] text-dim">{p.sub}</span>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && <p className="text-mist">No setting matches “{q}”.</p>}
      {shown.map((s) => (
        <section key={s.title} className="mb-4">
          <h3 className="mb-1 px-1 text-[11px] font-semibold tracking-[0.14em] text-dim uppercase">{s.title}</h3>
          <div className="rounded-2xl bg-white/[.03]">
            {s.rows.map((r, i) => (
              <div key={r.label} className={`flex items-center gap-3 px-3 py-2.5 ${i ? 'border-t border-white/[.06]' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">{r.label}</span>
                  {r.sub && <span className="block text-[11px] leading-snug text-dim">{r.sub}</span>}
                </span>
                {r.control}
              </div>
            ))}
          </div>
        </section>
      ))}
      {!q && (
        <section className="mb-2">
          <h3 className="mb-1 px-1 text-[11px] font-semibold tracking-[0.14em] text-dim uppercase">Your data</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="bubble px-3.5 py-2 text-[12px] text-mist" onClick={() => useSettings.getState().reset()}>
              Reset all settings
            </button>
            <button
              type="button"
              className="bubble px-3.5 py-2 text-[12px] text-mist"
              onClick={() => {
                if (!window.confirm('Clear your journal of places, eras and articles? This cannot be undone.')) return
                clearJournal()
                setCleared(true)
              }}
            >
              {cleared ? 'Journal cleared' : 'Clear my journal'}
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-dim">Settings and the journal are kept in this browser only.</p>
        </section>
      )}
    </div>
  )
}
