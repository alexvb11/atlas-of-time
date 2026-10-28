import { useEffect } from 'react'
import { Scene } from './scene/Scene'
import { TimeBar, useTimeKeys } from './ui/TimeBar'
import { Hud, Readout } from './ui/Readout'
import { HoverLabel } from './ui/HoverLabel'
import { Panel } from './ui/panel/Panel'
import { useTime } from './time/store'

export default function App() {
  useTimeKeys()
  useEffect(() => {
    useTime.getState().set({ introDone: true })
  }, [])
  return (
    <main className="fixed inset-0 overflow-hidden bg-void">
      <Scene />
      <div id="globe-labels" className="pointer-events-none fixed inset-0 overflow-hidden" />
      {/* soft scrim so the readout stays legible over bright cloud tops */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[300px] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(2,4,9,.82),rgba(2,4,9,.35)_55%,transparent)]" />
      <HoverLabel />
      <Panel />
      <header className="pointer-events-none fixed inset-x-0 top-0 z-10 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <TimeBar />
        <Hud />
        <Readout />
      </header>
    </main>
  )
}
