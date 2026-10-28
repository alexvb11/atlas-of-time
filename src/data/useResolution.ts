import { useMemo } from 'react'
import { useTime } from '../time/store'
import { usePolityAt } from '../scene/Highlight'
import { useEntityIndex } from './entities'
import { resolveAt, type Resolution } from './resolve'

/** Resolution of the current selection at the current time (recomputed as time moves) */
export function useResolution(): Resolution | null {
  const selection = useTime((s) => s.selection)
  const time = useTime((s) => s.time)
  const polity = usePolityAt(selection)
  const idx = useEntityIndex()
  return useMemo(() => (idx && selection ? resolveAt(idx, selection, time, polity) : null), [idx, selection, time, polity])
}

/** Stable key: changes only when the resolved thing changes (for crossfades) */
export function resolutionKey(r: Resolution | null): string {
  if (!r) return 'none'
  switch (r.kind) {
    case 'entity':
      return `e:${r.entity.id}`
    case 'polity':
      return `p:${r.polity.name}`
    case 'country':
      return `c:${r.country.iso3}`
    case 'prehistory':
      return `h:${r.title}`
    case 'deep':
      return `d:${r.title}`
    case 'ocean':
      return `o:${r.title}`
  }
}
