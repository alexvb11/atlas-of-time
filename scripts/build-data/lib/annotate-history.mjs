// Precomputes per-feature bounding box, area and label point for a history snapshot, so the
// browser does no spherical geometry when a snapshot loads (it was ~1 s per scrub on phones).
// Writes them as properties: _b [minLon, minLat, maxLon, maxLat], _a steradians, _l [lon, lat].
import { geoArea, geoCentroid } from 'd3-geo'

const r2 = (x) => Math.round(x * 100) / 100

export function annotate(g) {
  for (const f of g.features) {
    const geom = f.geometry
    if (!geom) continue
    const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).filter((p) => p?.[0]?.length >= 4)
    if (!polys.length) continue
    let minX = 180, minY = 90, maxX = -180, maxY = -90
    for (const poly of polys)
      for (const [x, y] of poly[0]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    // rings are RFC 7946 (counter-clockwise) but d3-geo expects clockwise, so it measures the
    // complement: areas come out as 4π - a and centroids as antipodes. Correct for both.
    let best = polys[0]
    let bestA = -1
    let flipped = false
    let area = 0
    for (const poly of polys) {
      const raw = geoArea({ type: 'Polygon', coordinates: poly })
      const a = raw > 2 * Math.PI ? 4 * Math.PI - raw : raw
      area += a
      if (a > bestA) {
        bestA = a
        best = poly
        flipped = raw > 2 * Math.PI
      }
    }
    const c = geoCentroid({ type: 'Polygon', coordinates: best })
    const label = flipped ? [c[0] > 0 ? c[0] - 180 : c[0] + 180, -c[1]] : c
    f.properties._b = [minX, minY, maxX, maxY]
    f.properties._a = Number(area.toPrecision(4))
    f.properties._l = label.map(r2)
  }
  return g
}
