// Low-precision astronomy for the sky around the globe: the Sun's right ascension, the Moon's
// place, precession and proper motion of the stars. Formulas from Meeus, Astronomical Algorithms
// (2nd ed., ch. 25 and 47, truncated), and the IAU general precession of 50.29" a year. Good to a
// fraction of a degree for the last few thousand years, which is all the sky is drawn for.
const D2R = Math.PI / 180
const norm360 = (x: number) => ((x % 360) + 360) % 360

/** Julian day of an astronomical decimal year (2000.0 = 1 Jan 2000, 0h) */
export const jdOf = (t: number) => 2451544.5 + (t - 2000) * 365.2425

/** Earth's axial tilt in degrees (Laskar 1986), held at its ends outside ±6,000 years of 2000 */
export function obliquity(t: number) {
  const T = Math.min(60, Math.max(-80, (t - 2000) / 100))
  return 23.439291 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T
}

/** Ecliptic (lon, lat, degrees) to equatorial (RA, Dec) for an obliquity eps */
export function eclToEq(lon: number, lat: number, eps: number): [number, number] {
  const l = lon * D2R
  const b = lat * D2R
  const e = eps * D2R
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l))
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
  return [norm360(ra / D2R), dec / D2R]
}

export function eqToEcl(ra: number, dec: number, eps: number): [number, number] {
  const a = ra * D2R
  const d = dec * D2R
  const e = eps * D2R
  const lon = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a))
  const lat = Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a))
  return [norm360(lon / D2R), lat / D2R]
}

/** The Sun's right ascension (degrees, equinox of date) at time t */
export function sunRA(t: number): number {
  const d = jdOf(t) - 2451545
  const g = (357.529 + 0.98560028 * d) * D2R
  const q = 280.459 + 0.98564736 * d
  const L = q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)
  return eclToEq(L, 0, obliquity(t))[0]
}

/** The Moon's place (RA, Dec in degrees, equinox of date) and distance in Earth radii */
export function moonPlace(t: number): { ra: number; dec: number; dist: number } {
  const d = jdOf(t) - 2451545
  const Lp = 218.316 + 13.176396 * d
  const M = (134.963 + 13.064993 * d) * D2R
  const Ms = (357.529 + 0.98560028 * d) * D2R
  const D = (297.85 + 12.190749 * d) * D2R
  const F = (93.272 + 13.22935 * d) * D2R
  const lon = Lp + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)
  const lat = 5.128 * Math.sin(F)
  const km = 385001 - 20905 * Math.cos(M)
  const [ra, dec] = eclToEq(norm360(lon), lat, obliquity(t))
  return { ra, dec, dist: km / 6371 }
}

/**
 * A J2000 star position carried to time t: proper motion (pmRA is μα·cosδ, arcsec a year), then
 * general precession along the ecliptic. Linear in time, so only meaningful for some millennia.
 */
export function starAt(ra: number, dec: number, pmRA: number, pmDec: number, t: number): [number, number] {
  const years = t - 2000
  const cd = Math.max(1e-6, Math.cos(dec * D2R))
  let r = ra + (pmRA * years) / 3600 / cd
  let dd = dec + (pmDec * years) / 3600
  if (dd > 90) {
    dd = 180 - dd
    r += 180
  } else if (dd < -90) {
    dd = -180 - dd
    r += 180
  }
  const eps0 = 23.4392911
  const [lon, lat] = eqToEcl(norm360(r), dd, eps0)
  return eclToEq(lon + (50.29 * years) / 3600, lat, obliquity(t))
}
