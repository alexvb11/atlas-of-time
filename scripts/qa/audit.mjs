// Consistency audit: select a location, jump to random dates, and check that every visible element
// agrees with the date. Writes a contact sheet of screenshots. Usage: node scripts/qa/audit.mjs [n]
import { chromium } from 'playwright'
import fs from 'node:fs'
const N = Number(process.argv[2] ?? 34)
const out = 'scripts/qa/audit'
fs.mkdirSync(out, { recursive: true })
const data = JSON.parse(fs.readFileSync('public/data/entities.json', 'utf8'))
const auto = fs.existsSync('public/data/entities-auto.json') ? JSON.parse(fs.readFileSync('public/data/entities-auto.json', 'utf8')) : { entities: [] }
const byName = new Map()
for (const e of [...auto.entities, ...data.entities]) for (const n of [e.name, ...e.names.map((x) => x[2])]) byName.set(n, e)

const places = [
  ['Yerevan', [44.5, 40.18]], ['Rome', [12.5, 41.9]], ["Xi'an", [108.9, 34.3]], ['Mexico City', [-99.1, 19.4]], ['London', [-0.1, 51.5]],
  ['Tehran', [51.39, 35.69]], ['Baghdad', [44.37, 33.31]], ['Moscow', [37.62, 55.75]], ['Delhi', [77.21, 28.61]], ['Kyoto', [135.77, 35.01]],
  ['Madrid', [-3.7, 40.42]], ['Paris', [2.35, 48.86]], ['Berlin', [13.4, 52.52]], ['Cusco', [-71.97, -13.53]], ['Timbuktu', [-3.0, 16.77]],
  ['Stockholm', [18.07, 59.33]], ['Alice Springs', [133.88, -23.7]],
]
let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.addInitScript(() => localStorage.setItem('atlas.introSeen.v1', '1'))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 60000 })
await page.waitForTimeout(1500)

const failures = []
for (let i = 0; i < N; i++) {
  const u = 0.32 + rnd() * 0.68 // human era mostly; deep time checked separately below
  const [place, ll] = places[i % places.length]
  const state = await page.evaluate(([u, ll]) => {
    const T = window.__time.getState()
    T.setU(u)
    T.select(ll, false)
    return window.__time.getState().time
  }, [u, ll])
  await page.waitForTimeout(1600)
  const seen = await page.evaluate(() => ({
    readout: document.querySelector('[aria-live="polite"]')?.textContent ?? '',
    title: document.querySelector('[role="dialog"] h2')?.textContent?.trim() ?? '',
    kicker: document.querySelector('[role="dialog"] .uppercase')?.textContent ?? '',
    events: [...document.querySelectorAll('.globe-event')].filter((e) => Number(e.style.opacity) > 0.3 && !e.classList.contains('future')).map((e) => e.textContent),
  }))
  const t = Math.round(state)
  const ent = byName.get(seen.title.replace(/^\S+\s(?=\S)/u, (m) => (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(m) ? '' : m)))
  let verdict = 'ok'
  if (ent && !(t >= ent.from - 1 && t < ent.to + 1)) {
    verdict = `ENTITY OUT OF RANGE (${ent.from}..${ent.to})`
    failures.push(`${place} @ ${t}: ${seen.title} ${verdict}`)
  }
  const pastEvents = data.events.filter((e) => seen.events.some((s) => s.includes(e.title)))
  for (const e of pastEvents) if (e.t > t + 1) failures.push(`${place} @ ${t}: future event shown as past: ${e.title}`)
  console.log(`${String(i + 1).padStart(2)} ${place.padEnd(12)} t=${String(t).padStart(8)}  ${seen.title.padEnd(40)} ${verdict}`)
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}-${place.replace(/\W/g, '')}-${t}.png`, scale: 'css' })
}
// deep time: the panel must speak of landmasses, never states
for (const ma of [100, 250, 500]) {
  await page.evaluate((ma) => window.__time.getState().setTime(2026 - ma * 1e6), ma)
  await page.waitForTimeout(1500)
  const kicker = await page.evaluate(() => document.querySelector('[role="dialog"] .uppercase')?.textContent ?? '')
  console.log(`deep ${ma} Ma: ${kicker}`)
  if (!/landmass/i.test(kicker)) failures.push(`deep ${ma} Ma shows "${kicker}"`)
}
await browser.close()
console.log(failures.length ? `\nFAILURES:\n${failures.join('\n')}` : '\nall checks passed')
console.log(errors.length ? `console errors:\n${[...new Set(errors)].join('\n')}` : 'no console errors')
