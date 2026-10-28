// Long-run population per present-day territory from Our World in Data
// (HYDE 3.2 before 1950, UN WPP after), downloaded at build time.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const file = path.join(root, 'scripts/.cache/owid-pop.csv')
try {
  await fs.access(file)
} catch {
  const r = await fetch('https://ourworldindata.org/grapher/population.csv?v=1&csvType=full&useColumnShortNames=true', {
    headers: { 'User-Agent': 'atlas-of-time-build' },
  })
  await fs.writeFile(file, await r.text())
}
const rows = (await fs.readFile(file, 'utf8')).trim().split('\n').slice(1)
const series = {}
for (const row of rows) {
  // entity names may contain commas inside quotes; code/year/value are always the last 3 fields
  const parts = row.split(',')
  const v = Number(parts.pop())
  const year = Number(parts.pop())
  const code = parts.pop()
  const key = code || null
  if (!key || (key.startsWith('OWID_') && key !== 'OWID_WRL')) continue
  // OWID years <= 0 are calendar BCE (no year zero) -> astronomical year
  const t = year <= 0 ? year + 1 : year
  ;(series[key === 'OWID_WRL' ? 'WORLD' : key] ??= []).push([t, Number(v.toPrecision(3))])
}
for (const s of Object.values(series)) s.sort((a, b) => a[0] - b[0])
await fs.writeFile(
  path.join(root, 'public/data/population.json'),
  JSON.stringify({ source: 'Our World in Data, population (HYDE 3.2 & UN WPP 2024)', series }),
)
console.log(Object.keys(series).length, 'series', series.WORLD.length, 'world points')
