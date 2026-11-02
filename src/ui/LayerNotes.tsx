// Legend and source notes for the optional layers showing at the current date, above the corner
// buttons. The layers themselves are switched in Settings.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettings } from '../time/settings'
import { useTime } from '../time/store'
import { TRADE_ROUTES, routeAlpha } from '../data/trade'
import { DENSITY_STOPS } from '../scene/Density'
import { greenSaharaAt, iceAt, seaLevelAt } from '../time/climate'
import { subsolarAt, world } from '../scene/world'
import { PRESENT, toMa } from '../time/scale'

/** Legend and source notes for the layers visible at the current date (above the corner buttons) */
export function LayerNotes() {
  const t = useTime((s) => s.time)
  // a sheet on the left covers this corner; its own content wins
  const sheetOpen = useTime((s) => s.side !== null)
  const { density, trade, sun, sourceNotes, climate, greenSahara, terrain } = useSettings()
  // polled, since it changes with the camera rather than with React state
  const [detail, setDetail] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setDetail(world.detail), 700)
    return () => clearInterval(id)
  }, [])
  const notes: { key: string; node: React.ReactNode }[] = []
  const deep = toMa(t) > 0.02
  if (density && !deep && t >= -9999)
    notes.push({
      key: 'density',
      node: (
        <div>
          <div className="mb-1 text-mist">People per km²</div>
          <div className="h-2 w-[168px] rounded-full" style={{ background: `linear-gradient(90deg, ${DENSITY_STOPS.map(([, c]) => c).join(',')})` }} />
          <div className="mt-0.5 mb-1 flex w-[168px] justify-between text-[10px] text-dim tnum">
            <span>0.1</span><span>1</span><span>10</span><span>100</span><span>1k+</span>
          </div>
          <div className="text-dim">Within today’s borders · HYDE 3.2 and UN estimates via Our World in Data</div>
        </div>
      ),
    })
  if (trade && sourceNotes && !deep) {
    const live = TRADE_ROUTES.filter((r) => routeAlpha(r, t) > 0)
    if (live.length) notes.push({ key: 'trade', node: <span className="text-dim">Trade routes: schematic paths between attested stops; years of use approximate</span> })
  }
  if (sun === 'seasons' && sourceNotes && !deep) {
    const [, lat] = subsolarAt(t)
    const live = t >= PRESENT - 0.002
    notes.push({
      key: 'sun',
      node: (
        <span className="text-dim">
          Sun overhead at {Math.abs(lat).toFixed(1)}°{lat >= 0 ? 'N' : 'S'}
          {live ? ', where it is noon now (live)' : ' for this time of year; time of day not known'}
        </span>
      ),
    })
  }
  if (detail)
    notes.push({
      key: 'detail',
      node: (
        <span className="text-dim">
          <a className="pointer-events-auto underline-offset-2 hover:underline" href="https://cloudless.eox.at" target="_blank" rel="noreferrer">EOxCloudless</a> https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024) · terrain: Terrain Tiles (Mapzen / AWS: SRTM, GMTED, ETOPO1 and others){terrain !== 1 ? `, height × ${terrain}` : ''}
        </span>
      ),
    })
  const green = greenSaharaAt(t)
  if (green > 0.2 && greenSahara && sourceNotes) notes.push({ key: 'green', node: <span className="text-dim">Green Sahara: African Humid Period, about 14,800–5,000 years ago · extent approximate</span> })
  else if (iceAt(t) > 0.15 && climate && sourceNotes && !deep)
    notes.push({ key: 'ice', node: <span className="text-dim">Ice age: sea level about {Math.round(-seaLevelAt(t))} m lower than today · ice-sheet extent estimated</span> })
  if (sheetOpen) return null
  return (
    <div className="pointer-events-none fixed bottom-[max(64px,calc(env(safe-area-inset-bottom)+48px))] left-4 z-[44] hidden max-w-[380px] flex-col gap-1.5 text-[11px] md:flex">
      <AnimatePresence>
        {notes.map((n) => (
          <motion.div key={n.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-xl px-3 py-2 leading-snug">
            {n.node}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
