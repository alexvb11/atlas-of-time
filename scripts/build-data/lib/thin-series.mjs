// Drops points of a [t, v][] series that the app's log-linear interpolation (interpSeries in
// src/data/entities.ts) reproduces exactly at the stored precision (3 significant figures).
// Lossless as far as the app can tell; most of OWID's annual points after 1800 go.
const same = (a, b) => Number(a.toPrecision(3)) === Number(b.toPrecision(3))
const interp = ([t0, v0], [t1, v1], t) => (v0 > 0 && v1 > 0 ? Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * ((t - t0) / (t1 - t0))) : v0 + (v1 - v0) * ((t - t0) / (t1 - t0)))

export function thinSeries(s) {
  if (s.length < 3) return s
  const out = [s[0]]
  let k = 0
  for (let i = 1; i < s.length - 1; i++) {
    // can the segment from the last kept point reach i + 1 and still reproduce every point between?
    let ok = true
    for (let j = k + 1; j <= i && ok; j++) ok = same(interp(s[k], s[i + 1], s[j][0]), s[j][1])
    if (!ok) {
      out.push(s[i])
      k = i
    }
  }
  out.push(s[s.length - 1])
  return out
}
