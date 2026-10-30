// Precise, dated borders for 1886 to today from CShapes 2.0 (Schvitz, Girardin, Rüegger, Weidmann,
// Cederman & Gleditsch 2022, ETH Zürich; CC BY-NC-SA 4.0). Every territorial change is coded to the
// day; the atlas switches borders on that day instead of at the nearest of a dozen snapshots.
//
// Geometry: simplified only below 200 m (mapshaper, interval=200) and stored as one TopoJSON, so a
// border shared by two states, or unchanged across decades, is stored once.
//
// Names (CShapes uses one modern name for a unit's whole history, e.g. "Kenya" from 1888):
//   - Independent pieces, by the Gleditsch–Ward state lists that CShapes is coded on, take the
//     state's name at that date (Russian Empire → Soviet Russia → Soviet Union → Russia, Persia →
//     Iran, Siam → Thailand…), changing on the day of the rename.
//   - Dependent pieces take their period name from a hand-checked table ("East Africa Protectorate",
//     "French Sudan", "Tajik SSR"), with the ruling power, changing on the date of each change.
//   - Units that were never independent keep CShapes' own name, already a period name ("Natal").
// CShapes codes de facto control (e.g. Crimea from March 2014); the UI says so.
//
// Output: public/data/history/cshapes.topo.json, and the change dates merged into index.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { feature } from 'topojson-client'
import { annotate } from './lib/annotate-history.mjs'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/cshapes')
const out = path.join(root, 'public/data/history')
await fs.mkdir(cache, { recursive: true })

async function download(name, url) {
  const file = path.join(cache, name)
  try {
    await fs.access(file)
  } catch {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
    await fs.writeFile(file, Buffer.from(await r.arrayBuffer()))
  }
  return file
}
const src = await download('CShapes-2.0.geojson', 'https://icr.ethz.ch/data/cshapes/CShapes-2.0.geojson')
const gwFiles = [
  await download('iisystem.dat', 'http://ksgleditsch.com/data/iisystem.dat'),
  await download('microstatessystem.dat', 'http://ksgleditsch.com/data/microstatessystem.dat'),
]

const START = 1886
// the GW lists end at 31 Dec 2017 and CShapes at 31 Dec 2019; both mean "still existing"
const OPEN = 2017.9

/** fractional astronomical year from y, m, d */
const ymd = (y, m, d) => y + (m - 1) / 12 + (d - 1) / 365.25
const fromGW = (s) => {
  const [d, m, y] = s.split(':').map(Number)
  return ymd(y, m, d)
}

// ---------- independent-state intervals (Gleditsch & Ward) ----------
const gw = new Map()
for (const file of gwFiles)
  for (const line of (await fs.readFile(file, 'latin1')).split(/\r?\n/)) {
    const p = line.split('\t')
    if (p.length < 5) continue
    const code = Number(p[0])
    const list = gw.get(code) ?? []
    list.push([fromGW(p[3]), fromGW(p[4]) >= OPEN ? Infinity : fromGW(p[4])])
    gw.set(code, list)
  }
const independentAt = (code, t) => (gw.get(code) ?? []).some(([a, b]) => t >= a - 0.003 && t < b)

