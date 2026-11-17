// Moments: short first-person scenes on the ground at a dated event. Each shot is a place to stand
// (longitude, latitude, eye height in metres), a heading and a look, and a caption. The sun is put
// where it stood at that local hour on that date, so dawn is dawn. Captions say only what the
// linked Wikipedia article says; the landmarks and city walls are the atlas's own models; the
// ground and the imagery are today's. Anything acted out beyond that (an ash column) is marked
// `dramatised` and said so on screen.
// Years are astronomical (1 BCE = 0); fractions of a year are days.

export type Shot = {
  at: [number, number]
  eye?: number
  yaw: number
  pitch: number
  /** turn slowly to this heading and look over the shot */
  pan?: { yaw: number; pitch: number }
  /** local solar hour for the sun, when it changes during the scene */
  hour?: number
  text: string
}
export type Moment = {
  id: string
  title: string
  place: string
  t: number
  hour: number
  article: string
  blurb: string
  shots: Shot[]
  /** a dramatised effect: an ash column rising from a point */
  fx?: { kind: 'plume'; at: [number, number]; elev: number; height: number }
  approx?: boolean
}

const d = (y: number, m: number, day: number) => {
  const start = Date.UTC(2001, 0, 1)
  return y + (Date.UTC(2001, m - 1, day) - start) / 864e5 / 365
}
const bce = (y: number) => 1 - y

