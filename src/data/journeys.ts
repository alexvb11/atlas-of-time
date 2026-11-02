// Guided journeys and dated movements.
//
// Voyages and marches (`path: true`) are drawn on the globe as a moving marker with a trail
// whenever the current time falls between their first and last stop, tour or not. Tours step
// through their stops: the time slider moves to each date, the camera flies to the place, a caption
// is shown (and read aloud when narration is on), and each stop links to its Wikipedia article.
// Dates are Gregorian except where the source calendar is Julian (1492–1522 voyages, as usually
// cited); BCE dates are astronomical years. `approx: true` marks dates or places that are uncertain.

export type Stop = { t: number; at: [number, number]; title: string; text: string; article?: string; approx?: boolean }
export type Journey = { id: string; name: string; blurb: string; path: boolean; color: string; stops: Stop[] }

/** Fractional year from a calendar date (astronomical year numbering) */
const d = (y: number, m: number, day: number) => {
  const start = Date.UTC(2001, 0, 1)
  const doy = (Date.UTC(2001, m - 1, day) - start) / 864e5
  return y + doy / 365
}
const bce = (y: number) => 1 - y

export const JOURNEYS: Journey[] = [
  {
    id: 'silk-road',
    name: 'The Silk Road',
    blurb: 'Envoys, monks, merchants and travellers across Eurasia, from the Han to the Ottomans.',
    path: false,
    color: '#ffc477',
    stops: [
      { t: bce(138), at: [108.94, 34.34], title: 'Zhang Qian leaves Chang’an', text: 'Emperor Wu of Han sends Zhang Qian west to find allies against the Xiongnu. His reports open Chinese contact with Central Asia.', article: 'Zhang Qian', approx: true },
      { t: bce(104), at: [71.8, 40.6], title: 'War of the Heavenly Horses', text: 'Han armies march on Dayuan in the Fergana Valley, famous for its horses; by 101 BCE the Han have the horses they wanted.', article: 'War of the Heavenly Horses' },
      { t: 366, at: [94.81, 40.04], title: 'The Mogao Caves are begun', text: 'Buddhist monks start carving cave shrines near the oasis of Dunhuang, a gateway to the desert routes.', article: 'Mogao Caves' },
      { t: 629, at: [108.94, 34.34], title: 'Xuanzang sets out for India', text: 'The monk Xuanzang travels overland to India to study Buddhism, returning to Chang’an in 645 with hundreds of texts.', article: 'Xuanzang' },
      { t: 751, at: [72.3, 42.5], title: 'Battle of Talas', text: 'Abbasid and Tang armies meet in Central Asia; the Tang are defeated.', article: 'Battle of Talas' },
      { t: 1271, at: [12.34, 45.44], title: 'Marco Polo leaves Venice', text: 'With his father and uncle, the young Marco Polo sets out for the court of Kublai Khan, which they reach about four years later.', article: 'Marco Polo' },
      { t: d(1325, 6, 14), at: [-5.8, 35.77], title: 'Ibn Battuta leaves Tangier', text: 'Setting out on pilgrimage at 21, he travels for nearly thirty years, as far as India and China.', article: 'Ibn Battuta' },
      { t: d(1453, 5, 29), at: [28.98, 41.01], title: 'The Ottomans take Constantinople', text: 'Mehmed II captures the city at the western end of the overland routes; the Byzantine Empire ends.', article: 'Fall of Constantinople' },
    ],
  },
  {
    id: 'mongols',
    name: 'The Mongol conquests',
    blurb: 'From a kurultai on the steppe to the largest contiguous land empire in history.',
    path: false,
    color: '#ff9a7a',
    stops: [
      { t: 1206, at: [109.0, 48.5], title: 'Temüjin becomes Genghis Khan', text: 'A great assembly of the Mongol tribes proclaims him universal ruler.', article: 'Genghis Khan', approx: true },
      { t: 1215, at: [116.4, 39.9], title: 'Zhongdu falls', text: 'Mongol forces take the Jin capital, on the site of today’s Beijing.', article: 'Battle of Zhongdu' },
      { t: 1220, at: [66.96, 39.65], title: 'Samarkand falls', text: 'The campaign against the Khwarazmian Empire destroys its great cities.', article: 'Mongol invasion of the Khwarazmian Empire' },
      { t: d(1223, 5, 31), at: [37.6, 47.6], title: 'Battle of the Kalka River', text: 'A Mongol raiding force defeats the Rus’ princes and the Cumans.', article: 'Battle of the Kalka River' },
      { t: 1240, at: [30.52, 50.45], title: 'Kyiv is sacked', text: 'Batu Khan’s army destroys the city; Kievan Rus’ comes under Mongol overlordship.', article: 'Siege of Kiev (1240)' },
      { t: d(1241, 4, 11), at: [20.9, 47.95], title: 'Battle of Mohi', text: 'The Mongols rout the Hungarian army; they withdraw from Europe the next year.', article: 'Battle of Mohi' },
      { t: 1258, at: [44.36, 33.31], title: 'Baghdad is sacked', text: 'Hulagu’s army takes the Abbasid capital and kills the caliph.', article: 'Siege of Baghdad (1258)' },
      { t: d(1260, 9, 3), at: [35.35, 32.55], title: 'Battle of Ain Jalut', text: 'The Mamluks of Egypt defeat a Mongol army in Palestine, halting the advance south-west.', article: 'Battle of Ain Jalut' },
      { t: 1271, at: [116.39, 39.91], title: 'Kublai Khan proclaims the Yuan', text: 'Genghis Khan’s grandson founds a dynasty to rule China.', article: 'Yuan dynasty' },
      { t: 1279, at: [113.08, 22.25], title: 'Battle of Yamen', text: 'The last Song resistance is destroyed at sea; all of China is under Mongol rule.', article: 'Battle of Yamen' },
      { t: 1281, at: [130.3, 33.6], title: 'Second invasion of Japan', text: 'A great invasion fleet is wrecked by a typhoon off Kyushu.', article: 'Battle of Kōan' },
    ],
  },
  {
    id: 'ww2',
    name: 'The Second World War',
    blurb: 'Eleven turning points between 1939 and 1945.',
    path: false,
    color: '#7fd8ff',
    stops: [
      { t: d(1939, 9, 1), at: [21.01, 52.23], title: 'Germany invades Poland', text: 'Britain and France declare war on Germany two days later.', article: 'Invasion of Poland' },
      { t: d(1940, 5, 10), at: [4.5, 50.6], title: 'The Battle of France', text: 'Germany attacks the Low Countries and France, which signs an armistice on 22 June.', article: 'Battle of France' },
      { t: d(1940, 7, 10), at: [-0.12, 51.5], title: 'The Battle of Britain', text: 'The Royal Air Force defends Britain against the Luftwaffe through the summer and autumn.', article: 'Battle of Britain' },
      { t: d(1941, 6, 22), at: [24.0, 52.0], title: 'Operation Barbarossa', text: 'Germany and its allies invade the Soviet Union along a front of almost 3,000 km.', article: 'Operation Barbarossa' },
      { t: d(1941, 12, 7), at: [-157.95, 21.36], title: 'Attack on Pearl Harbor', text: 'Japan strikes the US Pacific Fleet; the United States enters the war.', article: 'Attack on Pearl Harbor' },
      { t: d(1942, 6, 4), at: [-177.37, 28.2], title: 'Battle of Midway', text: 'The US Navy sinks four Japanese aircraft carriers.', article: 'Battle of Midway' },
      { t: d(1942, 8, 23), at: [44.52, 48.7], title: 'Battle of Stalingrad', text: 'Months of fighting end with the surrender of the German Sixth Army in February 1943.', article: 'Battle of Stalingrad' },
      { t: d(1942, 10, 23), at: [28.95, 30.83], title: 'Second Battle of El Alamein', text: 'Allied forces in Egypt defeat the Axis army under Rommel.', article: 'Second Battle of El Alamein' },
      { t: d(1944, 6, 6), at: [-0.6, 49.35], title: 'D-Day', text: 'Allied forces land on the beaches of Normandy.', article: 'Normandy landings' },
      { t: d(1945, 5, 8), at: [13.4, 52.52], title: 'Germany surrenders', text: 'After the fall of Berlin, Germany’s unconditional surrender takes effect: Victory in Europe.', article: 'German Instrument of Surrender' },
      { t: d(1945, 8, 6), at: [132.45, 34.39], title: 'Hiroshima', text: 'The United States drops an atomic bomb on Hiroshima, and on Nagasaki three days later.', article: 'Atomic bombings of Hiroshima and Nagasaki' },
      { t: d(1945, 9, 2), at: [139.75, 35.35], title: 'Japan surrenders', text: 'The surrender is signed aboard USS Missouri in Tokyo Bay, ending the war.', article: 'Surrender of Japan' },
    ],
  },
  // ---------- dated movements, drawn as animated paths ----------
  {
    id: 'hannibal',
    name: 'Hannibal’s march on Rome',
    blurb: 'From New Carthage over the Pyrenees and the Alps into Italy, 218–216 BCE.',
    path: true,
    color: '#ffd36e',
    stops: [
      { t: bce(218) + 0.3, at: [-0.98, 37.6], title: 'Hannibal leaves New Carthage', text: 'He sets out in spring with an army of infantry, cavalry and war elephants.', article: 'Hannibal', approx: true },
      { t: bce(218) + 0.55, at: [2.5, 42.4], title: 'Across the Pyrenees', text: 'The army crosses into Gaul in the summer.', article: 'Second Punic War', approx: true },
      { t: bce(218) + 0.7, at: [4.7, 43.9], title: 'Crossing the Rhône', text: 'Elephants are ferried across the river on rafts.', article: 'Battle of the Rhône Crossing', approx: true },
      { t: bce(218) + 0.82, at: [6.9, 45.2], title: 'Over the Alps', text: 'The crossing takes about two weeks in autumn; which pass he used is still debated.', article: "Hannibal's crossing of the Alps", approx: true },
      { t: bce(218) + 0.97, at: [9.6, 45.05], title: 'Battle of the Trebia', text: 'Hannibal defeats a Roman army in the Po valley in December.', article: 'Battle of the Trebia', approx: true },
      { t: bce(217) + 0.47, at: [12.1, 43.18], title: 'Lake Trasimene', text: 'He ambushes a Roman army on the lake shore.', article: 'Battle of Lake Trasimene', approx: true },
      { t: bce(216) + 0.58, at: [16.13, 41.31], title: 'Cannae', text: 'Hannibal encircles and destroys a much larger Roman army.', article: 'Battle of Cannae' },
    ],
  },
  {
    id: 'columbus',
    name: 'Columbus’s first voyage',
    blurb: 'Palos to the Bahamas, Cuba and Hispaniola and back, 1492–1493 (Julian dates).',
    path: true,
    color: '#7fd8ff',
    stops: [
      { t: d(1492, 8, 3), at: [-6.89, 37.23], title: 'Leaving Palos', text: 'Three ships sail: the Santa María, the Pinta and the Niña.', article: 'Voyages of Christopher Columbus' },
      { t: d(1492, 9, 6), at: [-17.11, 28.09], title: 'Leaving the Canary Islands', text: 'After repairs, the fleet sails west from La Gomera into the open Atlantic.', article: 'La Gomera' },
      { t: d(1492, 10, 12), at: [-74.5, 24.05], title: 'Landfall in the Bahamas', text: 'Columbus reaches an island its Lucayan people called Guanahani; exactly which island is debated.', article: 'Guanahani' },
      { t: d(1492, 10, 28), at: [-75.7, 21.1], title: 'Cuba', text: 'He reaches the north-east coast of Cuba.', article: 'Cuba', approx: true },
      { t: d(1492, 12, 6), at: [-73.4, 19.83], title: 'Hispaniola', text: 'He reaches the island he names La Isla Española.', article: 'Hispaniola' },
      { t: d(1492, 12, 25), at: [-72.1, 19.78], title: 'The Santa María runs aground', text: 'From its timbers the crew builds La Navidad, the first Spanish settlement in the Americas.', article: 'La Navidad' },
      { t: d(1493, 3, 15), at: [-6.89, 37.23], title: 'Return to Palos', text: 'The Niña sails back into Palos.', article: 'Voyages of Christopher Columbus' },
    ],
  },
  {
    id: 'magellan',
    name: 'Magellan–Elcano circumnavigation',
    blurb: 'The first voyage around the world, 1519–1522 (Julian dates).',
    path: true,
    color: '#a7f3c2',
    stops: [
      { t: d(1519, 9, 20), at: [-6.35, 36.78], title: 'Leaving Sanlúcar de Barrameda', text: 'Five ships and about 270 men sail under Ferdinand Magellan.', article: 'Magellan expedition' },
      { t: d(1519, 12, 13), at: [-43.17, -22.9], title: 'Rio de Janeiro', text: 'The fleet takes on supplies in the bay.', article: 'Magellan expedition' },
      { t: d(1520, 3, 31), at: [-67.72, -49.3], title: 'Wintering at San Julián', text: 'A mutiny is put down at Puerto San Julián in Patagonia.', article: 'Puerto San Julián' },
      { t: d(1520, 10, 21), at: [-68.4, -52.4], title: 'Into the strait', text: 'The fleet enters the passage now called the Strait of Magellan.', article: 'Strait of Magellan' },
      { t: d(1520, 11, 28), at: [-74.6, -52.7], title: 'Into the Pacific', text: 'Three ships emerge into the ocean Magellan names the Pacific.', article: 'Strait of Magellan' },
      { t: d(1521, 3, 6), at: [144.8, 13.4], title: 'Guam', text: 'After more than three months across the Pacific, starving crews reach the Marianas.', article: 'Guam' },
      { t: d(1521, 4, 27), at: [123.97, 10.3], title: 'Magellan killed at Mactan', text: 'Magellan dies in battle with Lapulapu’s forces in the Philippines.', article: 'Battle of Mactan' },
      { t: d(1521, 11, 8), at: [127.4, 0.68], title: 'The Spice Islands', text: 'The surviving ships reach Tidore in the Moluccas and load cloves.', article: 'Tidore' },
      { t: d(1522, 5, 19), at: [18.47, -34.36], title: 'Round the Cape of Good Hope', text: 'The Victoria, under Juan Sebastián Elcano, heads home across the Indian Ocean and round Africa.', article: 'Juan Sebastián Elcano', approx: true },
      { t: d(1522, 9, 6), at: [-6.35, 36.78], title: 'Home, around the world', text: 'The Victoria returns to Sanlúcar with 18 of the men who had set out.', article: 'Victoria (ship)' },
    ],
  },
  {
    id: 'lewis-clark',
    name: 'Lewis and Clark',
    blurb: 'Up the Missouri, over the Rockies and down the Columbia to the Pacific, 1804–1806.',
    path: true,
    color: '#ffc477',
    stops: [
      { t: d(1804, 5, 14), at: [-90.12, 38.8], title: 'Leaving Camp Dubois', text: 'The Corps of Discovery starts up the Missouri River.', article: 'Lewis and Clark Expedition' },
      { t: d(1804, 11, 2), at: [-101.27, 47.3], title: 'Fort Mandan', text: 'They winter near the Mandan and Hidatsa villages, where Sacagawea joins them.', article: 'Fort Mandan' },
      { t: d(1805, 6, 13), at: [-111.3, 47.53], title: 'The Great Falls of the Missouri', text: 'Lewis reaches the falls; carrying the boats around them takes almost a month.', article: 'Great Falls (Missouri River)' },
      { t: d(1805, 8, 12), at: [-113.45, 44.97], title: 'Lemhi Pass', text: 'Lewis crosses the Continental Divide.', article: 'Lemhi Pass' },
      { t: d(1805, 11, 7), at: [-123.6, 46.25], title: '"Ocean in view!"', text: 'Clark writes the famous line as the Columbia River estuary opens out before them.', article: 'Lewis and Clark Expedition' },
      { t: d(1805, 12, 8), at: [-123.88, 46.13], title: 'Fort Clatsop', text: 'They winter on the Pacific coast.', article: 'Fort Clatsop' },
      { t: d(1806, 9, 23), at: [-90.19, 38.63], title: 'Back in St. Louis', text: 'The expedition returns after more than two years.', article: 'Lewis and Clark Expedition' },
    ],
  },
  {
    id: 'napoleon-1812',
    name: 'Napoleon in Russia, 1812',
    blurb: 'The Grande Armée’s advance to Moscow and its retreat.',
    path: true,
    color: '#ff9a7a',
    stops: [
      { t: d(1812, 6, 24), at: [23.9, 54.9], title: 'Across the Neman', text: 'The Grande Armée crosses into the Russian Empire at Kovno.', article: 'French invasion of Russia' },
      { t: d(1812, 6, 28), at: [25.28, 54.69], title: 'Vilnius', text: 'Napoleon enters the city.', article: 'French invasion of Russia' },
      { t: d(1812, 8, 16), at: [32.04, 54.78], title: 'Battle of Smolensk', text: 'The city burns as the Russian army withdraws east.', article: 'Battle of Smolensk (1812)' },
      { t: d(1812, 9, 7), at: [35.82, 55.52], title: 'Battle of Borodino', text: 'The bloodiest single day of the Napoleonic Wars.', article: 'Battle of Borodino' },
      { t: d(1812, 9, 14), at: [37.62, 55.75], title: 'Moscow', text: 'Napoleon enters a largely abandoned city; fires break out that night.', article: 'Fire of Moscow (1812)' },
      { t: d(1812, 10, 19), at: [37.62, 55.75], title: 'The retreat begins', text: 'With no offer of peace, the army leaves Moscow.', article: 'French invasion of Russia' },
      { t: d(1812, 10, 24), at: [36.47, 55.01], title: 'Maloyaroslavets', text: 'The battle forces the retreat back along the devastated road it came by.', article: 'Battle of Maloyaroslavets' },
      { t: d(1812, 11, 26), at: [28.5, 54.33], title: 'The Berezina', text: 'The remnants cross the river on improvised bridges under attack.', article: 'Battle of Berezina' },
      { t: d(1812, 12, 14), at: [23.9, 54.9], title: 'Back across the Neman', text: 'Only a small fraction of the army that invaded returns.', article: 'French invasion of Russia' },
    ],
  },
  {
    id: 'alexander',
    name: 'Alexander the Great, 334–323 BCE',
    blurb: 'From Macedon across the Persian Empire to the Indus, in eleven years.',
    path: true,
    color: '#ffb36b',
    stops: [
      { t: bce(334) + 0.25, at: [22.52, 40.75], title: 'Leaving Pella', text: 'Alexander crosses into Asia in the spring of 334 BCE with about 40,000 men.', article: 'Wars of Alexander the Great', approx: true },
      { t: bce(334) + 0.4, at: [27.27, 40.2], title: 'The Granicus', text: 'His first victory over the Persian satraps, in May 334 BCE.', article: 'Battle of the Granicus' },
      { t: bce(333) + 0.85, at: [36.2, 36.84], title: 'Issus', text: 'He defeats Darius III, who flees, in November 333 BCE.', article: 'Battle of Issus' },
      { t: bce(332) + 0.5, at: [35.2, 33.27], title: 'Siege of Tyre', text: 'Seven months to take the island city, which he joins to the mainland with a causeway.', article: 'Siege of Tyre (332 BC)' },
      { t: bce(331) + 0.1, at: [29.92, 31.2], title: 'Egypt', text: 'Welcomed as a liberator, he founds Alexandria.', article: 'Alexandria', approx: true },
      { t: bce(331) + 0.75, at: [43.5, 36.6], title: 'Gaugamela', text: 'The decisive defeat of Darius, on 1 October 331 BCE.', article: 'Battle of Gaugamela' },
      { t: bce(331) + 0.82, at: [44.42, 32.54], title: 'Babylon', text: 'The city opens its gates to him.', article: 'Babylon' },
      { t: bce(330) + 0.05, at: [52.89, 29.93], title: 'Persepolis', text: 'The Persian ceremonial capital is taken and later burned.', article: 'Persepolis', approx: true },
      { t: bce(329) + 0.4, at: [66.9, 36.76], title: 'Bactria', text: 'Years of hard campaigning in Bactria and Sogdiana.', article: 'Bactria', approx: true },
      { t: bce(329) + 0.6, at: [66.96, 39.65], title: 'Maracanda (Samarkand)', text: 'The northern limit of his empire.', article: 'Samarkand', approx: true },
      { t: bce(326) + 0.4, at: [73.5, 32.9], title: 'The Hydaspes', text: 'He defeats King Porus in 326 BCE; soon after, his army refuses to go further.', article: 'Battle of the Hydaspes' },
      { t: bce(325) + 0.7, at: [63.0, 26.0], title: 'The Gedrosian desert', text: 'A disastrous march home through the desert costs many lives.', article: 'Gedrosia', approx: true },
      { t: bce(323) + 0.45, at: [44.42, 32.54], title: 'Death in Babylon', text: 'Alexander dies in June 323 BCE, aged 32.', article: 'Death of Alexander the Great' },
    ],
  },
  {
    id: 'marco-polo',
    name: 'Marco Polo, 1271–1295',
    blurb: 'Venice to the court of Kublai Khan and home by sea, 24 years later.',
    path: true,
    color: '#f6c26b',
    stops: [
      { t: 1271.3, at: [12.34, 45.44], title: 'Leaving Venice', text: 'Marco, about seventeen, sets out with his father Niccolò and uncle Maffeo to return to Kublai Khan.', article: 'Marco Polo', approx: true },
      { t: 1271.6, at: [35.07, 32.93], title: 'Acre', text: 'They sail to Acre in the crusader Levant, then ride on.', article: 'Marco Polo', approx: true },
      { t: 1272.4, at: [56.46, 27.1], title: 'Hormuz', text: 'They plan to sail for China, but the ships are not seaworthy, so they go overland on the Silk Road.', article: 'Marco Polo', approx: true },
      { t: 1273.2, at: [66.9, 36.76], title: 'Balkh', text: 'Across Persia into Central Asia.', article: 'Balkh', approx: true },
      { t: 1273.9, at: [75.99, 39.47], title: 'Kashgar', text: 'Over the Pamirs to the oasis cities of the Tarim Basin.', article: 'Kashgar', approx: true },
      { t: 1274.5, at: [94.66, 40.14], title: 'Dunhuang', text: 'Past the Taklamakan and the Gobi.', article: 'Dunhuang', approx: true },
      { t: 1275.3, at: [116.18, 42.36], title: 'Shangdu', text: 'They reach Kublai’s summer palace (Xanadu). The exact date is unknown: scholars place it between 1271 and 1275.', article: 'Shangdu', approx: true },
      { t: 1276, at: [116.4, 39.9], title: 'Khanbaliq', text: 'Years at the Yuan court; Marco describes travels across China on the Khan’s business.', article: 'Khanbaliq', approx: true },
      { t: 1292.1, at: [118.59, 24.91], title: 'Leaving Zaitun', text: 'Escorting the princess Kököchin to Persia, they sail from Quanzhou with fourteen junks (1291 or 1292).', article: 'Kököchin', approx: true },
      { t: 1292.5, at: [97.15, 5.18], title: 'Sumatra', text: 'The fleet waits months in Sumatra for the monsoon.', article: 'Marco Polo', approx: true },
      { t: 1293.8, at: [56.46, 27.1], title: 'Hormuz again', text: 'After about two years at sea, few of the six hundred passengers survive; the Polos leave the wedding party.', article: 'Marco Polo', approx: true },
      { t: 1295.0, at: [39.72, 41.0], title: 'Trebizond', text: 'Overland to the Black Sea, then on to Constantinople.', article: 'Marco Polo', approx: true },
      { t: 1295.6, at: [12.34, 45.44], title: 'Home to Venice', text: 'Back after 24 years. A prisoner of Genoa soon after, he dictates his travels to Rustichello da Pisa.', article: 'The Travels of Marco Polo', approx: true },
    ],
  },
  {
    id: 'ibn-battuta',
    name: 'Ibn Battuta, 1325–1354',
    blurb: 'Three decades of travel from Tangier: Mecca, India, China and the Mali Empire.',
    path: true,
    color: '#9be7c4',
    stops: [
      { t: d(1325, 6, 14), at: [-5.8, 35.77], title: 'Leaving Tangier', text: 'At 21 he sets off on pilgrimage to Mecca. He will not see Morocco again for 24 years.', article: 'Ibn Battuta' },
      { t: 1326.2, at: [29.92, 31.2], title: 'Alexandria', text: 'He reaches the Mamluk port in early spring, then travels to Cairo.', article: 'Ibn Battuta', approx: true },
      { t: 1326.6, at: [36.29, 33.51], title: 'Damascus', text: 'He joins the pilgrim caravan south.', article: 'Ibn Battuta', approx: true },
      { t: 1326.85, at: [39.83, 21.42], title: 'Mecca', text: 'His first hajj, completed in November 1326.', article: 'Ibn Battuta', approx: true },
      { t: 1327.3, at: [51.67, 32.65], title: 'Isfahan', text: 'A six-month detour through Iraq and Iran.', article: 'Ibn Battuta', approx: true },
      { t: 1327.7, at: [39.83, 21.42], title: 'Mecca again', text: 'He stays a year or more (the account says three; the chronology is disputed).', article: 'Ibn Battuta', approx: true },
      { t: 1330.9, at: [45.34, 2.04], title: 'Mogadishu', text: 'Down the Red Sea and the Swahili coast; the dates are uncertain (1330 or 1332).', article: 'Ibn Battuta', approx: true },
      { t: 1331.1, at: [39.5, -8.96], title: 'Kilwa', text: 'He praises the Kilwa Sultanate and its ruler.', article: 'Kilwa Sultanate', approx: true },
      { t: 1332.9, at: [28.98, 41.01], title: 'Constantinople', text: 'Through Anatolia and the Golden Horde; he meets Emperor Andronikos III (late 1332 or 1334).', article: 'Ibn Battuta', approx: true },
      { t: 1333.3, at: [64.42, 39.77], title: 'Bukhara', text: 'Across Central Asia toward India.', article: 'Ibn Battuta', approx: true },
      { t: d(1333, 9, 12), at: [70.0, 28.5], title: 'The Indus', text: 'His party reaches the Indus on 12 September 1333.', article: 'Ibn Battuta' },
      { t: 1334.1, at: [77.21, 28.64], title: 'Delhi', text: 'He serves Sultan Muhammad bin Tughluq as a judge for years, between favour and suspicion.', article: 'Muhammad bin Tughluq', approx: true },
      { t: 1342.0, at: [75.78, 11.25], title: 'Calicut', text: 'Sent as envoy to China in 1341, he is robbed on the way and loses his ships at Calicut.', article: 'Ibn Battuta', approx: true },
      { t: 1343.5, at: [73.51, 4.18], title: 'The Maldives', text: 'Nine months as chief judge in Malé.', article: 'Ibn Battuta', approx: true },
      { t: 1344.3, at: [80.5, 6.81], title: 'Sri Lanka', text: 'He climbs Adam’s Peak (Sri Pada).', article: 'Ibn Battuta', approx: true },
      { t: 1345.2, at: [91.8, 22.35], title: 'Chittagong', text: 'In Bengal he travels to meet the Sufi Shah Jalal.', article: 'Shah Jalal', approx: true },
      { t: 1345.5, at: [97.15, 5.18], title: 'Samudera Pasai', text: 'A Muslim sultanate on Sumatra.', article: 'Samudera Pasai Sultanate', approx: true },
      { t: 1345.9, at: [118.59, 24.91], title: 'Quanzhou', text: 'He reaches Yuan China at the port Muslims called Zaitun.', article: 'Quanzhou', approx: true },
      { t: 1348.4, at: [36.29, 33.51], title: 'Damascus', text: 'Back in Syria as the Black Death spreads; he learns his father died fifteen years before.', article: 'Black Death', approx: true },
      { t: 1349.8, at: [-4.98, 34.03], title: 'Fez', text: 'Home in Morocco after 24 years; his mother had died of the plague.', article: 'Ibn Battuta', approx: true },
      { t: d(1352, 2, 15), at: [-4.25, 31.28], title: 'Sijilmasa', text: 'He leaves with a caravan across the Sahara in February 1352.', article: 'Sijilmasa', approx: true },
      { t: 1352.25, at: [-4.98, 23.58], title: 'Taghaza', text: 'The salt mines, where even the buildings are made of salt slabs.', article: 'Taghaza', approx: true },
      { t: 1352.35, at: [-7.03, 17.29], title: 'Oualata', text: 'The southern end of the desert crossing, then part of the Mali Empire.', article: 'Oualata', approx: true },
      { t: 1353.1, at: [-3.0, 16.77], title: 'Timbuktu', text: 'After months at the court of Mansa Suleyman, he travels down the Niger.', article: 'Mali Empire', approx: true },
      { t: 1353.4, at: [-0.04, 16.27], title: 'Gao', text: 'A month in Gao, then north with a caravan.', article: 'Gao', approx: true },
      { t: 1354.05, at: [-4.98, 34.03], title: 'Home for good', text: 'Back in Morocco early in 1354, he dictates his Rihla to the scholar Ibn Juzayy.', article: 'Ibn Battuta', approx: true },
    ],
  },
]

/** Where a path journey is at time t: position between stops (linear in time), or null outside it */
export function journeyAt(j: Journey, t: number): { at: [number, number]; leg: number; f: number } | null {
  const s = j.stops
  if (t < s[0].t || t > s[s.length - 1].t) return null
  for (let i = 0; i < s.length - 1; i++) {
    if (t <= s[i + 1].t) {
      const f = (t - s[i].t) / Math.max(1e-9, s[i + 1].t - s[i].t)
      return { at: s[i].at, leg: i, f }
    }
  }
  return { at: s[s.length - 1].at, leg: s.length - 2, f: 1 }
}