// ---------- names of independent states over time: [from, name] ----------
// Dates are those of the renaming or change of state (Gregorian).
const STATE_NAMES = {
  'Russia (Soviet Union)': [[-Infinity, 'Russian Empire'], [1917.85, 'Soviet Russia'], [1922.99, 'Soviet Union'], [1991.98, 'Russia']],
  'Turkey (Ottoman Empire)': [[-Infinity, 'Ottoman Empire'], [1922.84, 'Turkey']],
  'Iran (Persia)': [[-Infinity, 'Persia'], [1935.22, 'Iran']],
  'Germany (Prussia)': [[-Infinity, 'German Empire'], [1918.86, 'Germany']],
  'German Federal Republic': [[-Infinity, 'West Germany'], [1990.75, 'Germany']],
  'German Democratic Republic': [[-Infinity, 'East Germany']],
  'Italy/Sardinia': [[-Infinity, 'Italy']],
  Rumania: [[-Infinity, 'Romania']],
  Thailand: [[-Infinity, 'Siam'], [1939.47, 'Thailand'], [1945.7, 'Siam'], [1949.37, 'Thailand']],
  China: [[-Infinity, 'Qing China'], [1912.1, 'Republic of China'], [1949.75, "People's Republic of China"]],
  Korea: [[-Infinity, 'Joseon'], [1897.78, 'Korean Empire']],
  'Korea, Republic of': [[-Infinity, 'South Korea']],
  "Korea, People's Republic of": [[-Infinity, 'North Korea']],
  Egypt: [[-Infinity, 'Kingdom of Egypt'], [1953.46, 'Egypt'], [1958.15, 'United Arab Republic'], [1971.7, 'Egypt']],
  Syria: [[-Infinity, 'Syria']],
  Yugoslavia: [[-Infinity, 'Kingdom of Serbs, Croats and Slovenes'], [1929.76, 'Yugoslavia'], [2003.1, 'Serbia and Montenegro'], [2006.43, 'Serbia']],
  'Burkina Faso (Upper Volta)': [[-Infinity, 'Upper Volta'], [1984.6, 'Burkina Faso']],
  Benin: [[-Infinity, 'Dahomey'], [1975.92, 'Benin']],
  'Congo, Democratic Republic of (Zaire)': [[-Infinity, 'Congo-Léopoldville'], [1964.6, 'Democratic Republic of the Congo'], [1971.82, 'Zaire'], [1997.38, 'Democratic Republic of the Congo']],
  Congo: [[-Infinity, 'Republic of the Congo']],
  'Central African Republic': [[-Infinity, 'Central African Republic'], [1976.92, 'Central African Empire'], [1979.72, 'Central African Republic']],
  'Tanzania (Tanganyika)': [[-Infinity, 'Tanganyika'], [1964.32, 'Tanzania']],
  'Zimbabwe (Rhodesia)': [[-Infinity, 'Zimbabwe']],
  'Swaziland (Eswatini)': [[-Infinity, 'Swaziland'], [2018.3, 'Eswatini']],
  'Madagascar (Malagasy)': [[-Infinity, 'Madagascar']],
  'Myanmar (Burma)': [[-Infinity, 'Burma'], [1989.47, 'Myanmar']],
  'Sri Lanka (Ceylon)': [[-Infinity, 'Ceylon'], [1972.39, 'Sri Lanka']],
  'Cambodia (Kampuchea)': [[-Infinity, 'Cambodia']],
  'Vietnam, Democratic Republic of': [[-Infinity, 'North Vietnam'], [1976.5, 'Vietnam']],
  'Vietnam, Republic of': [[-Infinity, 'South Vietnam']],
  'Vietnam (Annam/Cochin China/Tonkin)': [[-Infinity, 'Vietnam (Nguyễn dynasty)']],
  'Yemen (Arab Republic of Yemen)': [[-Infinity, 'North Yemen'], [1990.39, 'Yemen']],
  "Yemen, People's Republic of": [[-Infinity, 'South Yemen']],
  Malaysia: [[-Infinity, 'Malaya'], [1963.7, 'Malaysia']],
  'Belarus (Byelorussia)': [[-Infinity, 'Belarus']],
  'Macedonia (FYROM/North Macedonia)': [[-Infinity, 'Macedonia'], [2019.12, 'North Macedonia']],
  'Kyrgyz Republic': [[-Infinity, 'Kyrgyzstan']],
  "Cote D'Ivoire": [[-Infinity, "Côte d'Ivoire"]],
  Surinam: [[-Infinity, 'Suriname']],
  'British Somaliland (Somaliland Republic)': [[-Infinity, 'State of Somaliland']],
  'Czech Republic': [[-Infinity, 'Czech Republic']],
  Libya: [[-Infinity, 'Libya']],
  Japan: [[-Infinity, 'Empire of Japan'], [1947.34, 'Japan']],
  'United Kingdom': [[-Infinity, 'United Kingdom']],
}
// never-independent units whose CShapes name needs tidying
const DEPENDENCY_NAMES = {
  'French Guyana': 'French Guiana',
  Reunion: 'Réunion',
  'British Somaliland (Somaliland Republic)': 'British Somaliland',
  'West Irian (Dutch New Guinea)': 'Dutch New Guinea',
  'New Guinea (German New Guinea) (Kaiser Wilhelmsland)': 'German New Guinea',
  Selangore: 'Selangor',
  Bokhara: 'Emirate of Bukhara',
  Khiva: 'Khanate of Khiva',
}
const renamesOf = (cs) => STATE_NAMES[cs] ?? [[-Infinity, cs]]

