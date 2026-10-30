// Bottom-left controls: search, sound, and the one-time note that borders are approximate.
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../time/store'
import { sound } from './sound'
import { toMa } from '../time/scale'

export function Corner() {
  const soundOn = useTime((s) => s.soundOn)
  const t = useTime((s) => s.time)
  const showNote = t < 1994 && toMa(t) < 2 && t > -122999
  const deep = toMa(t) > 2
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 160, damping: 20 }}
      className="pointer-events-auto fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-20 flex items-center gap-2"
    >
      <button
        type="button"
        className="bubble flex items-center gap-2 px-3.5 py-2 text-[12px] text-mist"
        onClick={() => useTime.getState().set({ paletteOpen: true })}
        aria-label="Search places and eras"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" strokeLinecap="round" /></svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-white/12 px-1 text-[10px] text-dim sm:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <button
        type="button"
        className="bubble grid size-9 place-items-center text-mist"
        aria-label={soundOn ? 'Mute sound' : 'Turn on ambient sound'}
        aria-pressed={soundOn}
        onClick={() => {
          const on = !soundOn
          sound.setEnabled(on)
          useTime.getState().set({ soundOn: on })
        }}
      >
        {soundOn ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M1 5h2.5L7 2v10L3.5 9H1z" /><path d="M9.3 4.2a3.8 3.8 0 0 1 0 5.6M11 2.6a6 6 0 0 1 0 8.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M1 5h2.5L7 2v10L3.5 9H1z" /><path d="m9.5 5 3.5 4M13 5l-3.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        )}
      </button>
      <AnimatePresence>
        {(showNote || deep) && (
          <motion.span
            key={deep ? 'deep' : 'borders'}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="hidden pl-1 text-[11px] text-dim italic md:inline"
          >
            {deep
              ? toMa(t) > 500
                ? 'Reconstructions this old are highly uncertain · Merdith et al. 2021'
                : "Plate reconstruction: Merdith et al. 2021 · today's coastlines carried back in time"
              : t >= 1886
                ? 'Borders: CShapes 2.0 (ETH Zürich), each change dated to the day'
                : 'Borders before 1886 are approximate reconstructions'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
