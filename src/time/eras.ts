// Global context per period: the HUD strip, the big readout caption and slider labels.
// Geological boundaries follow the ICS International Chronostratigraphic Chart (v2023/09).
// Human-era boundaries are conventional and approximate; captions keep to well-established facts.
import { PRESENT, fromYearsAgo } from './scale'

const Ma = (m: number) => fromYearsAgo(m * 1e6)
const ka = (k: number) => fromYearsAgo(k * 1e3)

export type Era = {
  from: number
  to: number
  name: string
  /** one line on what is happening globally */
  caption: string
  powers?: string
  /** dominant life / climate, for the Geography tab in deep time */
  life?: string
  climate?: string
}

// Geological periods (deep time). Sorted by `from`.
export const PERIODS: Era[] = [
  { from: Ma(750), to: Ma(720), name: 'Tonian', caption: 'The supercontinent Rodinia is breaking apart; life is microbial and algal.', life: 'Microbial mats, early algae and single-celled eukaryotes', climate: 'Cooling towards global glaciation' },
  { from: Ma(720), to: Ma(635), name: 'Cryogenian', caption: '"Snowball Earth": ice sheets may have reached the tropics during two great glaciations.', life: 'Microbes and algae; possibly the first sponges', climate: 'Extreme glaciations (Sturtian, Marinoan)' },
  { from: Ma(635), to: Ma(538.8), name: 'Ediacaran', caption: 'The first large, complex multicellular organisms appear in the oceans.', life: 'Soft-bodied Ediacaran biota on the sea floor', climate: 'Warming after the Snowball glaciations' },
  { from: Ma(538.8), to: Ma(485.4), name: 'Cambrian', caption: 'The Cambrian explosion: most major animal groups appear in the fossil record. Gondwana dominates the south.', life: 'Trilobites, early arthropods and the first chordates; land is bare', climate: 'Warm greenhouse, high sea levels' },
  { from: Ma(485.4), to: Ma(443.8), name: 'Ordovician', caption: 'Marine life diversifies; the first plants creep onto land. Ends in a major mass extinction.', life: 'Reef builders, nautiloids, early land plants (spores)', climate: 'Warm, ending in a short ice age' },
  { from: Ma(443.8), to: Ma(419.2), name: 'Silurian', caption: 'Vascular plants and jawed fish appear; coral reefs spread.', life: 'Jawed fish, sea scorpions, first vascular plants', climate: 'Warm and stable' },
  { from: Ma(419.2), to: Ma(358.9), name: 'Devonian', caption: 'The age of fishes. The first forests and the first four-limbed vertebrates.', life: 'Armoured fish, first trees (Archaeopteris), early tetrapods', climate: 'Warm; a late-Devonian extinction crisis in the seas' },
  { from: Ma(358.9), to: Ma(298.9), name: 'Carboniferous', caption: 'Vast swamp forests lay down the world\'s coal beds; Pangaea begins to assemble.', life: 'Coal-swamp forests of lycopsids, giant insects, first reptiles', climate: 'Humid tropics; ice sheets over southern Gondwana' },
  { from: Ma(298.9), to: Ma(251.9), name: 'Permian', caption: 'Pangaea is assembled. The period ends in the largest mass extinction known.', life: 'Synapsids (ancestors of mammals), conifers, seed ferns', climate: 'Increasingly arid continental interior' },
  { from: Ma(251.9), to: Ma(201.4), name: 'Triassic', caption: 'Life recovers on Pangaea; the first dinosaurs and mammals appear.', life: 'Early dinosaurs, pterosaurs, first mammals, ichthyosaurs', climate: 'Hot and dry, with monsoons' },
  { from: Ma(201.4), to: Ma(145), name: 'Jurassic', caption: 'Pangaea splits; the Atlantic begins to open. Giant sauropods roam.', life: 'Sauropods, theropods, first birds (Archaeopteryx)', climate: 'Warm and humid, no polar ice' },
  { from: Ma(145), to: Ma(66), name: 'Cretaceous', caption: 'Flowering plants spread; the continents approach their modern layout. Ends with the Chicxulub impact.', life: 'Tyrannosaurs, flowering plants, early modern birds', climate: 'Very warm greenhouse, high sea levels' },
  { from: Ma(66), to: Ma(23.03), name: 'Paleogene', caption: 'Mammals radiate after the dinosaurs. India collides with Asia, raising the Himalaya.', life: 'Early primates, whales, grasses appear', climate: 'Hot early on, cooling as Antarctica freezes' },
  { from: Ma(23.03), to: Ma(2.58), name: 'Neogene', caption: 'Grasslands spread; hominins split from the chimpanzee lineage in Africa.', life: 'Grazing mammals, apes, early hominins', climate: 'Cooling and drying' },
  { from: Ma(2.58), to: ka(11.7), name: 'Pleistocene', caption: 'Repeated ice ages. Homo erectus and later Homo sapiens spread out of Africa.', life: 'Mammoths, megafauna, several human species', climate: 'Glacial cycles roughly every 100,000 years' },
  { from: ka(11.7), to: PRESENT + 1, name: 'Holocene', caption: 'The warm interglacial in which farming, cities and writing appear.', life: 'Modern ecosystems shaped increasingly by humans', climate: 'Warm and comparatively stable' },
]

