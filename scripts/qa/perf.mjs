// Cold-load and hitch probe: real GPU (ANGLE/Metal), 1440x900 @2x, empty cache.
// Reports bytes transferred before the globe is interactive, time to interactive, and main-thread
// long tasks (> 50 ms) and worst frames during a first scrub across all time, when every border and
// drift snapshot is fetched and decoded for the first time.
// Usage: node scripts/qa/perf.mjs [url] [--mobile] [--slow]
import { chromium } from 'playwright'
const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/'
const mobile = process.argv.includes('--mobile')
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
)
const page = await ctx.newPage()
// --mobile also slows the CPU 4x (Lighthouse's mobile profile) so decode hitches show up;
// --slow adds Lighthouse's slow-4G network (1.6 Mbps down, 150 ms round trip)
const cdp = await ctx.newCDPSession(page)
if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
const slow = process.argv.includes('--slow')
if (slow) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (750e3 / 8) * 0.9 })
page.on('pageerror', (e) => console.log('pageerror', e.message))
let bytes = 0
const byType = {}
page.on('response', async (r) => {
  try {
    // bytes over the network only (0 for cache hits)
    const sz = await r.request().sizes()
    const len = sz.responseBodySize + sz.responseHeadersSize
    bytes += len
    const k = r.url().replace(/\?.*/, '').split('/').slice(-2).join('/').replace(/-?\d+\.(json|bin)$/, '*.$1')
    byType[k] = (byType[k] ?? 0) + len
  } catch {}
})
await page.addInitScript(() => {
  window.__long = []
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ entryTypes: ['longtask'] })
})
const t0 = Date.now()
await page.goto(url)
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 180000 })
const tti = Date.now() - t0
await page.waitForTimeout(1500)
const loadBytes = bytes
const loadLong = await page.evaluate(() => window.__long.splice(0))
const scrub = await page.evaluate(async () => {
  const frames = []
  let last = performance.now()
  const t0 = last
  const T = window.__time.getState()
  await new Promise((r) => {
    const f = () => {
      const now = performance.now()
      frames.push(now - last)
      last = now
      T.setU(0.98 - ((now - t0) / 6000) * 0.96)
      if (now - t0 < 6000) requestAnimationFrame(f)
      else r()
    }
    requestAnimationFrame(f)
  })
  frames.sort((a, b) => a - b)
  return {
    fps: frames.length / 6,
    p99: frames[Math.floor(frames.length * 0.99)],
    max: frames[frames.length - 1],
    over50: frames.filter((x) => x > 50).length,
  }
})
const scrubLong = await page.evaluate(() => window.__long.splice(0))
const kb = (b) => `${(b / 1024).toFixed(0)} KB`
const sum = (a) => a.reduce((x, y) => x + y, 0)
console.log(`${mobile ? 'mobile 390x844@3, CPU 4x slower' : 'desktop 1440x900@2'}${slow ? ', slow 4G' : ''}`)
console.log(`load: ${kb(loadBytes)} transferred, interactive in ${tti} ms, ${loadLong.length} long tasks (${sum(loadLong).toFixed(0)} ms, worst ${Math.max(0, ...loadLong).toFixed(0)} ms)`)
console.log(`first scrub (6 s, all time): ${scrub.fps.toFixed(1)} fps, p99 ${scrub.p99.toFixed(1)} ms, worst ${scrub.max.toFixed(0)} ms, ${scrub.over50} frames > 50 ms`)
console.log(`  ${scrubLong.length} long tasks (${sum(scrubLong).toFixed(0)} ms, worst ${Math.max(0, ...scrubLong).toFixed(0)} ms), ${kb(bytes - loadBytes)} fetched`)
console.log('largest transfers:', Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${kb(v)}`).join(', '))
await browser.close()