// CShapes moves a border on the date of the treaty that settled it, so between the collapse of
// Austria-Hungary and the peace treaties a piece can cover land another state already held.
// Those pieces are named for what they are. Key: "<CShapes name>|<start, 2 decimals>".
const PIECE_NAMES = {
  'Austria|1918.84': [[1918.839, 'Former Austrian crown lands (borders until the Treaty of Saint-Germain)', null]],
  'Hungary|1918.84': [[1918.839, 'Hungary (pre-war borders, until the Treaty of Trianon)', null]],
  'Hungary|1918.92': [[1918.917, 'Hungary (pre-war borders, until the Treaty of Trianon)', null]],
  'Hungary|1919.69': [[1919.689, 'Hungary (borders until the Treaty of Trianon)', null]],
}

// Names of dependent periods, with the ruling power: [from, name, ruler]. Dates are changes of
// status or name. Used for every piece that is not an independent state on the GW lists.
const DEPENDENT_NAMES = {
  // Americas and Atlantic
  Bahamas: [[-Infinity, 'Colony of the Bahamas', 'United Kingdom']],
  Cuba: [[-Infinity, 'Captaincy General of Cuba', 'Spain'], [1898.95, 'US military government of Cuba', 'United States']],
  Haiti: [[-Infinity, 'Haiti under US occupation', 'United States']],
  Jamaica: [[-Infinity, 'Colony of Jamaica', 'United Kingdom']],
  'Trinidad and Tobago': [[-Infinity, 'Colony of Trinidad', 'United Kingdom'], [1889, 'Colony of Trinidad and Tobago', 'United Kingdom']],
  Barbados: [[-Infinity, 'Colony of Barbados', 'United Kingdom']],
  Belize: [[-Infinity, 'British Honduras', 'United Kingdom'], [1973.42, 'Belize (British colony)', 'United Kingdom']],
  Guyana: [[-Infinity, 'British Guiana', 'United Kingdom']],
  Surinam: [[-Infinity, 'Surinam (Dutch colony)', 'Netherlands'], [1954.96, 'Suriname (country of the Kingdom of the Netherlands)', 'Netherlands']],
  // Europe
  'German Federal Republic': [[-Infinity, 'Allied-occupied Germany (western zones)', 'United States, United Kingdom and France']],
  'German Democratic Republic': [[-Infinity, 'Allied-occupied Germany (Soviet zone)', 'Soviet Union']],
  Austria: [[-Infinity, 'Republic of German-Austria', null], [1945.3, 'Allied-occupied Austria', 'United States, United Kingdom, France and Soviet Union']],
  Malta: [[-Infinity, 'Crown Colony of Malta', 'United Kingdom']],
  Serbia: [[-Infinity, 'Serbia under Central Powers occupation', 'Austria-Hungary, Germany and Bulgaria']],
  Montenegro: [[-Infinity, 'Montenegro under Austro-Hungarian occupation', 'Austria-Hungary']],
  Cyprus: [[-Infinity, 'British Cyprus', 'United Kingdom']],
  Iceland: [[-Infinity, 'Iceland (Danish dependency)', 'Denmark'], [1918.92, 'Kingdom of Iceland (in union with Denmark)', 'Denmark']],
  Estonia: [[-Infinity, 'Estonian SSR', 'Soviet Union']],
  Latvia: [[-Infinity, 'Latvian SSR', 'Soviet Union']],
  Lithuania: [[-Infinity, 'Lithuanian SSR', 'Soviet Union']],
  Ukraine: [[-Infinity, 'Ukrainian SSR', 'Soviet Union']],
  'Belarus (Byelorussia)': [[-Infinity, 'Byelorussian SSR', 'Soviet Union']],
  Moldova: [[-Infinity, 'Moldavian SSR', 'Soviet Union']],
  Armenia: [[-Infinity, 'Armenian SSR', 'Soviet Union']],
  Georgia: [[-Infinity, 'Georgian SSR', 'Soviet Union']],
  Azerbaijan: [[-Infinity, 'Azerbaijan SSR', 'Soviet Union']],
  Kazakhstan: [[-Infinity, 'Kazakh SSR', 'Soviet Union']],
  'Kyrgyz Republic': [[-Infinity, 'Kirghiz SSR', 'Soviet Union']],
  Tajikistan: [[-Infinity, 'Tajik SSR', 'Soviet Union']],
  Turkmenistan: [[-Infinity, 'Turkmen SSR', 'Soviet Union']],
  Uzbekistan: [[-Infinity, 'Uzbek SSR', 'Soviet Union']],
  // Africa
  'Congo, Democratic Republic of (Zaire)': [[-Infinity, 'Congo Free State', 'Leopold II of Belgium'], [1908.88, 'Belgian Congo', 'Belgium']],
  Kenya: [[-Infinity, 'Imperial British East Africa Company territory', 'United Kingdom'], [1895.5, 'East Africa Protectorate', 'United Kingdom'], [1920.56, 'Kenya Colony and Protectorate', 'United Kingdom']],
  Uganda: [[-Infinity, 'Uganda Protectorate', 'United Kingdom']],
  'Tanzania (Tanganyika)': [[-Infinity, 'German East Africa', 'German Empire'], [1920.56, 'Tanganyika Territory', 'United Kingdom']],
  Zanzibar: [[-Infinity, 'Sultanate of Zanzibar', null], [1890.5, 'Sultanate of Zanzibar (British protectorate)', 'United Kingdom']],
  Djibouti: [[-Infinity, 'Obock (French Somali Coast)', 'France'], [1896.5, 'French Somaliland', 'France'], [1967.5, 'French Territory of the Afars and the Issas', 'France']],
  Eritrea: [[-Infinity, 'Italian Eritrea', 'Italy'], [1941.3, 'Eritrea under British administration', 'United Kingdom'], [1952.7, 'Eritrea (federated with Ethiopia)', 'Ethiopia']],
  Angola: [[-Infinity, 'Portuguese Angola', 'Portugal']],
  Mozambique: [[-Infinity, 'Portuguese Mozambique', 'Portugal']],
  'Zimbabwe (Rhodesia)': [[-Infinity, 'British South Africa Company territory', 'United Kingdom'], [1898, 'Southern Rhodesia', 'United Kingdom'], [1965.86, 'Rhodesia (unrecognised)', null]],
  Zambia: [[-Infinity, 'Northern Rhodesia', 'United Kingdom']],
  Malawi: [[-Infinity, 'British Central Africa Protectorate', 'United Kingdom'], [1907.5, 'Nyasaland', 'United Kingdom']],
  Namibia: [[-Infinity, 'German South West Africa', 'German Empire'], [1915.5, 'South West Africa', 'South Africa']],
  Botswana: [[-Infinity, 'Bechuanaland Protectorate', 'United Kingdom']],
  Lesotho: [[-Infinity, 'Basutoland', 'United Kingdom']],
  'Swaziland (Eswatini)': [[-Infinity, 'Swaziland (protectorate of the South African Republic)', 'South African Republic'], [1902.4, 'Swaziland (British protectorate)', 'United Kingdom']],
  'Madagascar (Malagasy)': [[-Infinity, 'Kingdom of Madagascar (French protectorate)', 'France'], [1897.1, 'French Madagascar', 'France']],
  'Cape Verde': [[-Infinity, 'Portuguese Cape Verde', 'Portugal']],
  'Guinea-Bissau': [[-Infinity, 'Portuguese Guinea', 'Portugal']],
  'Equatorial Guinea': [[-Infinity, 'Spanish Guinea', 'Spain']],
  Gambia: [[-Infinity, 'Gambia Colony and Protectorate', 'United Kingdom']],
  Senegal: [[-Infinity, 'French Senegal', 'France'], [1959.3, 'Senegal (Mali Federation)', null]],
  Mali: [[-Infinity, 'French Sudan', 'France'], [1904.5, 'Upper Senegal and Niger', 'France'], [1920.9, 'French Sudan', 'France'], [1959.3, 'Sudanese Republic (Mali Federation)', null]],
  Mauritania: [[-Infinity, 'French Mauritania', 'France']],
  Niger: [[-Infinity, 'Military Territory of Niger', 'France'], [1922.8, 'Colony of Niger', 'France']],
  Guinea: [[-Infinity, 'French Guinea', 'France']],
  'Burkina Faso (Upper Volta)': [[-Infinity, 'French Upper Volta', 'France']],
  "Cote D'Ivoire": [[-Infinity, 'French Ivory Coast', 'France']],
  Benin: [[-Infinity, 'French Dahomey', 'France']],
  Togo: [[-Infinity, 'French Togoland', 'France']],
  Cameroon: [[-Infinity, 'French Cameroons', 'France']],
  Nigeria: [[-Infinity, 'Colony and Protectorate of Nigeria', 'United Kingdom']],
  Ghana: [[-Infinity, 'Gold Coast', 'United Kingdom']],
  'Sierra Leone': [[-Infinity, 'Colony and Protectorate of Sierra Leone', 'United Kingdom']],
  Gabon: [[-Infinity, 'French Gabon', 'France']],
  Congo: [[-Infinity, 'French Congo', 'France'], [1910.1, 'Middle Congo (French Equatorial Africa)', 'France']],
  'Central African Republic': [[-Infinity, 'Ubangi-Shari', 'France']],
  Chad: [[-Infinity, 'French Chad', 'France']],
  Comoros: [[-Infinity, 'Comoros (French overseas territory)', 'France']],
  Mauritius: [[-Infinity, 'British Mauritius', 'United Kingdom']],
  Morocco: [[-Infinity, 'Sultanate of Morocco', null], [1912.25, 'French protectorate in Morocco', 'France']],
  Algeria: [[-Infinity, 'French Algeria', 'France']],
  Tunisia: [[-Infinity, 'French protectorate of Tunisia', 'France']],
  Libya: [[-Infinity, 'Italian Libya', 'Italy'], [1943.1, 'Libya under Allied administration', 'United Kingdom and France']],
  Sudan: [[-Infinity, 'Anglo-Egyptian Sudan', 'United Kingdom and Egypt']],
  Egypt: [[-Infinity, 'Khedivate of Egypt (under British occupation)', 'Ottoman Empire'], [1914.96, 'Sultanate of Egypt (British protectorate)', 'United Kingdom']],
  // Asia and Oceania
  Iraq: [[-Infinity, 'British-occupied Mesopotamia', 'United Kingdom'], [1920.6, 'Mandatory Iraq', 'United Kingdom']],
  Syria: [[-Infinity, 'French Mandate for Syria', 'France']],
  Lebanon: [[-Infinity, 'Greater Lebanon (French Mandate)', 'France']],
  Jordan: [[-Infinity, 'Emirate of Transjordan', 'United Kingdom']],
  Qatar: [[-Infinity, 'Qatar (British protectorate)', 'United Kingdom']],
  'United Arab Emirates': [[-Infinity, 'Trucial States', 'United Kingdom']],
  Afghanistan: [[-Infinity, 'Emirate of Afghanistan (British protectorate)', 'United Kingdom']],
  Taiwan: [[-Infinity, 'Taiwan under Japanese rule', 'Empire of Japan']],
  Korea: [[-Infinity, 'Korea under Japanese rule', 'Empire of Japan']],
  "Korea, People's Republic of": [[-Infinity, 'Soviet Civil Administration in Korea', 'Soviet Union']],
  'Korea, Republic of': [[-Infinity, 'US Army Military Government in Korea', 'United States']],
  India: [[-Infinity, 'British Raj', 'United Kingdom']],
  Bhutan: [[-Infinity, 'Bhutan', null]],
  'Myanmar (Burma)': [[-Infinity, 'British Burma', 'United Kingdom']],
  'Sri Lanka (Ceylon)': [[-Infinity, 'British Ceylon', 'United Kingdom']],
  'Cambodia (Kampuchea)': [[-Infinity, 'French protectorate of Cambodia', 'France']],
  Laos: [[-Infinity, 'Laos under Siam', 'Siam'], [1893.8, 'French Laos', 'France']],
  'Vietnam (Annam/Cochin China/Tonkin)': [[-Infinity, 'French Indochina (Annam, Tonkin, Cochinchina)', 'France']],
  Malaysia: [[-Infinity, 'Malayan Union', 'United Kingdom'], [1948.08, 'Federation of Malaya', 'United Kingdom']],
  Singapore: [[-Infinity, 'Colony of Singapore', 'United Kingdom']],
  Brunei: [[-Infinity, 'Brunei (British protectorate)', 'United Kingdom']],
  Philippines: [[-Infinity, 'Captaincy General of the Philippines', 'Spain'], [1898.95, 'Philippines under US rule', 'United States']],
  Indonesia: [[-Infinity, 'Dutch East Indies', 'Netherlands']],
  'East Timor': [[-Infinity, 'Portuguese Timor', 'Portugal']],
  'Papua New Guinea': [[-Infinity, 'Territory of Papua and New Guinea', 'Australia']],
  'New Zealand': [[-Infinity, 'Colony of New Zealand', 'United Kingdom']],
  Fiji: [[-Infinity, 'Colony of Fiji', 'United Kingdom']],
  Maldives: [[-Infinity, 'Maldives (British protectorate)', 'United Kingdom']],
  // units that never became states under these codes
  Alaska: [[-Infinity, 'District of Alaska', 'United States'], [1912.6, 'Territory of Alaska', 'United States']],
  Hawaii: [[-Infinity, 'Hawaii (annexed by the United States)', 'United States'], [1900.45, 'Territory of Hawaii', 'United States']],
  'Puerto Rico': [[-Infinity, 'Puerto Rico (Spanish colony)', 'Spain'], [1898.6, 'Puerto Rico (US territory)', 'United States']],
  Newfoundland: [[-Infinity, 'Colony of Newfoundland', 'United Kingdom'], [1907.7, 'Dominion of Newfoundland', 'United Kingdom'], [1934.1, 'Newfoundland (Commission of Government)', 'United Kingdom']],
  Guadeloupe: [[-Infinity, 'Guadeloupe (French colony)', 'France'], [1946.2, 'Guadeloupe (French overseas department)', 'France']],
  Martinique: [[-Infinity, 'Martinique (French colony)', 'France'], [1946.2, 'Martinique (French overseas department)', 'France']],
  'French Guyana': [[-Infinity, 'French Guiana (French colony)', 'France'], [1946.2, 'French Guiana (French overseas department)', 'France']],
  Reunion: [[-Infinity, 'Réunion (French colony)', 'France'], [1946.2, 'Réunion (French overseas department)', 'France']],
  Danzig: [[-Infinity, 'Free City of Danzig', null]],
  'Spanish West Africa': [[-Infinity, 'Spanish Sahara (Río de Oro)', 'Spain'], [1946.55, 'Spanish West Africa', 'Spain']],
  Palestine: [[-Infinity, 'Mandatory Palestine', 'United Kingdom']],
  'Sabah (North Borneo)': [[-Infinity, 'North Borneo', 'United Kingdom']],
  Sarawak: [[-Infinity, 'Raj of Sarawak (British protectorate)', 'United Kingdom'], [1946.5, 'Crown Colony of Sarawak', 'United Kingdom']],
  'West Irian (Dutch New Guinea)': [[-Infinity, 'Netherlands New Guinea', 'Netherlands'], [1962.75, 'West New Guinea (UN administration)', 'United Nations'], [1963.33, 'West Irian (Indonesian administration)', 'Indonesia']],
  Papua: [[-Infinity, 'British New Guinea', 'United Kingdom'], [1906.7, 'Territory of Papua', 'Australia']],
  'New Guinea (German New Guinea) (Kaiser Wilhelmsland)': [[-Infinity, 'German New Guinea', 'German Empire'], [1914.7, 'Territory of New Guinea', 'Australia']],
  'French Polynesia': [[-Infinity, 'French Establishments in Oceania', 'France'], [1957.5, 'French Polynesia', 'France']],
  Bosnia: [[-Infinity, 'Bosnia (under Austro-Hungarian administration)', 'Austria-Hungary']],
  Herzegovina: [[-Infinity, 'Herzegovina (under Austro-Hungarian administration)', 'Austria-Hungary']],
  Lagos: [[-Infinity, 'Colony of Lagos', 'United Kingdom']],
  Gaza: [[-Infinity, 'Gaza Strip (Egyptian administration)', 'Egypt']],
  'West Bank': [[-Infinity, 'West Bank (annexed by Jordan)', 'Jordan']],
  'Southern Sakhalin Island': [[-Infinity, 'Karafuto', 'Empire of Japan']],
  'Kashmir (North, Azad)': [[-Infinity, 'Azad Kashmir', 'Pakistan']],
  'Solomon Islands': [[-Infinity, 'British Solomon Islands', 'United Kingdom']],
}

