// The single time axis: astronomical years (1 CE = 1, 1 BCE = 0, 500 BCE = -499).
// Deep time sits on the same axis: 200 Ma = PRESENT - 200e6.

export const PRESENT = 2026
export const DEEP_START_MA = 750

export const yearsAgo = (t: number) => PRESENT - t
export const fromYearsAgo = (ya: number) => PRESENT - ya
export const toMa = (t: number) => (PRESENT - t) / 1e6

// Slider mapping. Each segment is [u0, u1, t0, t1, kind]; "log" interpolates years-before-present
// logarithmically so both 600 Ma and 20 ka get usable track length.
type Seg = { u0: number; u1: number; t0: number; t1: number; log: boolean }
export const SEGMENTS: Seg[] = [
  { u0: 0, u1: 0.3, t0: fromYearsAgo(DEEP_START_MA * 1e6), t1: fromYearsAgo(1e6), log: true },
  { u0: 0.3, u1: 0.48, t0: fromYearsAgo(1e6), t1: -2999, log: true },
  { u0: 0.48, u1: 0.68, t0: -2999, t1: 500, log: false },
  { u0: 0.68, u1: 0.79, t0: 500, t1: 1500, log: false },
  { u0: 0.79, u1: 0.9, t0: 1500, t1: 1900, log: false },
  { u0: 0.9, u1: 1, t0: 1900, t1: PRESENT, log: false },
]

export const ZONES = [
  { u0: 0, u1: 0.3, label: 'Deep time' },
  { u0: 0.3, u1: 0.48, label: 'Prehistory' },
  { u0: 0.48, u1: 1, label: 'Recorded history' },
]

export const T_MIN = SEGMENTS[0].t0
export const T_MAX = PRESENT

export function uToTime(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  const s = SEGMENTS.find((g) => x <= g.u1) ?? SEGMENTS[SEGMENTS.length - 1]
  const f = (x - s.u0) / (s.u1 - s.u0)
  if (s.log) {
    const a = Math.log(yearsAgo(s.t0))
    const b = Math.log(yearsAgo(s.t1))
    return fromYearsAgo(Math.exp(a + (b - a) * f))
  }
  return s.t0 + (s.t1 - s.t0) * f
}

export function timeToU(t: number): number {
  const x = Math.min(T_MAX, Math.max(T_MIN, t))
  const s = SEGMENTS.find((g) => x <= g.t1) ?? SEGMENTS[SEGMENTS.length - 1]
  let f: number
  if (s.log) {
    const a = Math.log(yearsAgo(s.t0))
    const b = Math.log(yearsAgo(s.t1))
    f = (Math.log(Math.max(1, yearsAgo(x))) - a) / (b - a)
  } else f = (x - s.t0) / (s.t1 - s.t0)
  return s.u0 + (s.u1 - s.u0) * Math.min(1, Math.max(0, f))
}
