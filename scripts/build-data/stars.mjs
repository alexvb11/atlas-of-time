// The real night sky: the Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991,
// NASA ADC / Harvard; public domain), every star to about magnitude 6.5, with J2000 positions,
// brightness, colour (B−V) and proper motion, so the sky can be moved through the centuries.
// And the Moon's colour map from NASA's Lunar Reconnaissance Orbiter (LROC, NASA SVS 4720; public
// domain).
//
// Output: public/data/stars.json  { stars: [[raDeg, decDeg, V, BminusV, pmRA, pmDec], ...] }
//         public/textures/moon.webp
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/stars')
await fs.mkdir(cache, { recursive: true })

async function get(url, name) {
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

let raw = await fs.readFile(await get('http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz', 'bsc5.dat.gz'))
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw)
// fixed-width columns, 1-based, from the catalogue's ReadMe
const col = (line, a, b) => line.slice(a - 1, b).trim()
const stars = []
for (const line of raw.toString('latin1').split('\n')) {
  if (line.length < 110) continue
  const rah = col(line, 76, 77)
  if (!rah) continue // novae and other entries with no position
  const ra = (Number(rah) + Number(col(line, 78, 79)) / 60 + Number(col(line, 80, 83)) / 3600) * 15
  const sign = col(line, 84, 84) === '-' ? -1 : 1
  const dec = sign * (Number(col(line, 85, 86)) + Number(col(line, 87, 88)) / 60 + Number(col(line, 89, 90)) / 3600)
  const v = Number(col(line, 103, 107))
  const bv = Number(col(line, 110, 114) || '0.6')
  const pmra = Number(col(line, 149, 154) || '0')
  const pmde = Number(col(line, 155, 160) || '0')
  if (!Number.isFinite(v)) continue
  stars.push([+ra.toFixed(4), +dec.toFixed(4), +v.toFixed(2), +bv.toFixed(2), +pmra.toFixed(3), +pmde.toFixed(3)])
}
stars.sort((a, b) => a[2] - b[2])
await fs.writeFile(path.join(root, 'public/data/stars.json'), JSON.stringify({ source: 'Yale Bright Star Catalogue, 5th rev. ed. (Hoffleit & Warren 1991)', stars }))

const moon = await get('https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg', 'moon-1k.jpg')
await sharp(moon).webp({ quality: 84 }).toFile(path.join(root, 'public/textures/moon.webp'))
console.log(`stars: ${stars.length}, brightest ${stars[0][2]}; moon texture written`)
