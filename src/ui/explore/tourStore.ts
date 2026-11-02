import { create } from 'zustand'
import { settings } from '../../time/settings'

type TourState = {
  tour: string | null
  step: number
  playing: boolean
  /** read captions aloud with the browser's speech synthesis */
  narrate: boolean
  /** a documentary playing: its id and chapter; the interface steps aside while it runs */
  doc: string | null
  chapter: number
  start: (id: string) => void
  startDoc: (id: string, first: string) => void
  go: (step: number) => void
  stop: () => void
  set: (p: Partial<TourState>) => void
}

export const useTourStore = create<TourState>()((set) => ({
  tour: null,
  step: 0,
  playing: false,
  narrate: settings().narrate,
  doc: null,
  chapter: 0,
  start: (tour) => set({ tour, step: 0, playing: true, doc: null }),
  startDoc: (doc, first) => set({ doc, chapter: 0, tour: first, step: 0, playing: true, narrate: true }),
  go: (step) => set({ step }),
  stop: () => set({ tour: null, step: 0, playing: false, doc: null, chapter: 0 }),
  set: (p) => set(p),
}))
