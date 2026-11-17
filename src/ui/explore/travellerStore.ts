// The Time Traveller game: dropped on the ground somewhere, sometime, with the date hidden. Work
// out where and when from what stands, the sky and the sound. Five rounds; the place and the year
// are both scored. Everything shown is the atlas's own dated data, so the answers are its answers.
import { create } from 'zustand'
import { useGround } from '../../scene/ground'
import { subsolarFor, world } from '../../scene/world'
import { useTime } from '../../time/store'
import { goTo } from '../TimeBar'
import { LANDMARKS } from '../../data/landmarks'

export type Site = { id: string; name: string; at: [number, number]; yaw: number; pitch?: number; eye?: number; article: string }
export const SITES: Site[] = [
  { id: 'giza', name: 'Giza, Egypt', at: [31.1415, 29.969], yaw: 305, article: 'Giza pyramid complex' },
  { id: 'stonehenge', name: 'Salisbury Plain, England', at: [-1.8275, 51.1781], yaw: 50, article: 'Stonehenge' },
  { id: 'athens', name: 'The Acropolis, Athens', at: [23.7243, 37.9718], yaw: 95, eye: 2, article: 'Acropolis of Athens' },
  { id: 'rome', name: 'Rome', at: [12.4907, 41.8892], yaw: 45, pitch: 8, article: 'Colosseum' },
  { id: 'istanbul', name: 'Constantinople / Istanbul', at: [28.9772, 41.0078], yaw: 70, pitch: 10, article: 'Hagia Sophia' },
  { id: 'angkor', name: 'Angkor, Cambodia', at: [103.8625, 13.4125], yaw: 90, pitch: 8, article: 'Angkor Wat' },
  { id: 'paris', name: 'Paris', at: [2.2992, 48.8553], yaw: 315, pitch: 12, article: 'Champ de Mars' },
  { id: 'agra', name: 'Agra, India', at: [78.0421, 27.1728], yaw: 0, pitch: 10, article: 'Taj Mahal' },
  { id: 'newyork', name: 'New York Harbor', at: [-74.0458, 40.688], yaw: 35, pitch: 14, article: 'Liberty Island' },
  { id: 'dubai', name: 'Dubai', at: [55.279, 25.1945], yaw: 300, pitch: 20, article: 'Downtown Dubai' },
]
export const ROUNDS = 5
export const T_MIN = -2999
export const T_MAX = 2026

type Round = { site: Site; t: number; options: Site[] }
type State = {
  playing: boolean
  round: number
  score: number
  current: Round | null
  phase: 'look' | 'guess' | 'reveal' | 'done'
  guess: { site: string | null; t: number }
  last: { place: number; year: number } | null
  start: () => void
  openGuess: () => void
  setGuess: (g: Partial<State['guess']>) => void
  submit: () => void
  next: () => void
  end: () => void
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

/** A year: half the time near a landmark's own dates at that site, so there is something to read */
function pickYear(site: Site) {
  const near = LANDMARKS.filter((l) => Math.hypot(l.at[0] - site.at[0], l.at[1] - site.at[1]) < 0.2)
  if (near.length && Math.random() < 0.55) {
    const l = pick(near)
    const edges = l.phases.flatMap((p) => [p.from, p.to]).filter((y) => y > T_MIN && y < T_MAX)
    const e = pick(edges.length ? edges : [l.phases[0].from])
    return Math.round(Math.max(T_MIN, Math.min(T_MAX, e + (Math.random() - 0.5) * 600)))
  }
  // otherwise anywhere, leaning to recorded history
  return Math.round(Math.random() < 0.7 ? 500 + Math.random() * (T_MAX - 500) : T_MIN + Math.random() * (500 - T_MIN))
}

function makeRound(): Round {
  const site = pick(SITES)
  const t = pickYear(site)
  const others = shuffle(SITES.filter((s) => s.id !== site.id)).slice(0, 3)
  return { site, t, options: shuffle([site, ...others]) }
}

function place(r: Round) {
  const hour = 6.5 + Math.random() * 11
  world.sunForce = subsolarFor(r.t, hour, r.site.at[0])
  goTo(r.t, 0.01)
  useTime.getState().set({ side: null, paletteOpen: false })
  useGround.getState().enter({ lon: r.site.at[0], lat: r.site.at[1], yaw: r.site.yaw, pitch: r.site.pitch ?? 4, eye: r.site.eye ?? 1.7 })
}

export const useTraveller = create<State>()((set, get) => ({
  playing: false,
  round: 0,
  score: 0,
  current: null,
  phase: 'look',
  guess: { site: null, t: 1500 },
  last: null,
  start: () => {
    const r = makeRound()
    set({ playing: true, round: 1, score: 0, current: r, phase: 'look', guess: { site: null, t: 1500 }, last: null })
    place(r)
  },
  openGuess: () => set({ phase: 'guess' }),
  setGuess: (g) => set((s) => ({ guess: { ...s.guess, ...g } })),
  submit: () => {
    const { current, guess } = get()
    if (!current) return
    const placePts = guess.site === current.site.id ? 40 : 0
    const tol = current.t < 1500 ? 350 : 130
    const yearPts = Math.round(60 * Math.max(0, 1 - Math.abs(guess.t - current.t) / tol))
    set((s) => ({ phase: 'reveal', score: s.score + placePts + yearPts, last: { place: placePts, year: yearPts } }))
  },
  next: () => {
    const { round } = get()
    if (round >= ROUNDS) {
      set({ phase: 'done' })
      return
    }
    const r = makeRound()
    set({ round: round + 1, current: r, phase: 'look', guess: { site: null, t: 1500 }, last: null })
    place(r)
  },
  end: () => {
    set({ playing: false, current: null, phase: 'look' })
    world.sunForce = null
  },
}))

// leaving the ground by any means ends the game
useGround.subscribe((g, prev) => {
  if (prev.on && !g.on && !g.entering && useTraveller.getState().playing) useTraveller.getState().end()
})

if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) (window as unknown as { __traveller: typeof useTraveller }).__traveller = useTraveller
