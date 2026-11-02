// Everything a viewer can switch or tune, from the Settings sheet; remembered per browser.
// Scene code reads these every frame with useSettings.getState(); UI subscribes with selectors.
import { create } from 'zustand'

export type Settings = {
  // map
  borders: boolean
  borderLabels: boolean
  approxBorders: boolean
  borderBrightness: number
  borderWidth: number
  politicalFill: boolean
  labelSize: 'small' | 'medium' | 'large'
  // layers
  trade: boolean
  journeys: boolean
  spreads: boolean
  landmarks: boolean
  events: boolean
  cities: boolean
  cityLabels: boolean
  density: boolean
  densityOpacity: number
  // earth and sky
  clouds: number
  relief: number
  detail: boolean
  terrain: number
  nightLights: boolean
  atmosphere: boolean
  stars: boolean
  moonSun: boolean
  nebula: boolean
  climate: boolean
  greenSahara: boolean
  sun: 'fixed' | 'seasons' | 'always-day'
  // camera and motion
  autoRotate: boolean
  rotateSpeed: number
  tiltClose: boolean
  motion: 'system' | 'full' | 'reduced'
  warpEffects: boolean
  // time
  defaultSpeed: 1 | 5 | 25
  era: 'BCE' | 'BC'
  // interface
  hud: boolean
  sourceNotes: boolean
  hoverLabel: boolean
  hoverCards: boolean
  narrate: boolean
  // performance
  quality: 'auto' | 'high' | 'low'
}

export const DEFAULTS: Settings = {
  borders: true,
  borderLabels: true,
  approxBorders: true,
  borderBrightness: 1,
  borderWidth: 1,
  politicalFill: false,
  labelSize: 'medium',
  trade: true,
  journeys: true,
  spreads: true,
  landmarks: true,
  events: true,
  cities: true,
  cityLabels: true,
  density: false,
  densityOpacity: 0.62,
  clouds: 1,
  relief: 1,
  detail: true,
  terrain: 1,
  nightLights: true,
  atmosphere: true,
  stars: true,
  moonSun: true,
  nebula: true,
  climate: true,
  greenSahara: true,
  sun: 'fixed',
  autoRotate: true,
  rotateSpeed: 1,
  tiltClose: true,
  motion: 'system',
  warpEffects: true,
  defaultSpeed: 1,
  era: 'BCE',
  hud: true,
  sourceNotes: true,
  hoverLabel: true,
  hoverCards: true,
  narrate: false,
  quality: 'auto',
}

const KEY = 'atlas.settings.v1'

function saved(): Partial<Settings> {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    // the terrain default was 3× before the tiled terrain; true scale is now the default
    if (s) return s.terrain === 3 ? { ...s, terrain: 1 } : s
    // carry over the earlier Layers menu choices
    const old = JSON.parse(localStorage.getItem('atlas.layers.v1') ?? '{}')
    return { ...old, ...(old.sun === true ? { sun: 'seasons' } : old.sun === false ? { sun: 'fixed' } : {}) }
  } catch {
    return {}
  }
}

type Store = Settings & {
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void
  reset: () => void
}

const persist = (s: Settings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}
const pick = (s: Store): Settings => Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, s[k as keyof Settings]])) as Settings

export const useSettings = create<Store>()((set, get) => ({
  ...DEFAULTS,
  ...saved(),
  set: (k, v) => {
    set({ [k]: v } as Partial<Store>)
    persist(pick(get()))
  },
  reset: () => {
    set({ ...DEFAULTS })
    persist(DEFAULTS)
  },
}))

/** Non-reactive read for render loops */
export const settings = () => useSettings.getState()
