// Owns the Cmd/Ctrl+K shortcut and loads the command palette (and its fuzzy search) the first time
// it is opened, so neither is part of the initial bundle.
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTime } from '../time/store'
import { loadEntityIndex } from '../data/entities'

const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })))

export function PaletteHost() {
  const open = useTime((s) => s.paletteOpen)
  const [used, setUsed] = useState(false)
  useEffect(() => {
    if (open) setUsed(true)
  }, [open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        loadEntityIndex()
        useTime.getState().set({ paletteOpen: !useTime.getState().paletteOpen })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return used ? (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  ) : null
}