export const MOMENTS: Moment[] = [
  {
    id: 'giza',
    title: 'The Great Pyramid, newly finished',
    place: 'Giza, Egypt',
    t: bce(2560) + 0.3,
    hour: 7.5,
    article: 'Great Pyramid of Giza',
    blurb: 'Stand on the plateau in the morning as the tallest building on Earth catches the sun.',
    approx: true,
    shots: [
      { at: [31.1415, 29.969], yaw: 305, pitch: 6, pan: { yaw: 325, pitch: 8 }, text: 'About 2560 BCE. Khufu’s pyramid stands 146.6 metres high, the tallest thing people have ever built. It will keep that title for more than 3,700 years.' },
      { at: [31.1362, 29.9776], yaw: 318, pitch: 30, pan: { yaw: 318, pitch: 48 }, text: 'At completion it was cased entirely in white limestone from the Tura quarries across the Nile, with joints only half a millimetre wide. What stands today is the core beneath.' },
      { at: [31.1395, 29.9745], yaw: 290, pitch: 5, pan: { yaw: 240, pitch: 5 }, text: 'Khafre’s and Menkaure’s pyramids will follow on the same plateau within the next few decades.' },
    ],
  },
  {
    id: 'stonehenge',
    title: 'Midsummer sunrise at Stonehenge',
    place: 'Salisbury Plain, England',
    t: bce(2500) + 0.47,
    hour: 3.75,
    article: 'Stonehenge',
    blurb: 'Stand on the axis before dawn on the longest day and watch the sun rise where the builders meant it to.',
    approx: true,
    shots: [
      { at: [-1.8275, 51.1781], yaw: 49.5, pitch: 3, hour: 3.4, pan: { yaw: 49.5, pitch: 6 }, text: 'About 2500 BCE, the longest day of the year. The great sarsen stones were raised in this period, and the whole monument is aligned on the sunrise of the summer solstice.' },
      { at: [-1.8275, 51.1781], yaw: 49.5, pitch: 4, hour: 3.9, pan: { yaw: 52, pitch: 6 }, text: 'Seen from the centre, the sun rises over the north-eastern entrance and the avenue beyond it. On the opposite day of the year, the midwinter sun sets along the same line.' },
      { at: [-1.8262, 51.1789], yaw: 230, pitch: 4, hour: 4.4, pan: { yaw: 120, pitch: 4 }, text: 'Inside the circle. The sarsens come from about 25 km away; the smaller bluestones were brought from Wales.' },
    ],
  },
  {
    id: 'parthenon',
    title: 'The Parthenon is finished',
    place: 'Athens, Greece',
    t: bce(432) + 0.6,
    hour: 16,
    article: 'Parthenon',
    blurb: 'Walk onto the Acropolis in the afternoon light of 432 BCE.',
    shots: [
      { at: [23.7243, 37.9718], eye: 2, yaw: 95, pitch: 6, pan: { yaw: 100, pitch: 8 }, text: '432 BCE. Fifteen years of building end: the Parthenon, temple of Athena, is complete on the Acropolis, begun in 447 under Pericles.' },
      { at: [23.7256, 37.9716], yaw: 80, pitch: 14, pan: { yaw: 120, pitch: 16 }, text: 'Its columns are Doric, its marble from Mount Pentelicus. Inside stood Phidias’s gold-and-ivory statue of Athena.' },
      { at: [23.7272, 37.9709], yaw: 20, pitch: 10, pan: { yaw: 330, pitch: 8 }, text: 'In 1687 a Venetian shell would ignite gunpowder stored inside and blow out the middle of the building. Drag the year forward to see it.' },
    ],
  },
  {
    id: 'colosseum',
    title: 'Opening games at the Colosseum',
    place: 'Rome',
    t: 80.5,
    hour: 10,
    article: 'Colosseum',
    blurb: 'Stand in the arena of the largest amphitheatre ever built, in the year of its inaugural games.',
    approx: true,
    shots: [
      { at: [12.4907, 41.8892], yaw: 45, pitch: 10, pan: { yaw: 60, pitch: 14 }, text: '80 CE. The amphitheatre begun by Vespasian is finished by his son Titus, and inaugural games are held. The outer wall rises about 48 metres.' },
      { at: [12.4922, 41.8902], yaw: 0, pitch: 12, pan: { yaw: 350, pitch: 12 }, text: 'The arena floor. Dio Cassius writes that over 9,000 wild animals were killed in the inaugural games; accounts also describe the arena filled with water for a show of swimming horses and bulls.' },
      { at: [12.4922, 41.8902], yaw: 180, pitch: 8, pan: { yaw: 540, pitch: 8 }, text: 'Earthquakes and stone-robbing will take the south side; the great earthquake of 1349 brings down the outer wall there. Drag the year to see it fall.' },
    ],
  },
  {
    id: 'hagia-sophia',
    title: 'Hagia Sophia is dedicated',
    place: 'Constantinople',
    t: d(537, 12, 27),
    hour: 11,
    article: 'Hagia Sophia',
    blurb: 'Stand before Justinian’s church on the morning of its dedication, 27 December 537.',
    shots: [
      { at: [28.9772, 41.0078], yaw: 70, pitch: 14, pan: { yaw: 85, pitch: 18 }, text: '27 December 537. Justinian’s new church is dedicated, five years after building began. Its dome, 31 metres across, makes it the largest building of its day.' },
      { at: [28.979, 41.0074], yaw: 40, pitch: 22, pan: { yaw: 60, pitch: 30 }, text: 'The dome will fall in an earthquake in 558 and be rebuilt higher. For nearly a thousand years this is the cathedral of the Eastern Roman Empire.' },
    ],
  },
  {
    id: 'constantinople-1453',
    title: 'The last night of Constantinople',
    place: 'The Theodosian Walls',
    t: d(1453, 5, 29),
    hour: 1.5,
    article: 'Fall of Constantinople',
    blurb: 'Stand on the land walls in the dark hours of 29 May 1453 as the final assault begins, then turn to the city at dawn.',
    shots: [
      { at: [28.9292, 41.0195], eye: 12, yaw: 270, pitch: 2, hour: 1.2, pan: { yaw: 250, pitch: 0 }, text: '29 May 1453, shortly after midnight. After a siege of 53 days, Mehmed II launches his final assault on the walls. The Ottoman camp lies beyond them to the west.' },
      { at: [28.9292, 41.0195], eye: 12, yaw: 290, pitch: 0, hour: 3.6, pan: { yaw: 230, pitch: 0 }, text: 'These walls were finished in 413 and had held every attack for a thousand years. Tonight the defenders are too few to man both lines, and the guns have been firing on them for weeks.' },
      { at: [28.9292, 41.0195], eye: 12, yaw: 100, pitch: 2, hour: 5.4, pan: { yaw: 105, pitch: 4 }, text: 'By morning the city has fallen. Hagia Sophia, five kilometres east, will be a mosque by the afternoon. The Byzantine Empire ends; it was a Tuesday.' },
    ],
  },
  {
    id: 'angkor',
    title: 'Equinox sunrise at Angkor Wat',
    place: 'Angkor, Cambodia',
    t: 1150.22,
    hour: 5.9,
    article: 'Angkor Wat',
    blurb: 'Stand on the western causeway at the spring equinox and watch the sun come up over the central tower.',
    approx: true,
    shots: [
      { at: [103.8592, 13.4125], yaw: 90, pitch: 4, hour: 5.8, pan: { yaw: 90, pitch: 7 }, text: 'About 1150, the spring equinox. Angkor Wat was built between 1113 and 1150 under Suryavarman II as a Hindu temple to Vishnu, and probably as his tomb.' },
      { at: [103.8625, 13.4125], yaw: 90, pitch: 10, hour: 6.2, pan: { yaw: 90, pitch: 14 }, text: 'It faces west, unusually for a Khmer temple. Seen from this causeway at the equinoxes, the sun rises directly over the central tower.' },
      { at: [103.866, 13.4125], yaw: 70, pitch: 18, hour: 6.6, pan: { yaw: 110, pitch: 16 }, text: 'The whole site covers 162 hectares inside its moat. In 1178 the city will be sacked by the Chams; the temple later becomes Buddhist, and never falls out of use.' },
    ],
  },
  {
    id: 'taj-mahal',
    title: 'The Taj Mahal, complete',
    place: 'Agra, India',
    t: 1653.5,
    hour: 6.7,
    article: 'Taj Mahal',
    blurb: 'Stand at the great gate at sunrise in the year the whole complex was finished.',
    approx: true,
    shots: [
      { at: [78.0421, 27.1707], eye: 2, yaw: 0, pitch: 8, pan: { yaw: 0, pitch: 11 }, text: '1653. The mausoleum Shah Jahan built for his wife Mumtaz Mahal was finished in 1648; the gardens, gate and outer buildings are complete by 1653.' },
      { at: [78.0421, 27.1728], yaw: 0, pitch: 14, pan: { yaw: 10, pitch: 18 }, text: 'The white marble tomb stands on the bank of the Yamuna. Its dome rises about 73 metres above the garden.' },
    ],
  },
  {
    id: 'pompeii',
    title: 'Vesuvius erupts',
    place: 'The forum of Pompeii',
    t: d(79, 8, 24),
    hour: 13,
    article: 'Eruption of Mount Vesuvius in 79 AD',
    blurb: 'Stand in the forum on the afternoon the mountain explodes, ten kilometres to the north.',
    approx: true,
    fx: { kind: 'plume', at: [14.426, 40.8214], elev: 1281, height: 30000 },
    shots: [
      { at: [14.4849, 40.7492], yaw: 330, pitch: 8, pan: { yaw: 332, pitch: 30 }, text: '79 CE, early afternoon. Vesuvius erupts, throwing a column of hot gas and ash 30 kilometres into the sky. The column shown here is a dramatisation.' },
      { at: [14.4849, 40.7492], yaw: 332, pitch: 20, pan: { yaw: 300, pitch: 10 }, text: 'Pumice and ash begin to fall on Pompeii, downwind to the south-east, until roofs collapse. Herculaneum, upwind, is spared this first fall.' },
      { at: [14.4849, 40.7492], yaw: 330, pitch: 5, pan: { yaw: 30, pitch: 5 }, text: 'When the column collapses, surges of hot gas and ash will sweep down the mountain and end the town. It stays buried until the eighteenth century.' },
    ],
  },
  {
    id: 'eiffel',
    title: 'The Eiffel Tower opens',
    place: 'Champ de Mars, Paris',
    t: d(1889, 3, 31),
    hour: 17.5,
    article: 'Eiffel Tower',
    blurb: 'Stand on the Champ de Mars on the evening of 31 March 1889, below the tallest structure on Earth.',
    shots: [
      { at: [2.2992, 48.8553], yaw: 315, pitch: 22, pan: { yaw: 315, pitch: 40 }, text: '31 March 1889. Gustave Eiffel’s tower is complete for the World’s Fair: about 300 metres of wrought iron, the tallest human-made structure in the world.' },
      { at: [2.2962, 48.8572], yaw: 320, pitch: 55, pan: { yaw: 320, pitch: 70 }, text: 'It will hold that title for 41 years, until the Chrysler Building in 1930. Many Parisians found it ugly; it was meant to stand for twenty years.' },
    ],
  },
  {
    id: 'liberty',
    title: 'Liberty is dedicated',
    place: 'Bedloe’s Island, New York Harbor',
    t: d(1886, 10, 28),
    hour: 14,
    article: 'Statue of Liberty',
    blurb: 'Stand on the island on the afternoon of 28 October 1886.',
    shots: [
      { at: [-74.0458, 40.688], yaw: 35, pitch: 26, pan: { yaw: 35, pitch: 40 }, text: '28 October 1886, afternoon. The statue, a gift from the people of France, is dedicated. From the ground to the torch it stands 93 metres.' },
      { at: [-74.0438, 40.6878], yaw: 330, pitch: 12, pan: { yaw: 60, pitch: 10 }, text: 'Manhattan lies across the water to the north-east. The island will be renamed Liberty Island in 1956.' },
    ],
  },
  {
    id: 'burj',
    title: 'The tallest building in the world',
    place: 'Downtown Dubai',
    t: d(2010, 1, 4),
    hour: 17.6,
    article: 'Burj Khalifa',
    blurb: 'Stand below the Burj Khalifa at dusk on 4 January 2010, the day it opened.',
    shots: [
      { at: [55.279, 25.1945], yaw: 300, pitch: 30, pan: { yaw: 300, pitch: 50 }, text: '4 January 2010. The Burj Khalifa opens: 828 metres, the tallest building and the tallest structure ever built.' },
      { at: [55.2765, 25.1962], yaw: 310, pitch: 60, pan: { yaw: 310, pitch: 78 }, text: 'Its tiered shape steps back as it rises, and its spire reaches higher than any mountain west of the Himalaya is tall.' },
    ],
  },
]
