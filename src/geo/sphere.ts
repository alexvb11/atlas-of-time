import * as THREE from 'three'

export type LonLat = [number, number]
const D2R = Math.PI / 180

// Must match scripts/build-data/drift.mjs and three's SphereGeometry UV layout.
export function lonLatToVec3(lon: number, lat: number, r = 1, out = new THREE.Vector3()) {
  const p = lat * D2R
  const l = lon * D2R
  return out.set(Math.cos(p) * Math.cos(l) * r, Math.sin(p) * r, -Math.cos(p) * Math.sin(l) * r)
}

export function vec3ToLonLat(v: THREE.Vector3): LonLat {
  const n = v.clone().normalize()
  return [Math.atan2(-n.z, n.x) / D2R, Math.asin(Math.max(-1, Math.min(1, n.y))) / D2R]
}

/** Great-circle angle in degrees */
export function angleBetween(a: LonLat, b: LonLat) {
  return lonLatToVec3(...a).angleTo(lonLatToVec3(...b)) / D2R
}

export { pointInRing, pointInPolygon } from './segments'
