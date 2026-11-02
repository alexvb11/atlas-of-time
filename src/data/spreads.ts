// Things that spread across the map: a plague, a technology, a faith, a people. Each point is a
// place with the year it was reached, as given in the linked Wikipedia article (approx: the
// sources give a range or the year is commonly rounded). While the time is within a spread, the
// reached places light up and arcs run from where each arrival came from. A spread is a
// sequence of documented arrivals, not a reconstruction of every route.
// Years are astronomical (1 BCE = 0); fractions are months.

export type SpreadPoint = { at: [number, number]; t: number; place: string; from?: number; approx?: boolean }
export type Spread = { id: string; name: string; article: string; color: string; blurb: string; points: SpreadPoint[] }

const bce = (y: number) => 1 - y

export const SPREADS: Spread[] = [
  {
    id: 'black-death',
    name: 'The Black Death',
    article: 'Black Death',
    color: '#e0786a',
    blurb: 'Plague reached Europe from Caffa in 1347 and killed perhaps a third to a half of its people by 1353.',
    points: [
      { at: [35.38, 45.03], t: 1347.0, place: 'Caffa (Crimea)', approx: true },
      { at: [28.98, 41.01], t: 1347.4, place: 'Constantinople', from: 0, approx: true },
      { at: [15.55, 38.19], t: 1347.8, place: 'Messina, Sicily', from: 1 },
      { at: [29.92, 31.2], t: 1347.8, place: 'Alexandria', from: 1, approx: true },
      { at: [8.93, 44.41], t: 1348.05, place: 'Genoa', from: 2 },
      { at: [12.34, 45.44], t: 1348.05, place: 'Venice', from: 2 },
      { at: [10.4, 43.72], t: 1348.1, place: 'Pisa', from: 2 },
      { at: [5.37, 43.3], t: 1347.9, place: 'Marseille', from: 2, approx: true },
      { at: [11.26, 43.77], t: 1348.25, place: 'Florence', from: 6, approx: true },
      { at: [2.35, 48.85], t: 1348.45, place: 'Paris', from: 7, approx: true },
      { at: [-2.46, 50.61], t: 1348.45, place: 'Weymouth (England)', from: 7, approx: true },
      { at: [-0.1, 51.5], t: 1348.8, place: 'London', from: 10, approx: true },
      { at: [8.68, 50.11], t: 1349.3, place: 'Frankfurt', from: 9, approx: true },
      { at: [5.32, 60.39], t: 1349.5, place: 'Bergen, via Askøy', from: 11 },
      { at: [18.07, 59.33], t: 1350.3, place: 'Stockholm', from: 13, approx: true },
      { at: [28.33, 57.82], t: 1352.3, place: 'Pskov (northern Russia)', from: 14, approx: true },
      { at: [37.62, 55.75], t: 1353.3, place: 'Moscow', from: 15 },
    ],
  },
  {
    id: 'printing',
    name: 'The printing press',
    article: 'Global spread of the printing press',
    color: '#9fd0ff',
    blurb: 'From Gutenberg’s Mainz to most of Europe within a generation, then to the Americas and Asia.',
    points: [
      { at: [8.27, 50.0], t: 1452, place: 'Mainz (the Gutenberg Bible, 1452–1454)', approx: true },
      { at: [6.96, 50.94], t: 1466, place: 'Cologne', from: 0 },
      { at: [12.5, 41.9], t: 1467, place: 'Rome', from: 0 },
      { at: [12.34, 45.44], t: 1469, place: 'Venice', from: 0 },
      { at: [2.35, 48.85], t: 1470, place: 'Paris', from: 0 },
      { at: [19.04, 47.5], t: 1473, place: 'Buda', from: 3 },
      { at: [19.94, 50.06], t: 1473, place: 'Kraków', from: 0 },
      { at: [-0.13, 51.5], t: 1477, place: 'London (Westminster)', from: 1 },
      { at: [28.98, 41.01], t: 1493, place: 'Constantinople (Hebrew press)', from: 3 },
      { at: [-99.13, 19.43], t: 1539, place: 'Mexico City', from: 4, approx: true },
      { at: [73.83, 15.5], t: 1556, place: 'Goa', from: 4 },
    ],
  },
  {
    id: 'islam',
    name: 'The early Muslim conquests',
    article: 'Early Muslim conquests',
    color: '#8fd9a8',
    blurb: 'From Medina in 622 to Iberia, Central Asia and the Indus within a century.',
    points: [
      { at: [39.61, 24.47], t: 622, place: 'Medina (the Hijra)' },
      { at: [39.83, 21.42], t: 630, place: 'Mecca', from: 0 },
      { at: [36.29, 33.51], t: 635, place: 'Damascus', from: 1, approx: true },
      { at: [44.58, 33.09], t: 637, place: 'Ctesiphon', from: 1 },
      { at: [35.23, 31.78], t: 637, place: 'Jerusalem', from: 2, approx: true },
      { at: [29.92, 31.2], t: 641, place: 'Alexandria', from: 4, approx: true },
      { at: [48.4, 34.2], t: 642, place: 'Nahavand', from: 3 },
      { at: [10.32, 36.85], t: 698, place: 'Carthage', from: 5 },
      { at: [-4.03, 39.86], t: 711, place: 'Toledo (Iberia)', from: 7 },
      { at: [67.4, 24.7], t: 711, place: 'Sindh (Debal)', from: 6, approx: true },
      { at: [66.96, 39.65], t: 712, place: 'Samarkand', from: 6 },
    ],
  },
  {
    id: 'polynesia',
    name: 'The settlement of Polynesia',
    article: 'Polynesia',
    color: '#ffd38a',
    blurb: 'Voyagers reached Tonga about 900 BCE, then, after a long pause, the far islands by canoe.',
    points: [
      { at: [-175.2, -21.1], t: bce(900), place: 'Tonga', approx: true },
      { at: [-151.75, -16.5], t: 1050, place: 'Society Islands', from: 0, approx: true },
      { at: [-155.5, 19.6], t: 1250, place: 'Hawaii', from: 1, approx: true },
      { at: [-109.35, -27.12], t: 1250, place: 'Rapa Nui (Easter Island)', from: 1, approx: true },
      { at: [174.8, -41.3], t: 1250, place: 'New Zealand (Aotearoa)', from: 1, approx: true },
    ],
  },
]

/** 0..1 visibility at t: from just before the first arrival until a while after the last */
export function spreadAlpha(s: Spread, t: number) {
  const a = s.points[0].t
  const b = Math.max(...s.points.map((p) => p.t))
  const lead = Math.max(1, (b - a) * 0.05)
  const tail = Math.max(3, (b - a) * 0.25)
  if (t < a - lead || t > b + tail) return 0
  return Math.min(1, (t - (a - lead)) / lead, (b + tail - t) / tail)
}