// ---------- geometry ----------
const topoFile = path.join(cache, 'cshapes.topo.json')
// through this Node binary, not the .bin shim: works without node on PATH, and on Windows
await run(process.execPath, [path.join(root, 'node_modules/mapshaper/bin/mapshaper'),
  '-i', src,
  '-filter-fields', 'cntry_name,gwcode,gwsyear,gwsmonth,gwsday,gweyear,gwemonth,gweday',
  '-simplify', 'interval=200', 'keep-shapes',
  '-o', topoFile, 'format=topojson', 'quantization=1000000', 'force',
])
const topo = JSON.parse(await fs.readFile(topoFile, 'utf8'))
const layer = Object.keys(topo.objects)[0]
const geoms = topo.objects[layer].geometries

const report = []
const keys = new Set()
for (const g of geoms) {
  const p = g.properties
  const from = Math.max(START, ymd(p.gwsyear, p.gwsmonth, p.gwsday))
  const toRaw = ymd(p.gweyear, p.gwemonth, p.gweday)
  const to = p.gweyear >= 2019 && p.gwemonth === 12 ? null : toRaw
  const f = annotate({ type: 'FeatureCollection', features: [feature(topo, g)] }).features[0]
  const { _b, _a, _l } = f.properties
  // name segments over the piece's lifetime: [[from, name, ruler|null], ...], split where the unit
  // becomes (or stops being) an independent state
  const cuts = [from, ...(gw.get(p.gwcode) ?? []).flatMap(([a, b]) => [a, b]).filter((x) => Number.isFinite(x) && x > from && (to === null || x < to))].sort((a, b) => a - b)
  const names = []
  let how = 'cshapes'
  const piece = PIECE_NAMES[`${p.cntry_name}|${from.toFixed(2)}`]
  if (piece) {
    names.push(...piece)
    how = 'piece'
    cuts.length = 0
  }
  for (let k = 0; k < cuts.length; k++) {
    const a = cuts[k]
    const b = cuts[k + 1] ?? to ?? Infinity
    if (independentAt(p.gwcode, a + 0.003)) {
      how = how === 'cshapes' ? 'state' : how
      for (const [x, n] of renamesOf(p.cntry_name)) if (x < b && (renamesOf(p.cntry_name).find(([y]) => y > x)?.[0] ?? Infinity) > a) names.push([Math.max(x, a), n, null])
    } else {
      const segs = DEPENDENT_NAMES[p.cntry_name]
      if (segs) {
        how = 'dependency table'
        for (let m = 0; m < segs.length; m++) if (segs[m][0] < b && (segs[m + 1]?.[0] ?? Infinity) > a) names.push([Math.max(segs[m][0], a), segs[m][1], segs[m][2]])
      } else if (gw.has(p.gwcode)) {
        how = 'fallback'
        names.push([a, `${p.cntry_name} (dependent territory)`, null])
      } else names.push([a, DEPENDENCY_NAMES[p.cntry_name] ?? p.cntry_name, null])
    }
  }
  g.properties = { n: names.map(([a, n, r]) => [Number(a.toFixed(3)), n, r]), f: Number(from.toFixed(3)), e: to === null ? null : Number(to.toFixed(3)), b: _b, a: _a, l: _l }
  keys.add(g.properties.f)
  for (const [a] of g.properties.n) keys.add(a)
  if (to !== null) keys.add(g.properties.e)
  report.push({ cshapes: p.cntry_name, from: from.toFixed(2), to: to === null ? 'today' : to.toFixed(2), names: names.map(([a, n, r]) => `${a.toFixed(2)} ${n}${r ? ` [${r}]` : ''}`).join(' → '), how })
}
await fs.writeFile(path.join(out, 'cshapes.topo.json'), JSON.stringify(topo))

