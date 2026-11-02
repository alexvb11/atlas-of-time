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

/** The smallest step that changes the big readout at t: a year in history, longer further back */
export function stepAt(t: number): number {
  const ya = yearsAgo(t)
  // matches the precision dateParts shows: 1 Ma, 0.1 Ma, 0.01 Ma, 1 ka, 0.1 ka, then one year
  if (ya >= 1e8) return 1e6
  if (ya >= 1e7) return 1e5
  if (ya >= 1e6) return 1e4
  if (ya >= 1e5) return 1e3
  if (ya >= 12000) return 100
  return 1
}

/** t moved to the middle of its readout unit (mid-year in history), so a stop is an exact year */
export function settle(t: number): number {
  const step = stepAt(t)
  if (step === 1) return Math.min(PRESENT, Math.floor(t) + 0.5)
  return fromYearsAgo(Math.round(yearsAgo(t) / step) * step)
}

/** step whole units from t: n years in history, n readout units further back */
export function stepFrom(t: number, n: number): number {
  const step = stepAt(t)
  if (step === 1) {
    const y = Math.floor(t) + n
    return y >= PRESENT ? PRESENT : Math.max(T_MIN, y + 0.5)
  }
  return Math.min(PRESENT, Math.max(T_MIN, fromYearsAgo(Math.round(yearsAgo(t) / step) * step - n * step)))
}

/**
 * A typed time: "1066", "1066 AD", "44 BC", "3000 BCE", "12,000 years ago", "20 ka", "65 Ma",
 * "65 million years ago". Null when it cannot be read or is out of range.
 */
export function parseTime(raw: string): number | null {
  const q = raw.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ')
  let m = q.match(/^(\d+(?:\.\d+)?)\s*(ma|mya|million years ago|million years|myr)$/)
  if (m) return clampT(fromYearsAgo(Number(m[1]) * 1e6))
  m = q.match(/^(\d+(?:\.\d+)?)\s*(ka|kya|thousand years ago)$/)
  if (m) return clampT(fromYearsAgo(Number(m[1]) * 1e3))
  m = q.match(/^(\d+)\s*(years ago|yrs ago|ya)$/)
  if (m) return clampT(fromYearsAgo(Number(m[1])))
  m = q.match(/^(?:(ad|ce)\s*)?(\d{1,7})\s*(bce|bc|b\.c\.|ce|ad|a\.d\.)?$/)
  if (m) {
    const n = Number(m[2])
    const bc = /^b/.test(m[3] ?? '')
    if (!bc && n === 0) return null
    const y = bc ? 1 - n : n
    if (y > PRESENT) return null
    return clampT(y >= PRESENT ? PRESENT : y + 0.5)
  }
  return null
}
const clampT = (t: number) => (t < T_MIN ? null : Math.min(PRESENT, t))
