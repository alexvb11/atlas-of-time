import { PRESENT, yearsAgo } from './scale'

const nf = new Intl.NumberFormat('en-US')

export type DateParts = { value: string; unit: string; approx: boolean }

/** Splits a time into a big number and a unit, e.g. {value:'200', unit:'million years ago'} */
export function dateParts(t: number): DateParts {
  const ya = yearsAgo(t)
  if (ya >= 1e9) return { value: (ya / 1e9).toFixed(2), unit: 'billion years ago', approx: true }
  if (ya >= 1e6) {
    const m = ya / 1e6
    return { value: m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2), unit: 'million years ago', approx: true }
  }
  if (ya >= 12000) {
    const k = ya / 1000
    return { value: k >= 100 ? nf.format(Math.round(k)) : k.toFixed(1), unit: 'thousand years ago', approx: true }
  }
  // a year runs from y.0 to y.999: 1776.5 is July 1776, not 1777
  const y = Math.floor(t + 1e-6)
  if (y <= 0) return { value: nf.format(1 - y), unit: 'BCE', approx: y < -3000 }
  if (y >= PRESENT) return { value: String(PRESENT), unit: 'CE · today', approx: false }
  return { value: String(y), unit: 'CE', approx: false }
}

export function formatDate(t: number): string {
  const p = dateParts(t)
  return `${p.approx && !p.unit.includes('ago') ? 'c. ' : ''}${p.value} ${p.unit}`
}

/** Short year label for timelines: "44 BCE", "1914", "c. 860 BCE" */
export function formatYear(t: number, approx = false): string {
  const y = Math.floor(t + 1e-6)
  const ya = yearsAgo(t)
  if (ya >= 12000) return dateParts(t).value + (ya >= 1e6 ? ' Ma' : ' ka')
  const s = y <= 0 ? `${nf.format(1 - y)} BCE` : `${y}`
  return approx ? `c. ${s}` : s
}

export function formatPopulation(n: number): string {
  n = Number(n.toPrecision(3))
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)} billion`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} million`
  if (n >= 1e3) return `${Math.round(n / 1e3)} thousand`
  return nf.format(Math.round(n))
}

export const formatNumber = (n: number) => nf.format(Math.round(n))
