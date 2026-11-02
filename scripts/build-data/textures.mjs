// Builds the globe textures from NASA Visible Earth sources (see README for credits).
//   earth-day.webp   Blue Marble Next Generation, topography + bathymetry, Dec 2004
//   earth-night.webp Black Marble 2016
//   clouds.webp      cloud_combined_2048 (luminance only)
//   earth-data.webp  lossless. R = present-day land mask (Natural Earth 50m)
//                    G = ocean depth (GEBCO 08 bathymetry, 255 = shallow / land)
//                    B = unused (0, so it costs almost nothing compressed)
//   earth-day-8k.webp the same at 8192 px from the 21600 px source, for high-quality screens
//   relief.webp      land elevation (GEBCO 08, 0–6,400 m as 0–255, square-root scaled so lowland
//                    relief still shows), used to light mountains; relief-2k.webp for phones
//   ice.webp         lossless, approximate Last Glacial Maximum ice-sheet extent (hand-drawn, coarse)
// Each 1x / mobile size pair keeps the live page off third-party hosts. WebP is 30-40% smaller than
// the mozjpeg / PNG files it replaced (lossless for the data textures, so sea levels are unchanged).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import * as topojson from 'topojson-client'

sharp.cache(false)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache')
const out = path.join(root, 'public/textures')
await fs.mkdir(out, { recursive: true })

const src = {
  day: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
  night: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
  clouds: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg',
  bath: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_21600x10800.png',
  dayBig: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x21600x10800.jpg',
  elev: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png',
  land: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json',
}
async function get(url) {
  const file = path.join(cache, path.basename(url))
  try {
    await fs.access(file)
  } catch {
    console.log('downloading', url)
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
    await fs.writeFile(file, Buffer.from(await r.arrayBuffer()))
  }
  return file
}
const big = { limitInputPixels: false }

for (const [w, suffix] of [[4096, ''], [2048, '-2k']]) {
  await sharp(await get(src.day), big).resize(w, w / 2).webp({ quality: 86, effort: 6 }).toFile(path.join(out, `earth-day${suffix}.webp`))
  await sharp(await get(src.night), big).resize(w, w / 2).webp({ quality: 84, effort: 6 }).toFile(path.join(out, `earth-night${suffix}.webp`))
}
await sharp(await get(src.dayBig), big).resize(8192, 4096).webp({ quality: 84, effort: 6 }).toFile(path.join(out, 'earth-day-8k.webp'))
// The GEBCO elevation image is linear grey, 0 = sea level, 255 = 6,400 m and above. Re-encode with a
// square root so hills get as many grey levels as high peaks.
{
  const raw = await sharp(await get(src.elev), big).resize(4096, 2048).greyscale().raw().toBuffer()
  const sq = Buffer.alloc(raw.length)
  for (let i = 0; i < raw.length; i++) sq[i] = Math.round(Math.sqrt(raw[i] / 255) * 255)
  await sharp(sq, { raw: { width: 4096, height: 2048, channels: 1 } }).webp({ quality: 92, effort: 6 }).toFile(path.join(out, 'relief.webp'))
  await sharp(sq, { raw: { width: 4096, height: 2048, channels: 1 } }).resize(2048, 1024).webp({ quality: 92, effort: 6 }).toFile(path.join(out, 'relief-2k.webp'))
}
await sharp(await get(src.clouds)).greyscale().webp({ quality: 82, effort: 6 }).toFile(path.join(out, 'clouds.webp'))

// ---- data texture ----
const W = 4096
const H = 2048
const land = JSON.parse(await fs.readFile(await get(src.land), 'utf8'))
const geo = topojson.feature(land, land.objects.land)
const proj = ([lon, lat]) => `${(((lon + 180) / 360) * W).toFixed(1)},${(((90 - lat) / 180) * H).toFixed(1)}`
const polyPath = (rings) => rings.map((r) => `M${r.map(proj).join('L')}Z`).join('')
let d = ''
for (const f of geo.features ?? [geo]) {
  const g = f.geometry ?? f
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const p of polys) d += polyPath(p)
}
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/>${body}</svg>`)
const mask = await sharp(svg(`<path d="${d}" fill="white" fill-rule="evenodd"/>`)).greyscale().raw().toBuffer()

// Approximate LGM (~21 ka) ice-sheet outlines, lon/lat. Deliberately coarse and blurred; the
// UI labels them as approximate. Based on the general shapes in Dyke 2004 / Hughes et al. 2016.
const ice = [
  // Laurentide + Cordilleran
  [[-168, 62], [-150, 58], [-136, 56], [-128, 49], [-122, 47], [-112, 48.5], [-100, 46], [-94, 43], [-88, 39.5], [-84, 39], [-80, 41], [-74, 40.6], [-70, 41.5], [-66, 43], [-60, 45], [-55, 47], [-52, 52], [-58, 58], [-62, 62], [-66, 67], [-72, 72], [-80, 76], [-90, 79], [-110, 78], [-125, 76], [-135, 70], [-142, 69], [-150, 67], [-160, 65]],
  // Greenland
  [[-73, 78], [-60, 82.5], [-30, 83.5], [-18, 80], [-18, 72], [-22, 68], [-38, 64], [-44, 59.5], [-50, 62], [-54, 67], [-58, 74]],
  // Fennoscandian + British-Irish + Barents
  [[-11, 54], [-10, 58], [-6, 59.5], [-1, 61], [5, 63], [12, 68], [18, 72], [22, 76], [35, 80], [55, 81], [62, 77], [55, 72], [45, 67], [40, 64], [35, 61], [32, 57], [28, 54], [22, 52.5], [14, 52.5], [10, 54], [8, 56], [2, 55], [-2, 53], [-4, 51.5], [-8, 51.5]],
  // Alps
  [[5.5, 45], [7, 46.8], [10, 47.6], [13, 47.6], [15.5, 47], [13, 46], [9, 45.6], [7, 44.3]],
  // Patagonia
  [[-75.5, -38], [-71, -38], [-70.5, -44], [-70, -50], [-69, -54], [-72, -56], [-76, -50], [-75, -44]],
]
const icePath = ice.map((r) => `M${r.map(proj).join('L')}Z`).join('')
const iceMask = await sharp(svg(`<path d="${icePath}" fill="white"/>`)).blur(10).greyscale().raw().toBuffer()

const bath = await sharp(await get(src.bath), big).resize(W, H).greyscale().raw().toBuffer()
const rgb = Buffer.alloc(W * H * 3)
for (let i = 0; i < W * H; i++) {
  rgb[i * 3] = mask[i]
  rgb[i * 3 + 1] = bath[i]
}
await sharp(iceMask, { raw: { width: W, height: H, channels: 1 } }).resize(1024, 512).webp({ lossless: true, effort: 6 }).toFile(path.join(out, 'ice.webp'))
// 2048 is plenty: the mask only drives specular and sea-level changes; the day texture draws coasts
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
  .resize(2048, 1024)
  .webp({ lossless: true, effort: 6 })
  .toFile(path.join(out, 'earth-data.webp'))
for (const f of await fs.readdir(out)) console.log(f, ((await fs.stat(path.join(out, f))).size / 1024).toFixed(0), 'KB')
