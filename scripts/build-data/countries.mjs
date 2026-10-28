// Present-day country facts from mledoze/countries (ODbL; the dataset REST Countries was built on,
// used because REST Countries v1-v4 now return "deprecated" and v5 requires an API key).
// Keyed by ISO 3166-1 numeric so it joins Natural Earth / world-atlas polygon ids.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache')
async function get(url, name) {
  const f = path.join(cache, name)
  try { return JSON.parse(await fs.readFile(f, 'utf8')) } catch {}
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  const t = await r.text()
  await fs.writeFile(f, t)
  return JSON.parse(t)
}
const src = await get('https://raw.githubusercontent.com/mledoze/countries/master/countries.json', 'mledoze-countries.json')
const topo = await get('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json', 'countries-50m.json')

const out = {}
for (const c of src) {
  if (!c.ccn3) continue
  out[c.ccn3] = {
    iso3: c.cca3,
    iso2: c.cca2,
    name: c.name.common,
    official: c.name.official,
    capital: c.capital ?? [],
    region: c.region,
    subregion: c.subregion,
    languages: Object.values(c.languages ?? {}),
    currencies: Object.values(c.currencies ?? {}).map((x) => `${x.name}${x.symbol ? ` (${x.symbol})` : ''}`),
    area: c.area,
    borders: c.borders ?? [],
    flag: c.flag,
    latlng: c.latlng,
    landlocked: c.landlocked,
    independent: c.independent,
  }
}
const ids = topo.objects.countries.geometries.map((g) => g.id)
const missing = ids.filter((id) => id && !out[id])
await fs.writeFile(path.join(root, 'public/data/countries.json'), JSON.stringify({ source: 'mledoze/countries (ODbL)', countries: out }))
await fs.writeFile(path.join(root, 'public/data/countries-50m.json'), JSON.stringify(topo))
console.log(Object.keys(out).length, 'countries; polygons without facts:', missing.join(',') || 'none')
