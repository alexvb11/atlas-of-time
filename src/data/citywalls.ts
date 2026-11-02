// City walls that still trace their historic towns. Outlines come from OpenStreetMap
// (scripts/build-data/citywalls.mjs, public/data/citywalls.json, © OpenStreetMap contributors,
// ODbL) and show what survives today; each appears from the year its circuit was finished, as
// given in the linked Wikipedia article.
export type CityWall = { id: string; name: string; article: string; from: number; built: string; at: [number, number]; elev: number }

export const CITY_WALLS: CityWall[] = [
  { id: 'rome', name: 'Aurelian Walls', article: 'Aurelian Walls', from: 275, built: 'built 271–275', at: [12.4964, 41.8789], elev: 40 },
  { id: 'constantinople', name: 'Walls of Constantinople', article: 'Walls of Constantinople', from: 413, built: 'land walls finished 413', at: [28.9236, 41.0114], elev: 45 },
  { id: 'jerusalem', name: 'Walls of Jerusalem', article: 'Walls of Jerusalem', from: 1541, built: 'built 1537–1541', at: [35.2296, 31.7767], elev: 760 },
  { id: 'lucca', name: 'Walls of Lucca', article: 'Walls of Lucca', from: 1650, built: 'built 1513–1650', at: [10.5045, 43.8429], elev: 19 },
  { id: 'seoul', name: 'Seoul City Wall', article: 'Seoul City Wall', from: 1396, built: 'built 1395–1396', at: [126.9918, 37.5704], elev: 60 },
]