// Human-history context (shown when the time is inside recorded history or late prehistory).
export const AGES: Era[] = [
  { from: ka(300), to: ka(70), name: 'Middle Stone Age', caption: 'Homo sapiens appears in Africa (earliest fossils c. 300,000 years ago at Jebel Irhoud).', powers: 'No states; small foraging bands' },
  { from: ka(70), to: ka(26), name: 'Out of Africa', caption: 'Modern humans spread across Eurasia and reach Australia; Neanderthals disappear c. 40,000 years ago.', powers: 'No states; small foraging bands' },
  { from: ka(26), to: ka(19), name: 'Last Glacial Maximum', caption: 'Ice sheets cover northern North America and Europe; sea level is about 120 m lower than today.', powers: 'No states; small foraging bands' },
  { from: ka(19), to: ka(11.7), name: 'Late Glacial', caption: 'Ice retreats; people cross Beringia into the Americas.', powers: 'No states; foragers on every inhabited continent' },
  { from: ka(11.7), to: -3999, name: 'Neolithic', caption: 'Farming begins in the Fertile Crescent, China, New Guinea and the Americas; the first villages and towns.', powers: 'Villages and chiefdoms; no states yet' },
  { from: -3999, to: -2999, name: 'Late Neolithic', caption: 'Cities grow in Mesopotamia; writing is invented in Sumer and Egypt near the end of this period.', powers: 'Uruk and the first Sumerian city-states' },
  { from: -2999, to: -1199, name: 'Bronze Age', caption: 'States and empires in Mesopotamia, Egypt, the Indus and China; long-distance trade in tin and copper.', powers: 'Egypt, Akkad, Babylon, Hittites, Shang China' },
  { from: -1199, to: -799, name: 'Early Iron Age', caption: 'The Late Bronze Age collapse is followed by new kingdoms; iron working spreads.', powers: 'Assyria, Zhou China, Urartu, Phoenician cities' },
  { from: -799, to: -335, name: 'Classical Antiquity', caption: 'Greek city-states, the Persian Achaemenid Empire and the philosophies of Greece, India and China.', powers: 'Achaemenid Persia, Greek poleis, Zhou states' },
  { from: -335, to: -26, name: 'Hellenistic Age', caption: 'Alexander\'s conquests spread Greek culture to India; Rome rises; China is unified under the Qin and Han.', powers: 'Seleucids, Ptolemies, Rome, Han China, Maurya' },
  { from: -26, to: 476, name: 'Roman Empire', caption: 'Rome and Han China are linked by the Silk Road at opposite ends of Eurasia.', powers: 'Roman Empire, Parthia / Sasanian Persia, Han China, Kushan' },
  { from: 476, to: 1000, name: 'Early Middle Ages', caption: 'The Western Roman Empire falls; the Byzantine and Islamic worlds flourish; Tang China.', powers: 'Byzantium, the Caliphates, Tang China, Frankish kingdoms' },
  { from: 1000, to: 1300, name: 'High Middle Ages', caption: 'Crusades, the Song dynasty\'s commercial boom, and the Mongol conquests across Eurasia.', powers: 'Song China, Mongol Empire, Holy Roman Empire, Seljuks' },
  { from: 1300, to: 1450, name: 'Late Middle Ages', caption: 'The Black Death kills perhaps a third of Europe; the Ming dynasty sends Zheng He\'s fleets.', powers: 'Ming China, Ottomans, Mali, Timurids' },
  { from: 1450, to: 1648, name: 'Age of Exploration', caption: 'European voyages connect the hemispheres; the Columbian exchange transforms diets and ecosystems.', powers: 'Spain, Portugal, Ottomans, Ming China, Mughals' },
  { from: 1648, to: 1760, name: 'Early Modern', caption: 'Global trading empires, the Scientific Revolution and the Atlantic slave trade.', powers: 'Qing China, Mughals, Ottomans, Britain, France' },
  { from: 1760, to: 1914, name: 'Industrial Age', caption: 'Steam, railways and factories; revolutions in America and France; European empires expand.', powers: 'British Empire, France, Russia, Qing China, USA' },
  { from: 1914, to: 1945, name: 'World Wars', caption: 'Two world wars and the Great Depression reshape the political map.', powers: 'Britain, USA, USSR, Germany, Japan' },
  { from: 1945, to: 1991, name: 'Cold War', caption: 'Decolonisation creates dozens of new states; the USA and USSR compete for influence.', powers: 'USA, USSR, China' },
  { from: 1991, to: PRESENT + 1, name: 'Information Age', caption: 'A connected world of nearly 200 sovereign states.', powers: 'USA, China, EU' },
]

