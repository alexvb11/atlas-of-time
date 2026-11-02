// The list of documentary films (src/data/documentaries.ts); Watch starts one full-screen.
import { DOCUMENTARIES } from '../../data/documentaries'
import { JOURNEYS } from '../../data/journeys'
import { useTourStore } from './tourStore'
import { useTime } from '../../time/store'
import { sound } from '../sound'

export default function Films() {
  const speech = typeof speechSynthesis !== 'undefined'
  return (
    <div className="space-y-2">
      <p className="mb-3 text-[12.5px] leading-relaxed text-mist">
        Narrated films that move the time and the camera across the map, chapter after chapter. Every caption is a dated stop with its article.
        {!speech && ' Your browser has no speech voice, so captions are shown without narration.'} Press Escape to stop.
      </p>
      {DOCUMENTARIES.map((d) => {
        const chapters = d.chapters.map((c) => JOURNEYS.find((j) => j.id === c)).filter((j) => !!j)
        const stops = chapters.reduce((a, j) => a + j.stops.length, 0)
        return (
          <div key={d.id} className="rounded-2xl bg-white/[.04] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] text-ink">{d.title}</span>
              <button
                type="button"
                onClick={() => {
                  useTime.getState().set({ side: null })
                  // ambient sound suits a film; it stays under the narration
                  if (!useTime.getState().soundOn) {
                    sound.setEnabled(true)
                    useTime.getState().set({ soundOn: true })
                  }
                  useTourStore.getState().startDoc(d.id, d.chapters[0])
                }}
                className="bubble ml-auto px-3.5 py-1.5 text-[12px] font-medium text-ink"
              >
                Watch ▸
              </button>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-mist">{d.blurb}</p>
            <p className="mt-1 text-[11px] text-dim">
              {chapters.map((j) => j.name).join(' · ')} · {stops} scenes, about {Math.round((stops * 14) / 60)} min
            </p>
          </div>
        )
      })}
    </div>
  )
}
