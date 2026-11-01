import { AnimatePresence } from 'framer-motion'
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

export default function App() {
  useTimeKeys()
  useShareLink()
  const introDone = useTime((s) => s.introDone)
  return (
    <main className="fixed inset-0 overflow-hidden bg-void">
      <Scene />
      <div id="globe-labels" className={`pointer-events-none fixed inset-0 overflow-hidden transition-opacity duration-1000 ${introDone ? "" : "opacity-0"}`} />
      <div id="globe-events" className={`pointer-events-none fixed inset-0 overflow-hidden ${introDone ? '' : 'invisible'}`} />
      <AnimatePresence>
        {introDone && (
          <>
            {/* soft scrim so the readout stays legible over bright cloud tops */}
            <div key="scrim" className="pointer-events-none fixed inset-x-0 top-0 h-[300px] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(2,4,9,.82),rgba(2,4,9,.35)_55%,transparent)]" />
            <HoverLabel key="hover" />
            <Panel key="panel" />
            <header key="header" className="pointer-events-none fixed inset-x-0 top-0 z-10 px-4 pt-[max(12px,env(safe-area-inset-top))]">
              <TimeBar />
              <Hud />
              <Readout />
            </header>
            <Corner key="corner" />
            <LayerNotes key="layer-notes" />
            <EventCard key="event" />
            <SideSheet key="side" />
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