// Short labels drawn on the slider track. Positioned by time.
export const SLIDER_LABELS: { t: number; label: string; major?: boolean }[] = [
  { t: Ma(720), label: 'Rodinia breaks up' },
  { t: Ma(538.8), label: 'Cambrian', major: true },
  { t: Ma(335), label: 'Pangaea forms', major: true },
  { t: Ma(201.4), label: 'Jurassic' },
  { t: Ma(145), label: 'Cretaceous' },
  { t: Ma(66), label: 'Dinosaurs end', major: true },
  { t: Ma(2.58), label: 'Ice Ages', major: true },
  { t: ka(300), label: 'Homo sapiens' },
  { t: ka(21), label: 'Glacial max' },
  { t: ka(11.7), label: 'Farming' },
  { t: -2999, label: 'Bronze Age', major: true },
  { t: -799, label: 'Classical' },
  { t: -26, label: 'Roman Empire', major: true },
  { t: 476, label: 'Middle Ages' },
  { t: 1206, label: 'Mongols' },
  { t: 1492, label: 'Exploration', major: true },
  { t: 1760, label: 'Industrial' },
  { t: 1914, label: 'World Wars', major: true },
  { t: 1991, label: 'Today' },
]

// Snap points for the slider release, sorted. Era starts plus a few iconic dates.
export const MILESTONES: number[] = [
  ...PERIODS.map((p) => p.from),
  ...AGES.map((a) => a.from),
  Ma(335), Ma(175), ka(21), -752, -43, 1206, 1492, 1789, 1914, 1939, 1945, 1991, PRESENT,
].sort((a, b) => a - b)

function find(list: Era[], t: number): Era | undefined {
  let lo = 0
  let hi = list.length - 1
  let ans: Era | undefined
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (list[m].from <= t) {
      ans = list[m]
      lo = m + 1
    } else hi = m - 1
  }
  return ans && t < ans.to ? ans : undefined
}

export const periodAt = (t: number) => find(PERIODS, t)
export const ageAt = (t: number) => find(AGES, t)

/** The most relevant global context line for time t */
export function contextAt(t: number): Era {
  const age = ageAt(t)
  if (age) return age
  return periodAt(t) ?? PERIODS[0]
}

// Supercontinent / landmass names by time (for clicks in deep time)
export function supercontinentAt(t: number): { name: string; note: string } {
  const m = (PRESENT - t) / 1e6
  if (m > 720) return { name: 'Rodinia', note: 'a supercontinent that assembled about 1.1 billion years ago and was breaking apart' }
  if (m > 600) return { name: 'Rodinia fragments', note: 'pieces of the broken supercontinent Rodinia, drifting apart' }
  if (m > 335) return { name: 'Gondwana and its neighbours', note: 'Gondwana (assembled by c. 550 Ma) with Laurentia, Baltica and Siberia as separate continents' }
  if (m > 175) return { name: 'Pangaea', note: 'the supercontinent that joined nearly all land from about 335 to 175 million years ago' }
  if (m > 100) return { name: 'Laurasia and Gondwana', note: 'the two halves of Pangaea, separating as the Atlantic and Indian oceans open' }
  return { name: 'the modern continents', note: 'continents close to their present arrangement' }
}

// World population (Our World in Data / HYDE 3.2, rounded). Before 10,000 BCE: estimates only.
export const WORLD_POP: [number, number][] = [
  [ka(300), 1e4], [ka(70), 3e5], [ka(20), 1e6],
  [-9999, 4.5e6], [-7999, 7.3e6], [-5999, 1.33e7], [-3999, 2.89e7], [-2999, 4.46e7], [-1999, 7.27e7], [-999, 1.11e8],
  [1, 2.32e8], [1000, 3.23e8], [1500, 5.03e8], [1700, 5.95e8], [1800, 9.83e8], [1850, 1.28e9], [1900, 1.63e9],
  [1925, 1.98e9], [1950, 2.49e9], [1975, 4.07e9], [2000, 6.17e9], [2023, 8.09e9], [PRESENT, 8.2e9],
]

export function worldPopAt(t: number): { value: number; estimated: boolean } | null {
  if (t < WORLD_POP[0][0]) return null
  for (let i = 0; i < WORLD_POP.length - 1; i++) {
    const [t0, v0] = WORLD_POP[i]
    const [t1, v1] = WORLD_POP[i + 1]
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0)
      return { value: Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * f), estimated: t < 1950 }
    }
  }
  return { value: WORLD_POP[WORLD_POP.length - 1][1], estimated: false }
}
