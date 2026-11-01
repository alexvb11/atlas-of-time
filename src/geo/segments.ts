// Ring list -> line segments on the unit sphere, densified so long edges follow the curve.
// Plain math, no three.js, so the history worker can use it too. Must match lonLatToVec3 in sphere.ts.
const D2R = Math.PI / 180

export function ringsToSegments(rings: number[][][], maxStep = 1.2): Float32Array {
  let cap = 1024
  let out = new Float32Array(cap)
  let n = 0
  const push = (x: number, y: number, z: number) => {
    if (n + 3 > cap) {
      const grown = new Float32Array((cap *= 2))
      grown.set(out)
      out = grown
    }
    out[n++] = x
    out[n++] = y
    out[n++] = z
  }
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      // skip edges that run along the antimeridian / pole cut lines
      if ((Math.abs(x1) === 180 && x1 === x2) || (Math.abs(y1) >= 89.9 && Math.abs(y2) >= 89.9)) continue
      const p1 = y1 * D2R, l1 = x1 * D2R, p2 = y2 * D2R, l2 = x2 * D2R
      const ax = Math.cos(p1) * Math.cos(l1), ay = Math.sin(p1), az = -Math.cos(p1) * Math.sin(l1)
      const bx = Math.cos(p2) * Math.cos(l2), by = Math.sin(p2), bz = -Math.cos(p2) * Math.sin(l2)
      const angle = Math.acos(Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz)))
      const steps = Math.max(1, Math.ceil(angle / D2R / maxStep))
      let px = ax, py = ay, pz = az
      for (let s = 1; s <= steps; s++) {
        const f = s / steps
        let qx = ax + (bx - ax) * f, qy = ay + (by - ay) * f, qz = az + (bz - az) * f
        const len = Math.hypot(qx, qy, qz) || 1
        qx /= len
        qy /= len
        qz /= len
        push(px, py, pz)
        push(qx, qy, qz)
        px = qx
        py = qy
        pz = qz
      }
    }
  }
  return out.slice(0, n)
}

/** Ray-casting point-in-ring in lon/lat (rings from GeoJSON) */
export function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function pointInPolygon(lon: number, lat: number, poly: number[][][]) {
  if (!pointInRing(lon, lat, poly[0])) return false
  for (let h = 1; h < poly.length; h++) if (pointInRing(lon, lat, poly[h])) return false
  return true
}
