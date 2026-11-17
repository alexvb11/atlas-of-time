import { create } from 'zustand'

type MomentState = {
  /** the Moment playing on the ground, and its shot */
  moment: string | null
  shot: number
  /** after the last shot the viewer may stay and look around */
  free: boolean
  start: (id: string) => void
  go: (shot: number) => void
  stop: () => void
  set: (p: Partial<MomentState>) => void
}

export const useMomentStore = create<MomentState>()((set) => ({
  moment: null,
  shot: 0,
  free: false,
  start: (moment) => set({ moment, shot: 0, free: false }),
  go: (shot) => set({ shot }),
  stop: () => set({ moment: null, shot: 0, free: false }),
  set: (p) => set(p),
}))

if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) (window as unknown as { __moments: typeof useMomentStore }).__moments = useMomentStore
