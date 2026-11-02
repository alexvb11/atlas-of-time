// Landmarks in 3D: simplified massing models at their true size and place, standing in the years
// they stood and changing when history changed them. Dimensions are the commonly published ones
// (Wikipedia); shapes are simplified (no carving, windows or ornament). Orientation is given as
// the bearing of the long axis, approximate where noted. Years are astronomical (1 BCE = 0).
//
// Parts are built in a local frame in metres: x east, y up, z south (so north is -z).

export type Part =
  | { kind: 'box'; w: number; d: number; h: number; x?: number; z?: number; y?: number }
  | { kind: 'pyramid'; w: number; d: number; h: number; x?: number; z?: number; y?: number }
  | { kind: 'cyl'; r: number; h: number; x?: number; z?: number; y?: number; r2?: number; seg?: number }
  | { kind: 'dome'; r: number; x?: number; z?: number; y?: number }
  | { kind: 'ring'; a: number; b: number; h: number; t: number; arc?: [number, number] }

export type Phase = { from: number; to: number; parts: Part[]; note?: string }
export type Landmark = {
  id: string
  name: string
  article: string
  at: [number, number]
  /** ground elevation in metres, so the model stands on the terrain */
  elev: number
  /** bearing of the model's x axis from east, degrees (counter-clockwise) */
  turn?: number
  color: string
  phases: Phase[]
}

const bce = (y: number) => 1 - y
const NOW = 3000

// columns along a rectangle's edges, for temples
function colonnade(w: number, d: number, h: number, step: number, r: number, y = 0): Part[] {
  const out: Part[] = []
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) {
    out.push({ kind: 'cyl', r, h, x, z: -d / 2, y, seg: 8 }, { kind: 'cyl', r, h, x, z: d / 2, y, seg: 8 })
  }
  for (let z = -d / 2 + step; z < d / 2 - 0.01; z += step) {
    out.push({ kind: 'cyl', r, h, x: -w / 2, z, y, seg: 8 }, { kind: 'cyl', r, h, x: w / 2, z, y, seg: 8 })
  }
  return out
}

// a ring of standing stones with lintels (Stonehenge's sarsen circle)
function stoneCircle(radius: number, n: number, h: number): Part[] {
  const out: Part[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({ kind: 'box', w: 2.1, d: 1.1, h, x: Math.cos(a) * radius, z: Math.sin(a) * radius })
    out.push({ kind: 'box', w: 3.4, d: 1.0, h: 0.8, x: Math.cos(a + Math.PI / n) * radius, z: Math.sin(a + Math.PI / n) * radius, y: h })
  }
  return out
}

const parthenon = (roof: boolean): Part[] => [
  { kind: 'box', w: 72, d: 34, h: 2.5 },
  ...colonnade(69.5, 30.9, 10.4, 4.3, 0.95, 2.5).filter((p) => roof || !(p.kind === 'cyl' && Math.abs(p.x ?? 0) < 14 && Math.abs(p.z ?? 0) > 10)),
  ...(roof ? ([{ kind: 'box', w: 69.5, d: 30.9, h: 1.5, y: 12.9 }, { kind: 'pyramid', w: 69.5, d: 30.9, h: 3.2, y: 14.4 }] as Part[]) : [{ kind: 'box', w: 20, d: 30.9, h: 1.5, y: 12.9, x: -24 }, { kind: 'box', w: 20, d: 30.9, h: 1.5, y: 12.9, x: 24 }] as Part[]),
]

const notreDame = (spire: boolean, towers: boolean, roof = true): Part[] => [
  { kind: 'box', w: 128, d: 40, h: 33 },
  ...(roof ? ([{ kind: 'pyramid', w: 128, d: 14, h: 10, y: 33 }] as Part[]) : []),
  { kind: 'box', w: 12, d: 48, h: 33, x: 20 },
  ...(towers ? ([{ kind: 'box', w: 15, d: 15, h: 69, x: -56, z: -15 }, { kind: 'box', w: 15, d: 15, h: 69, x: -56, z: 15 }, { kind: 'box', w: 12, d: 18, h: 45, x: -56 }] as Part[]) : []),
  ...(spire ? ([{ kind: 'cyl', r: 4, r2: 0.3, h: 63, y: 33, x: 20, seg: 8 }] as Part[]) : []),
]

