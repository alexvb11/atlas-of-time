import { AnimatePresence } from 'framer-motion'
import { useT } from './i18n'
import { Scene } from './scene/Scene'
import { TimeBar, useTimeKeys } from './ui/TimeBar'
import { Hud, Readout } from './ui/Readout'
import { HoverLabel } from './ui/HoverLabel'
import { Panel } from './ui/panel/Panel'
import { PaletteHost } from './ui/PaletteHost'
import { Corner } from './ui/Corner'
import { Intro } from './app/Intro'
import { EventCard } from './ui/EventCard'
import { useTime } from './time/store'
import { useShareLink } from './app/shareLink'
import { Reader } from './ui/wiki/Reader'
import { HoverCardHost } from './ui/wiki/HoverCard'
import { SideSheet } from './ui/ExploreMenu'
import { LayerNotes } from './ui/LayerNotes'
import { TourPlayer } from './ui/explore/Tours'
import { useTourStore } from './ui/explore/tourStore'

export default function App() {
  // re-render the interface when its language changes
  useT()
  useTimeKeys()
  useShareLink()
  const introDone = useTime((s) => s.introDone)
  // a documentary film takes the whole screen: the interface steps aside
  const film = useTourStore((s) => s.doc !== null)
  return (
    <main className="fixed inset-0 overflow-hidden bg-void">
      <Scene />
      {/* place names step back during a film, so the subtitles stay readable */}
      <div id="globe-labels" className={`pointer-events-none fixed inset-0 overflow-hidden transition-opacity duration-1000 ${!introDone ? 'opacity-0' : film ? 'opacity-25' : ''}`} />
      <div id="globe-events" className={`pointer-events-none fixed inset-0 overflow-hidden ${introDone ? '' : 'invisible'}`} />
      <AnimatePresence>
        {introDone && (
          <>
            {/* soft scrim so the readout stays legible over bright cloud tops */}
            <div key="scrim" className="pointer-events-none fixed inset-x-0 top-0 h-[300px] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(2,4,9,.82),rgba(2,4,9,.35)_55%,transparent)]" />
            {!film && <HoverLabel key="hover" />}
            {!film && <Panel key="panel" />}
            {!film && (
              <header key="header" className="pointer-events-none fixed inset-x-0 top-0 z-10 px-4 pt-[max(12px,env(safe-area-inset-top))]">
                <TimeBar />
                <Hud />
                <Readout />
              </header>
            )}
            {!film && <Corner key="corner" />}
            {!film && <LayerNotes key="layer-notes" />}
            {!film && <EventCard key="event" />}
            {!film && <SideSheet key="side" />}
            <TourPlayer key="tour" />
            <Reader key="reader" />
            <HoverCardHost key="cards" />
          </>
        )}
      </AnimatePresence>
      <PaletteHost />
      <Intro />
    </main>
  )
}
