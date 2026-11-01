// Optional map layers, switched from the Layers menu and remembered per browser.
import { create } from 'zustand'

export type LayerKey = 'sun' | 'trade' | 'density' | 'cities'
type Layers = Record<LayerKey, boolean> & { toggle: (k: LayerKey) => void }

const KEY = 'atlas.layers.v1'
const DEFAULTS: Record<LayerKey, boolean> = { sun: false, trade: true, density: false, cities: true }

function saved(): Partial<Record<LayerKey, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const useLayers = create<Layers>()((set, get) => ({
  ...DEFAULTS,
  ...saved(),
  toggle: (k) => {
    set({ [k]: !get()[k] } as Partial<Layers>)
    try {
      const { sun, trade, density, cities } = get()
      localStorage.setItem(KEY, JSON.stringify({ sun, trade, density, cities }))
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  },
}))