export const LANDMARKS: Landmark[] = [
  {
    id: 'khufu',
    name: 'Great Pyramid of Giza',
    article: 'Great Pyramid of Giza',
    at: [31.13417, 29.97917],
    elev: 60,
    color: '#e8d5a8',
    phases: [
      // finished c. 2560 BCE at 146.6 m; the casing was quarried away after the earthquake of 1303
      { from: bce(2560), to: 1303, parts: [{ kind: 'pyramid', w: 230.3, d: 230.3, h: 146.6 }] },
      { from: 1303, to: NOW, parts: [{ kind: 'pyramid', w: 230.3, d: 230.3, h: 138.5 }], note: 'without its casing stones' },
    ],
  },
  {
    id: 'khafre',
    name: 'Pyramid of Khafre',
    article: 'Pyramid of Khafre',
    at: [31.1308, 29.9761],
    elev: 70,
    color: '#e3cf9f',
    phases: [{ from: bce(2530), to: NOW, parts: [{ kind: 'pyramid', w: 215.3, d: 215.3, h: 143.5 }] }],
  },
  {
    id: 'menkaure',
    name: 'Pyramid of Menkaure',
    article: 'Pyramid of Menkaure',
    at: [31.1281, 29.9725],
    elev: 70,
    color: '#dcc796',
    phases: [{ from: bce(2510), to: NOW, parts: [{ kind: 'pyramid', w: 102.2, d: 104.6, h: 65.5 }] }],
  },
  {
    id: 'stonehenge',
    name: 'Stonehenge',
    article: 'Stonehenge',
    at: [-1.82611, 51.17889],
    elev: 100,
    color: '#b9b4a6',
    phases: [{ from: bce(2500), to: NOW, parts: [...stoneCircle(16.5, 30, 4.1), { kind: 'box', w: 2.5, d: 1.4, h: 7.3, x: 0, z: -6 }, { kind: 'box', w: 2.5, d: 1.4, h: 6.5, x: -5, z: -2 }, { kind: 'box', w: 2.5, d: 1.4, h: 6.5, x: 5, z: -2 }] }],
  },
  {
    id: 'parthenon',
    name: 'Parthenon',
    article: 'Parthenon',
    at: [23.7266, 37.9715],
    elev: 150,
    color: '#ece4d4',
    phases: [
      { from: bce(432), to: 1687.73, parts: parthenon(true) },
      // a Venetian shell hit the Ottoman powder store inside on 26 September 1687
      { from: 1687.73, to: NOW, parts: parthenon(false), note: 'ruined by the explosion of 1687' },
    ],
  },
  {
    id: 'colosseum',
    name: 'Colosseum',
    article: 'Colosseum',
    at: [12.4922, 41.8903],
    elev: 25,
    turn: 20, // long axis, approximate
    color: '#d8c3a0',
    phases: [
      { from: 80, to: 1349, parts: [{ kind: 'ring', a: 94.5, b: 78, h: 48, t: 50 }] },
      // the earthquake of 1349 brought down the outer south side
      { from: 1349, to: NOW, parts: [{ kind: 'ring', a: 94.5, b: 78, h: 48, t: 50, arc: [0, 1.25] }, { kind: 'ring', a: 80, b: 64, h: 36, t: 36 }], note: 'after the earthquake of 1349' },
    ],
  },
  {
    id: 'hagia-sophia',
    name: 'Hagia Sophia',
    article: 'Hagia Sophia',
    at: [28.98, 41.00833],
    elev: 30,
    color: '#d6a98a',
    phases: [
      { from: 537.95, to: 1453.4, parts: [{ kind: 'box', w: 82, d: 73, h: 25 }, { kind: 'cyl', r: 17, h: 15, y: 25 }, { kind: 'dome', r: 16, y: 40 }] },
      // minarets were added from the conquest of 1453; four stood by the 1570s (dates approximate)
      { from: 1453.4, to: 1574, parts: [{ kind: 'box', w: 82, d: 73, h: 25 }, { kind: 'cyl', r: 17, h: 15, y: 25 }, { kind: 'dome', r: 16, y: 40 }, { kind: 'cyl', r: 2.5, h: 60, x: 45, z: 40, seg: 10 }] },
      { from: 1574, to: NOW, parts: [{ kind: 'box', w: 82, d: 73, h: 25 }, { kind: 'cyl', r: 17, h: 15, y: 25 }, { kind: 'dome', r: 16, y: 40 }, ...[[-45, -40], [45, -40], [-45, 40], [45, 40]].map(([x, z]) => ({ kind: 'cyl', r: 2.5, h: 60, x, z, seg: 10 }) as Part)] },
    ],
  },
  {
    id: 'angkor-wat',
    name: 'Angkor Wat',
    article: 'Angkor Wat',
    at: [103.86667, 13.4125],
    elev: 20,
    color: '#9c8f78',
    phases: [
      {
        from: 1150,
        to: NOW,
        parts: [
          { kind: 'box', w: 215, d: 187, h: 3.5 },
          { kind: 'box', w: 115, d: 100, h: 7, y: 3.5 },
          { kind: 'box', w: 75, d: 75, h: 13, y: 10.5 },
          { kind: 'cyl', r: 10, r2: 2, h: 42, y: 23.5, seg: 8 },
          ...[[-30, -30], [30, -30], [-30, 30], [30, 30]].map(([x, z]) => ({ kind: 'cyl', r: 7, r2: 1.5, h: 28, y: 23.5, x, z, seg: 8 }) as Part),
        ],
      },
    ],
  },
  {
    id: 'notre-dame',
    name: 'Notre-Dame de Paris',
    article: 'Notre-Dame de Paris',
    at: [2.35, 48.85306],
    elev: 35,
    turn: -22, // the axis runs WNW–ESE, approximate
    color: '#d2c9b6',
    phases: [
      { from: 1163, to: 1250, parts: notreDame(false, false), note: 'under construction' },
      { from: 1250, to: 1786, parts: notreDame(true, true) },
      { from: 1786, to: 1859, parts: notreDame(false, true), note: 'without its spire, taken down in 1786' },
      { from: 1859, to: 2019.29, parts: notreDame(true, true) },
      // the fire of 15 April 2019 destroyed the spire and the roof; reopened December 2024
      { from: 2019.29, to: 2024.93, parts: notreDame(false, true, false), note: 'after the fire of 2019' },
      { from: 2024.93, to: NOW, parts: notreDame(true, true) },
    ],
  },
  {
    id: 'taj-mahal',
    name: 'Taj Mahal',
    article: 'Taj Mahal',
    at: [78.0419, 27.175],
    elev: 170,
    color: '#f3efe8',
    phases: [
      {
        from: 1643,
        to: NOW,
        parts: [
          { kind: 'box', w: 95, d: 95, h: 7 },
          { kind: 'box', w: 57, d: 57, h: 33, y: 7 },
          { kind: 'cyl', r: 15, h: 9, y: 40 },
          { kind: 'dome', r: 17, y: 49 },
          { kind: 'cyl', r: 0.6, r2: 0.1, h: 7, y: 66 },
          ...[[-44, -44], [44, -44], [-44, 44], [44, 44]].map(([x, z]) => ({ kind: 'cyl', r: 2.6, r2: 2, h: 40, y: 7, x, z, seg: 10 }) as Part),
        ],
      },
    ],
  },
  {
    id: 'eiffel',
    name: 'Eiffel Tower',
    article: 'Eiffel Tower',
    at: [2.2945, 48.85822],
    elev: 33,
    turn: 45,
    color: '#7b6a58',
    phases: [
      // 312 m with its flagpole at the opening; aerials took it to 330 m by 2022
      ...[[1889.25, 1957, 312], [1957, 2022.2, 324], [2022.2, NOW, 330]].map(([from, to, h]): Phase => ({
        from,
        to,
        parts: [
          ...[[-40, -40], [40, -40], [-40, 40], [40, 40]].map(([x, z]) => ({ kind: 'cyl', r: 12, r2: 5, h: 58, x, z, seg: 4 }) as Part),
          { kind: 'box', w: 70, d: 70, h: 4, y: 57 } as Part,
          { kind: 'cyl', r: 36, r2: 14, h: 58, y: 61, seg: 4 } as Part,
          { kind: 'box', w: 30, d: 30, h: 3, y: 115 } as Part,
          { kind: 'cyl', r: 15, r2: 4, h: 160, y: 118, seg: 4 } as Part,
          { kind: 'cyl', r: 4, r2: 0.5, h: h - 278, y: 278, seg: 6 } as Part,
        ],
      })),
    ],
  },
  {
    id: 'liberty',
    name: 'Statue of Liberty',
    article: 'Statue of Liberty',
    at: [-74.0445, 40.6892],
    elev: 0,
    color: '#7fb3a0',
    phases: [
      {
        from: 1886.82,
        to: NOW,
        parts: [
          { kind: 'cyl', r: 50, h: 11, seg: 11 },
          { kind: 'box', w: 20, d: 20, h: 36, y: 11 },
          { kind: 'cyl', r: 6, r2: 3.5, h: 34, y: 47, seg: 10 },
          { kind: 'dome', r: 3.2, y: 81 },
          { kind: 'cyl', r: 0.9, h: 13, y: 74, x: 3.5, seg: 6 },
        ],
      },
    ],
  },
  {
    id: 'burj-khalifa',
    name: 'Burj Khalifa',
    article: 'Burj Khalifa',
    at: [55.2744, 25.1972],
    elev: 5,
    color: '#b8c7d6',
    phases: [
      {
        from: 2010.01,
        to: NOW,
        parts: [
          { kind: 'cyl', r: 40, r2: 30, h: 160, seg: 6 },
          { kind: 'cyl', r: 30, r2: 20, h: 200, y: 160, seg: 6 },
          { kind: 'cyl', r: 20, r2: 11, h: 225, y: 360, seg: 6 },
          { kind: 'cyl', r: 11, r2: 4, h: 100, y: 585, seg: 6 },
          { kind: 'cyl', r: 4, r2: 0.6, h: 143, y: 685, seg: 6 },
        ],
      },
    ],
  },
]

export const phaseAt = (l: Landmark, t: number) => l.phases.find((p) => t >= p.from && t < p.to) ?? null
