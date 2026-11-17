// The list of Moments: first-person scenes on the ground at a dated event (src/data/moments.ts).
import { MOMENTS } from '../../data/moments'
import { formatYear } from '../../time/format'
import { useMomentStore } from './momentStore'
import { useTime } from '../../time/store'
import { useT } from '../../i18n'

export default function Moments() {
  const t = useT()
  return (
    <div className="space-y-2">
      <p className="mb-3 text-[12.5px] text-mist">{t('Stand on the ground at the moment it happened. The sun is where it stood at that hour; the buildings are the atlas’s models at true size; the ground is today’s. Drag to look around, walk with W A S D, and scroll out to leave.')}</p>
      {MOMENTS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => {
            useTime.getState().set({ side: null })
            useMomentStore.getState().start(m.id)
          }}
          className="group block w-full rounded-2xl bg-white/[.04] px-4 py-3 text-left hover:bg-white/[.08]"
        >
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-ink">{m.title}</span>
            <span className="ml-auto text-[11px] text-cyan opacity-0 transition-opacity group-hover:opacity-100">{t('Stand here')} ▸</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-mist">{m.blurb}</p>
          <p className="mt-1 text-[11px] text-dim tnum">
            {m.approx ? 'c. ' : ''}
            {formatYear(m.t)} · {m.place} · {m.shots.length} {t('shots')}
            {m.fx ? ` · ${t('includes a dramatised effect')}` : ''}
          </p>
        </button>
      ))}
    </div>
  )
}
