import { create } from 'zustand'
import { settings } from '../../time/settings'

type TourState = {
  tour: string | null
  step: number
  playing: boolean
  /** read captions aloud with the browser's speech synthesis */
  narrate: boolean
  start: (id: string) => void
  go: (step: number) => void
  stop: () => void
  set: (p: Partial<TourState>) => void
}

export const useTourStore = create<TourState>()((set) => ({
  tour: null,
  step: 0,
  playing: false,
  narrate: settings().narrate,
  start: (tour) => set({ tour, step: 0, playing: true }),
  go: (step) => set({ step }),
  stop: () => set({ tour: null, step: 0, playing: false }),
  set: (p) => set(p),
}))
