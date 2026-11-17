// The Time Traveller game on the ground: the round card, the guess form and the reveal.
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ROUNDS, SITES, T_MAX, T_MIN, useTraveller } from './explore/travellerStore'
import { BEST_KEY, bestScore } from './explore/TimeTraveller'
import { formatYear } from '../time/format'
import { useReader } from './wiki/store'
import { useGround } from '../scene/ground'
import { useT } from '../i18n'

export function TravellerHud() {
  const t = useT()
  const { playing, round, score, current, phase, guess, last } = useTraveller()
  useEffect(() => {
    if (phase !== 'done') return
    try {
      if (score > bestScore()) localStorage.setItem(BEST_KEY, String(score))
    } catch {
      // storage blocked: the score is still shown
    }
  }, [phase, score])
  if (!playing || !current) return null
  const site = SITES.find((s) => s.id === guess.site)
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${round}-${phase}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.4 }}
        className="glass pointer-events-auto fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-[62] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-[22px] px-5 py-4"
      >
        <div className="flex items-baseline gap-2 text-[10.5px] font-semibold tracking-[0.18em] text-amber/90 uppercase">
          <span>{t('Time traveller')}</span>
          <span className="text-dim">
            {t('Round')} {round}/{ROUNDS}
          </span>
          <span className="ml-auto tracking-normal text-cyan normal-case tnum">
            {score} {t('pts')}
          </span>
        </div>

        {phase === 'look' && (
          <>
            <p className="mt-1.5 text-[13.5px] text-ink">{t('Where are you, and when? Drag to look around; walk with W A S D.')}</p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => useTraveller.getState().openGuess()} className="bubble px-3.5 py-1.5 text-[12px] font-medium text-ink">
                {t('Make a guess')}
              </button>
              <button type="button" onClick={() => useGround.getState().leave()} className="ml-auto text-[12px] text-mist hover:text-ink">
                {t('Give up')}
              </button>
            </div>
          </>
        )}

        {phase === 'guess' && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {current.options.map((o) => (
                <button key={o.id} type="button" onClick={() => useTraveller.getState().setGuess({ site: o.id })} className={`rounded-xl px-3 py-2 text-left text-[12.5px] ${guess.site === o.id ? 'bg-cyan/80 text-void' : 'bg-white/[.06] text-ink hover:bg-white/[.1]'}`}>
                  {o.name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input type="range" min={T_MIN} max={T_MAX} step={1} value={guess.t} onChange={(e) => useTraveller.getState().setGuess({ t: Number(e.target.value) })} className="h-6 flex-1 accent-[var(--color-cyan)]" aria-label={t('Year')} />
              <span className="w-24 text-right text-[14px] text-ink tnum">{formatYear(guess.t)}</span>
            </div>
            <div className="mt-2.5 flex gap-2">
              <button type="button" disabled={!guess.site} onClick={() => useTraveller.getState().submit()} className="bubble px-3.5 py-1.5 text-[12px] font-medium text-ink disabled:opacity-40">
                {t('Lock it in')}
              </button>
              <button type="button" onClick={() => useTraveller.setState({ phase: 'look' })} className="text-[12px] text-mist hover:text-ink">
                {t('Look again')}
              </button>
            </div>
          </>
        )}

        {phase === 'reveal' && last && (
          <>
            <p className="mt-1.5 text-[14px] text-ink">
              <span className="font-display text-[20px]">{current.site.name}</span>
              <span className="text-mist"> · </span>
              <span className="font-display text-[20px] tnum">{formatYear(current.t)}</span>
            </p>
            <p className="mt-1 text-[12.5px] text-mist">
              {t('Place')}: {site?.name ?? '—'} → <span className={last.place ? 'text-cyan' : 'text-amber'}>{last.place} {t('pts')}</span>
              <span className="text-dim"> · </span>
              {t('Year')}: {formatYear(guess.t)} → <span className={last.year > 30 ? 'text-cyan' : 'text-amber'}>{last.year} {t('pts')}</span>
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => useTraveller.getState().next()} className="bubble px-3.5 py-1.5 text-[12px] font-medium text-ink">
                {round >= ROUNDS ? t('See the score') : t('Next round')} →
              </button>
              <button type="button" onClick={() => useReader.getState().open(current.site.article)} className="text-[12px] text-mist hover:text-ink">
                {t('Read about it')}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <p className="mt-1.5 font-display text-[26px] text-ink tnum">
              {score} / {ROUNDS * 100}
            </p>
            <p className="text-[12.5px] text-mist">{score >= 400 ? t('A historian. The buildings gave the game away to you every time.') : score >= 250 ? t('Well travelled. The sky and the skyline were on your side.') : t('Lost in time, which is the fun of it. Try again?')}</p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => useTraveller.getState().start()} className="bubble px-3.5 py-1.5 text-[12px] font-medium text-ink">
                {t('Play again')}
              </button>
              <button type="button" onClick={() => useGround.getState().leave()} className="text-[12px] text-mist hover:text-ink">
                {t('Back to the globe')}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
