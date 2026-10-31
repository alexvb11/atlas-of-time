// The discovery journal: places, eras and articles this viewer has explored, kept in this browser
// only (localStorage). Nothing is sent anywhere; a private window starts empty.
import { useSyncExternalStore } from 'react'

export type Visit = { name: string; t: number; at: [number, number]; when: number }
export type Read = { title: string; when: number }
export type Journal = { places: Visit[]; eras: string[]; articles: Read[]; quiz: { played: number; best: number } }

const KEY = 'atlas.journal.v1'
const empty = (): Journal => ({ places: [], eras: [], articles: [], quiz: { played: 0, best: 0 } })
let state: Journal = (() => {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return empty()
  }
})()
const listeners = new Set<() => void>()
function save(next: Journal) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full or blocked: the journal just lives for this visit
  }
  listeners.forEach((l) => l())
}

export function recordPlace(v: Omit<Visit, 'when'>, era: string | null) {
  const places = [{ ...v, when: Date.now() }, ...state.places.filter((p) => !(p.name === v.name && Math.round(p.t) === Math.round(v.t)))].slice(0, 300)
  const eras = era && !state.eras.includes(era) ? [...state.eras, era] : state.eras
  save({ ...state, places, eras })
}
export function recordArticle(title: string) {
  if (state.articles[0]?.title === title) return
  save({ ...state, articles: [{ title, when: Date.now() }, ...state.articles.filter((a) => a.title !== title)].slice(0, 500) })
}
export function recordQuiz(score: number) {
  save({ ...state, quiz: { played: state.quiz.played + 1, best: Math.max(state.quiz.best, score) } })
}
export function clearJournal() {
  save(empty())
}
export const useJournal = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => state,
  )
