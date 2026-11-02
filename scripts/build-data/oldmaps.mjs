// Reprojects historical world maps onto the globe's equirectangular grid, so they can be laid over
// it as they were drawn. Each map is placed with its own graticule, never warped to fit today's
// coastlines: where the mapmaker was wrong, the overlay is wrong in the same way.
//
//   mercator-1569.webp  Gerardus Mercator, Nova et Aucta Orbis Terrae Descriptio (1569), the
//                       Wikimedia Commons composite of the 18 sheets (public domain). Mercator
//                       projection: x = a·lon + b, y = c·ln(tan(π/4 + φ/2)) + d, with the scale a
//                       read from the map's own meridians (14.2 px per degree, c = −a·180/π) and the
//                       offsets fitted. The map spans about 365° of longitude (its prime meridian
//                       runs through the Cape Verde islands) and 80°N to 66°S.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

sharp.cache(false)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'scripts/.cache/oldmaps')
const out = path.join(root, 'public/data/oldmaps')
await fs.mkdir(out, { recursive: true })

const W = 4096
const H = 2048

async function mercator1569() {
  const { data, info } = await sharp(path.join(cache, 'mercator1569.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const a = 14.2
  const b = 3060.5
  const c = (-a * 180) / Math.PI
  const d = 2079.2
  // the inner neat line of the composite
  const [x0, x1] = [110, 5291]
  const lonMin = (x0 - b) / a
  const lonMax = (x1 - b) / a
  const [latMin, latMax] = [-66, 80]
  // the composite leaves white gaps between its sheets; the 50 px of map either side of a gap
  // are stretched to close it (a local shift of under a degree), so no blank band shows
  const seamX = [[998, 1027], [1852, 1875], [2702, 2725], [3552, 3576], [4404, 4427]]
  const seamY = [[2278, 2310]]
  const G = 50
  const skip = (v, seams) => {
    for (const [s0, s1] of seams) {
      const mid = (s0 + s1) / 2
      if (v > s0 - G && v <= mid) return s0 - G + ((v - (s0 - G)) * G) / (mid - (s0 - G))
      if (v > mid && v < s1 + G) return s1 + G - ((s1 + G - v) * G) / (s1 + G - mid)
    }
    return v
  }
  const px = Buffer.alloc(W * H * 4)
  for (let j = 0; j < H; j++) {
    const lat = 90 - ((j + 0.5) / H) * 180
    if (lat < latMin || lat > latMax) continue
    const y = skip(c * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) + d, seamY)
    if (y < 0 || y > info.height - 2) continue
    // fade the top and bottom edges over a degree
    const edge = Math.min(1, (lat - latMin) / 1, (latMax - lat) / 1)
    for (let i = 0; i < W; i++) {
      let lon = ((i + 0.5) / W) * 360 - 180
      if (lon > lonMax) lon -= 360
      if (lon < lonMin) continue
      if (a * lon + b < x0 || a * lon + b > x1) continue
      const x = skip(a * lon + b, seamX)
      // bilinear
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const fx = x - xi
      const fy = y - yi
      const o = (j * W + i) * 4
      for (let k = 0; k < 3; k++) {
        const p = (yy, xx) => data[(yy * info.width + xx) * 3 + k]
        const top = p(yi, xi) * (1 - fx) + p(yi, xi + 1) * fx
        const bot = p(yi + 1, xi) * (1 - fx) + p(yi + 1, xi + 1) * fx
        px[o + k] = Math.round(top * (1 - fy) + bot * fy)
      }
      px[o + 3] = Math.round(255 * edge)
    }
  }
  await sharp(px, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 78, alphaQuality: 60 }).toFile(path.join(out, 'mercator-1569.webp'))
  console.log('mercator-1569.webp', `lon ${lonMin.toFixed(1)}..${lonMax.toFixed(1)}`)
}

await mercator1569()
