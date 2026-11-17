// The Time Traveller sheet: what the game is, the best score so far, and the start button. The
// game itself plays on the ground (TravellerHud.tsx) with the date hidden.
import { useState } from 'react'
import { ROUNDS, useTraveller } from './travellerStore'
import { useT } from '../../i18n'

export const BEST_KEY = 'atlas.traveller.best'
export const bestScore = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0)
  } catch {
    return 0
  }
}

export default function TimeTraveller() {
  const t = useT()
  const [best] = useState(bestScore)
  return (
    <div className="space-y-3 text-[13px]">
      <p className="text-mist">{t('You are dropped on the ground somewhere on Earth, in some year between 3000 BCE and today, and the date is hidden. Look around: what stands, and what does not yet; the sky; the sounds. Then guess where and when. Five rounds, 100 points a round.')}</p>
      <p className="text-[12px] text-dim">{t('Fair warning: the ground and the satellite imagery are always today’s. Only the buildings, the sky and the sounds follow the date.')}</p>
      {best > 0 && (
        <p className="text-[12px] text-amber tnum">
          {t('Best score')}: {best} / {ROUNDS * 100}
        </p>
      )}
      <button type="button" onClick={() => useTraveller.getState().start()} className="bubble px-4 py-2.5 text-[13px] font-medium text-ink">
        {t('Drop me somewhere')} →
      </button>
    </div>
  )
}
