// Bottom-left controls: search, sound, and the one-time note that borders are approximate.
import { AnimatePresence, motion } from 'framer-motion'
import { useTime } from '../time/store'
import { sound } from './sound'
import { useState } from 'react'
import { currentLink } from '../app/shareLink'
import { ExploreMenu } from './ExploreMenu'
import { useSettings } from '../time/settings'
import { toMa } from '../time/scale'

export function Corner() {
  const soundOn = useTime((s) => s.soundOn)
  const t = useTime((s) => s.time)
  const notesOn = useSettings((s) => s.sourceNotes)
  // on phones a sheet fills the bottom of the screen; it has its own close button
  const sheetOpen = useTime((s) => s.side !== null)
  const showNote = notesOn && t < 1994 && toMa(t) < 2 && t > -122999
  const deep = notesOn && toMa(t) > 2
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 160, damping: 20 }}
      className={`pointer-events-auto fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-[45] flex items-center gap-2 ${sheetOpen ? 'max-md:hidden' : ''}`}
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
      <ExploreMenu />
      <button
        type="button"
        className="bubble flex items-center gap-2 px-3.5 py-2 text-[12px] text-mist"
        aria-label="Settings: layers, map, display and more"
        onClick={() => useTime.getState().set({ side: useTime.getState().side === 'settings' ? null : 'settings' })}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7 3.4 3.4" /></svg>
        <span className="hidden sm:inline">Settings</span>
      </button>
      <ShareButton />
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
                : t >= -3399
                  ? 'Borders: Cliopatria (Seshat, 2025), by year · dashed = peoples and approximate borders'
                  : 'Borders this early are approximate reconstructions (dashed)'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Copies a link to exactly this view: year, place and the article being read */
function ShareButton() {
  const [done, setDone] = useState<string | null>(null)
  const share = async () => {
    const url = currentLink()
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Atlas of Time', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setDone('Link copied')
    } catch {
      setDone('Copy failed')
    }
    setTimeout(() => setDone(null), 1800)
  }
  return (
    <button type="button" onClick={share} className="bubble relative grid size-9 place-items-center text-mist" aria-label="Copy a link to this place, year and article">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 8.5l3-3M6 3.5l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5L9.5 7M8 10.5l-1.2 1.2a2.5 2.5 0 0 1-3.5-3.5L4.5 7" />
      </svg>
      <AnimatePresence>
        {done && (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="glass absolute bottom-11 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11.5px] whitespace-nowrap text-ink">
            {done}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
