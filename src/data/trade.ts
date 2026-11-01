// Major long-distance trade routes, drawn as flowing lines while they were in use. Each route
// follows its well-attested waypoints (cities, oases, straits) joined by great circles; the real
// tracks wandered between them, so the lines are schematic, and the years of use are the
// conventional ranges given in each route's Wikipedia article (all approximate, shown as "c.").
// Sea legs have extra waypoints so they stay off land. Years are astronomical (1 BCE = 0).

export type TradeRoute = {
  id: string
  name: string
  article: string
  /** years in use, approximate */
  from: number
  to: number
  kind: 'land' | 'sea' | 'river'
  goods: string
  /** one or more polylines of [lon, lat]; flow runs from first to last point */
  lines: [number, number][][]
}

const bce = (y: number) => 1 - y

export const TRADE_ROUTES: TradeRoute[] = [
  {
    id: 'royal-road',
    name: 'Royal Road',
    article: 'Royal Road',
    from: bce(500),
    to: bce(330),
    kind: 'land',
    goods: 'The Persian kings’ highway, Susa to Sardis: couriers, armies and caravans',
    lines: [[[48.25, 32.19], [44.01, 36.19], [39.03, 36.87], [38.32, 38.35], [32.86, 39.93], [31.99, 39.65], [28.04, 38.49]]],
  },
  {
    id: 'incense',
    name: 'Incense Route',
    article: 'Incense Route',
    from: bce(700),
    to: 200,
    kind: 'land',
    goods: 'Frankincense and myrrh from southern Arabia to the Mediterranean',
    lines: [[[54.0, 17.1], [47.0, 15.4], [45.33, 15.42], [44.13, 17.49], [39.61, 24.47], [37.92, 26.62], [35.44, 30.33], [34.45, 31.5]]],
  },
  {
    id: 'silk-road',
    name: 'Silk Road',
    article: 'Silk Road',
    from: bce(130),
    to: 1453,
    kind: 'land',
    goods: 'Silk, horses, paper, spices, ideas and religions across Eurasia',
    lines: [
      [[108.94, 34.34], [103.83, 36.06], [94.66, 40.14], [89.19, 42.95], [82.95, 41.72], [75.99, 39.47], [71.8, 40.6], [66.96, 39.65], [64.42, 39.77], [61.84, 37.66], [54.35, 36.17], [48.52, 34.8], [44.4, 33.3], [38.27, 34.55], [36.16, 36.2]],
      // southern branch around the Taklamakan
      [[94.66, 40.14], [88.15, 39.03], [82.69, 37.1], [79.92, 37.11], [75.99, 39.47]],
    ],
  },
  {
    id: 'maritime-silk',
    name: 'Maritime Silk Road',
    article: 'Maritime Silk Road',
    from: bce(200),
    to: 1500,
    kind: 'sea',
    goods: 'Silk, porcelain, spices, pepper, cotton cloth across the Indian Ocean',
    lines: [[[113.26, 23.13], [112.5, 20.5], [110.5, 17.0], [109.5, 12.0], [106.0, 7.5], [103.5, 3.0], [100.5, 3.0], [97.5, 5.5], [92.0, 6.0], [81.5, 5.6], [79.0, 7.6], [75.78, 11.25], [68.0, 15.0], [58.0, 14.0], [51.0, 12.6], [45.03, 12.8], [43.4, 12.6], [41.0, 16.0], [37.5, 21.0], [35.48, 23.9]]],
  },
  {
    id: 'amber',
    name: 'Amber Road',
    article: 'Amber Road',
    from: 1,
    to: 300,
    kind: 'land',
    goods: 'Baltic amber south to the Roman world',
    lines: [[[18.65, 54.35], [18.09, 51.76], [17.04, 51.11], [16.6, 49.2], [16.9, 48.11], [16.08, 47.07], [14.5, 46.05], [13.37, 45.77]]],
  },
  {
    id: 'varangians',
    name: 'Route from the Varangians to the Greeks',
    article: 'Trade route from the Varangians to the Greeks',
    from: 800,
    to: 1200,
    kind: 'river',
    goods: 'Furs, wax, honey, slaves and silver between Scandinavia and Constantinople',
    lines: [[[17.54, 59.33], [19.5, 59.6], [23.5, 59.8], [28.0, 60.0], [30.2, 59.95], [32.3, 60.0], [31.27, 58.52], [32.05, 54.78], [30.52, 50.45], [32.6, 46.6], [31.0, 45.3], [29.5, 42.7], [28.98, 41.01]]],
  },
  {
    id: 'trans-saharan',
    name: 'Trans-Saharan trade',
    article: 'Trans-Saharan trade',
    from: 700,
    to: 1591,
    kind: 'land',
    goods: 'Gold, salt, cloth and enslaved people across the Sahara by camel caravan',
    lines: [
      [[-5.0, 34.03], [-4.25, 31.28], [-4.98, 23.58], [-7.03, 17.29], [-3.0, 16.77]],
      [[-3.0, 16.77], [-0.04, 16.27], [7.99, 16.97], [13.15, 32.89]],
    ],
  },
  {
    id: 'hansa',
    name: 'Hanseatic League',
    article: 'Hanseatic League',
    from: 1250,
    to: 1669,
    kind: 'sea',
    goods: 'Grain, fish, furs, timber, wax and Flemish cloth around the North Sea and Baltic',
    lines: [
      [[-0.1, 51.5], [1.8, 51.4], [3.22, 51.21]],
      [[3.22, 51.21], [6.2, 53.6], [8.5, 53.9], [9.99, 53.55], [10.69, 53.87]],
      [[10.69, 53.87], [13.5, 54.9], [18.29, 57.64], [22.0, 59.3], [24.75, 59.44], [28.0, 59.9], [30.2, 59.95], [31.27, 58.52]],
      [[5.32, 60.39], [5.0, 58.5], [7.5, 57.6], [10.6, 57.75], [11.0, 56.3], [12.6, 55.7], [11.5, 54.6], [10.69, 53.87]],
    ],
  },
  {
    id: 'atlantic-slave-trade',
    name: 'Atlantic slave trade',
    article: 'Atlantic slave trade',
    from: 1526,
    to: 1867,
    kind: 'sea',
    goods: 'About 12.5 million Africans forced aboard ships for the Americas (Trans-Atlantic Slave Trade Database)',
    lines: [
      [[2.08, 6.36], [-5.0, 4.0], [-18.0, 5.0], [-35.0, 9.0], [-55.0, 13.0], [-61.0, 14.5], [-76.8, 17.95]],
      [[13.23, -8.84], [0.0, -10.0], [-20.0, -12.0], [-34.9, -11.5], [-38.5, -12.97]],
      [[-38.5, -12.97], [-38.0, -18.0], [-41.0, -23.0], [-43.17, -22.91]],
    ],
  },
  {
    id: 'manila-galleon',
    name: 'Manila galleons',
    article: 'Manila galleon',
    from: 1565,
    to: 1815,
    kind: 'sea',
    goods: 'Mexican silver west to Manila; Chinese silk and porcelain back east',
    lines: [
      [[-99.9, 16.85], [-115.0, 14.0], [-140.0, 13.0], [-170.0, 13.0], [165.0, 13.3], [144.8, 13.45], [130.0, 13.0], [124.3, 12.6], [121.5, 13.5], [120.98, 14.6]],
      [[120.98, 14.6], [123.0, 17.0], [130.0, 28.0], [142.0, 36.5], [160.0, 39.0], [-175.0, 40.0], [-150.0, 40.0], [-128.0, 38.0], [-120.5, 34.0], [-112.0, 22.5], [-105.0, 19.5], [-99.9, 16.85]],
    ],
  },
  {
    id: 'carreira',
    name: 'Portuguese India route',
    article: 'Portuguese India Armadas',
    from: 1498,
    to: 1650,
    kind: 'sea',
    goods: 'Pepper, cinnamon and cloves from India to Lisbon round the Cape',
    lines: [[[-9.14, 38.71], [-17.0, 28.0], [-24.0, 15.0], [-28.0, 0.0], [-25.0, -20.0], [-5.0, -36.0], [18.47, -35.0], [32.0, -28.0], [40.5, -15.0], [40.74, -15.03], [44.0, -5.0], [55.0, 5.0], [65.0, 12.0], [73.83, 15.5]]],
  },
]

/** 0..1 visibility at t: fades in over the first and out over the last few years of use */
export function routeAlpha(r: TradeRoute, t: number) {
  if (t < r.from || t > r.to) return 0
  const span = r.to - r.from
  const edge = Math.min(25, span * 0.08)
  return Math.min(1, (t - r.from) / edge, (r.to - t) / edge)
}
