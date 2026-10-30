import { create } from 'zustand'

type ReaderState = {
  /** the article trail: each click on a link reads one step deeper; Back walks it */
  stack: string[]
  /** the one open hover card: the term and the link it hangs from */
  card: { title: string; anchor: HTMLElement } | null
  open: (title: string) => void
  back: () => void
  close: () => void
  showCard: (title: string, anchor: HTMLElement) => void
  hideCard: () => void
}

export const useReader = create<ReaderState>()((set) => ({
  stack: [],
  card: null,
  open: (title) => set((s) => ({ card: null, stack: s.stack[s.stack.length - 1] === title ? s.stack : [...s.stack, title] })),
  back: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  close: () => set({ stack: [], card: null }),
  showCard: (title, anchor) => set({ card: { title, anchor } }),
  hideCard: () => set({ card: null }),
}))
