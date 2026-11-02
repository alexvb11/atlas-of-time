// Close-up terrain engine check: flies to lon lat dist, prints tile states every 2.5 s and the
// frame rate, screenshots scripts/qa/shots/tiles.png. Usage: node scripts/qa/terrain.mjs 7.66 45.9 1.0018
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)))
await page.goto('http://localhost:5173/?qa')
await page.evaluate((S) => localStorage.setItem('atlas.settings.v1', JSON.stringify({ autoRotate: false, trade: false, events: false, cities: false, hud: false, sourceNotes: true, borders: false, sun: 'always-day', ...S })), JSON.parse(process.env.S || '{}'))
await page.reload()
await page.waitForFunction(() => window.__time?.getState().introDone && window.__rig, null, { timeout: 120000 })
const [lon, lat, dist] = process.argv.slice(2).map(Number)
await page.evaluate(([lon, lat, dist]) => Object.assign(window.__rig, { lon, lat, dist, zoomTo: null, lastInput: performance.now() + 1e9 }), [lon, lat, dist])
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(2500)
  console.log(JSON.stringify(await page.evaluate(() => { const T = window.__tiles; const st = {}; let vis = 0, maxz = 0; for (const t of T.tiles.values()) { st[t.state] = (st[t.state] || 0) + 1; if (t.mesh?.visible) { vis++; maxz = Math.max(maxz, t.z) } } return { st, vis, maxz, q: T.queue().queued, dist: +window.__rig.dist.toFixed(5) } })))
}
const fps = await page.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise((r) => { const f = () => { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(f) : r() }; requestAnimationFrame(f) }); return n / 3 })
console.log('fps', fps.toFixed(1))
await page.screenshot({ path: 'scripts/qa/shots/tiles.png' })
console.log('errors', errs.slice(0, 5), errs.length)
await browser.close()
