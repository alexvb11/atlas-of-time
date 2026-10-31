import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { PRESENT, timeToU, uToTime } from './scale'

export type Speed = 1 | 5 | 25
export type LonLat = [number, number]

type State = {
  /** astronomical year; the single source of truth */
  time: number
  /** slider position 0..1 (derived from time but stored to avoid round-trips while dragging) */
  u: number
  /** smoothed |du/dt| in slider units per second; drives the time-warp effect */
  velocity: number
  scrubbing: boolean
  playing: boolean
  speed: Speed

  /** selected present-day location; resolution to an entity happens per time */
  selection: LonLat | null
  /** bump to make the camera re-fly to the selection */
  flyNonce: number
  hover: { lonlat: LonLat; x: number; y: number } | null

  introDone: boolean
  paletteOpen: boolean
  /** id of the event whose card is open */
  activeEvent: string | null
  soundOn: boolean
  /** places of the events listed in the Here tab, drawn as numbered pins; hot = the one pointed at */
  herePins: { lon: number; lat: number; n: number; hot: boolean }[]
  /** the left-hand sheet opened from the Explore menu */
  side: 'tours' | 'quiz' | 'today' | 'journal' | null
  reducedMotion: boolean

  setU: (u: number) => void
  setTime: (t: number) => void
  setScrubbing: (b: boolean) => void
  setPlaying: (b: boolean) => void
  setSpeed: (s: Speed) => void
  select: (p: LonLat | null, fly?: boolean) => void
  setHover: (h: State['hover']) => void
  set: (p: Partial<State>) => void
}

const reduced =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const useTime = create<State>()(
  subscribeWithSelector((set) => ({
    time: PRESENT,
    u: 1,
    velocity: 0,
    scrubbing: false,
    playing: false,
    speed: 1,
    selection: null,
    flyNonce: 0,
    hover: null,
    introDone: false,
    paletteOpen: false,
    activeEvent: null,
    soundOn: false,
    herePins: [],
    side: null,
    reducedMotion: !!reduced,

    setU: (u) => {
      const c = Math.min(1, Math.max(0, u))
      set({ u: c, time: uToTime(c) })
    },
    setTime: (t) => set({ time: t, u: timeToU(t) }),
    setScrubbing: (scrubbing) => set({ scrubbing }),
    setPlaying: (playing) => set((s) => ({ playing, u: playing && s.u >= 1 ? 0 : s.u, time: playing && s.u >= 1 ? uToTime(0) : s.time })),
    setSpeed: (speed) => set({ speed }),
    select: (selection, fly = true) => set((s) => ({ selection, flyNonce: fly ? s.flyNonce + 1 : s.flyNonce })),
    setHover: (hover) => set({ hover }),
    set: (p) => set(p),
  })),
)

/** Non-reactive read for render loops */
export const timeNow = () => useTime.getState().time

// dev, or ?qa in production builds for the performance probes
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) (window as unknown as { __time: typeof useTime }).__time = useTime
