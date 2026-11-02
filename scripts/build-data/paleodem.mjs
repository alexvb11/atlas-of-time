// Ancient landscapes: the PALEOMAP Paleodigital Elevation Models (Scotese & Wright 2018, Zenodo
// 5460860, CC BY 4.0), one 1° global grid of elevation and ocean depth every 5 million years
// from today back to 540 Ma, drawn on the globe in deep time (the drifting crust uses the same
// PALEOMAP plate model, see drift.mjs).
//
// Each map is stored as a 360×180 lossless WebP, one grey channel: 128..255 is land from sea
// level to 6,000 m (47 m a step), 0..127 the sea floor from sea level to 6,000 m deep.
// Output: public/data/paleodem/<Ma>.webp and index.json
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/paleodem')
const out = path.join(root, 'public/data/paleodem')
await fs.mkdir(cache, { recursive: true })
await fs.mkdir(out, { recursive: true })

const zip = path.join(cache, 'csv.zip')
try {
  await fs.access(zip)
} catch {
  const r = await fetch('https://zenodo.org/records/5460860/files/PaleoDEMS_long_lat_elev_csv_v2.zip?download=1')
  if (!r.ok) throw new Error(`paleodem: HTTP ${r.status}`)
  await fs.writeFile(zip, Buffer.from(await r.arrayBuffer()))
}
const dir = path.join(cache, 'PaleoDEMS_long_lat_elev_csv_v2.csv')
try {
  await fs.access(dir)
} catch {
  await (process.platform === 'win32' ? run('tar', ['-xf', zip, '-C', cache]) : run('unzip', ['-o', '-q', zip, '-d', cache]))
}

const W = 360
const H = 180
const maps = []
for (const f of (await fs.readdir(dir)).filter((x) => x.endsWith('.csv'))) {
  const ma = Number(f.match(/_(\d+)Ma\.csv$/)[1])
  const px = Buffer.alloc(W * H, 64)
  // the files mix Windows and old Mac line endings
  for (const line of (await fs.readFile(path.join(dir, f), 'utf8')).split(/\r\n|\r|\n/)) {
    if (!line || line[0] === '#') continue
    const [lon, lat, elev] = line.split(',').map(Number)
    // cell centres: lon -180..179, lat 89..-90 (the 90° row is the pole, folded into the top row)
    const x = Math.round(lon + 180)
    const y = Math.min(H - 1, Math.round(90 - lat))
    if (x < 0 || x >= W || !Number.isFinite(elev)) continue
    px[y * W + x] = elev >= 0 ? 128 + Math.min(127, Math.round((elev / 6000) * 127)) : Math.max(0, 127 - Math.round((-elev / 6000) * 127))
  }
  await sharp(px, { raw: { width: W, height: H, channels: 1 } }).webp({ lossless: true }).toFile(path.join(out, `${ma}.webp`))
  maps.push(ma)
}
maps.sort((a, b) => a - b)
await fs.writeFile(
  path.join(out, 'index.json'),
  JSON.stringify({ source: 'PALEOMAP PaleoDEMs, Scotese & Wright 2018 (Zenodo 5460860), CC BY 4.0', maps }),
)
const bytes = (await Promise.all(maps.map((m) => fs.stat(path.join(out, `${m}.webp`))))).reduce((a, s) => a + s.size, 0)
console.log(`paleodem: ${maps.length} maps, 0–${maps[maps.length - 1]} Ma, ${(bytes / 1024).toFixed(0)} KB`)