const index = JSON.parse(await fs.readFile(path.join(out, 'index.json'), 'utf8'))
index.cshapes = {
  url: 'cshapes.topo.json',
  from: START,
  source: 'CShapes 2.0 (Schvitz et al. 2022, ETH Zürich), CC BY-NC-SA 4.0; independence dates from Gleditsch & Ward',
  keys: [...keys].filter((k) => k >= START).sort((a, b) => a - b),
}
// historical-basemaps snapshots from 1886 on are superseded: drop them from the index and the site
for (const s of index.snapshots.filter((s) => s.year >= START)) await fs.rm(path.join(out, `${s.year}.json`), { force: true })
index.snapshots = index.snapshots.filter((s) => s.year < START)
await fs.writeFile(path.join(out, 'index.json'), JSON.stringify(index))
await fs.writeFile(path.join(root, 'scripts/reports/cshapes-names.json'), JSON.stringify(report, null, 1))
const size = (await fs.stat(path.join(out, 'cshapes.topo.json'))).size
console.log(`cshapes: ${geoms.length} pieces, ${index.cshapes.keys.length} change dates, ${(size / 1024).toFixed(0)} KB; names: ${['state', 'dependency table', 'piece', 'cshapes', 'fallback'].map((h) => `${report.filter((r) => r.how === h).length} ${h}`).join(', ')}`)
