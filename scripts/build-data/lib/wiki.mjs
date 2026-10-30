// Cached, polite clients for the Wikipedia and Wikidata APIs (build time only).
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const cacheDir = path.join(root, 'scripts/.cache/wiki-api')
await fs.mkdir(cacheDir, { recursive: true })
const UA = { 'User-Agent': 'AtlasOfTime/0.2 (open-source atlas; build-time data script)' }

let inflight = 0
const MAX = 2
async function slot() {
  while (inflight >= MAX) await new Promise((r) => setTimeout(r, 25))
  inflight++
}

/** GET JSON with an on-disk cache and retry/backoff on 429/5xx */
export async function getJSON(url) {
  const file = path.join(cacheDir, createHash('sha1').update(url).digest('hex') + '.json')
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {}
  await slot()
  try {
    for (let attempt = 0; ; attempt++) {
      let r
      try {
        r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
      } catch (e) {
        if (attempt > 6) throw e
        await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)))
        continue
      }
      if (r.status === 429 || r.status >= 500) {
        if (attempt > 14) throw new Error(`${r.status} ${url}`)
        const after = Number(r.headers.get('retry-after'))
        await new Promise((res) => setTimeout(res, (after > 0 ? after * 1000 : 5000) * Math.min(4, attempt + 1)))
        continue
      }
      if (!r.ok) throw new Error(`${r.status} ${url}`)
      const j = await r.json()
      await fs.writeFile(file, JSON.stringify(j))
      await new Promise((res) => setTimeout(res, 250))
      return j
    }
  } finally {
    inflight--
  }
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

/** Wikipedia: title -> {title, qid, extract} for many titles (follows redirects) */
export async function wikipediaPages(titles) {
  const out = new Map()
  await Promise.all(
    chunks([...new Set(titles)], 20).map(async (batch) => {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts|pageprops&ppprop=wikibase_item|disambiguation&exintro=1&explaintext=1&exsentences=4&exlimit=20&titles=${encodeURIComponent(batch.join('|'))}`
      const j = await getJSON(url)
      const alias = new Map()
      for (const n of j.query?.normalized ?? []) alias.set(n.to, n.from)
      for (const r of j.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from)
      for (const p of Object.values(j.query?.pages ?? {})) {
        if (p.missing !== undefined) continue
        const rec = { title: p.title, qid: p.pageprops?.wikibase_item, extract: p.extract, disambiguation: p.pageprops?.disambiguation !== undefined }
        out.set(p.title, rec)
        let k = p.title
        while (alias.has(k)) {
          k = alias.get(k)
          out.set(k, rec)
        }
      }
    }),
  )
  return out
}

/** Wikipedia full-text search: top titles */
export async function wikipediaSearch(q, limit = 4) {
  const j = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=${limit}&srsearch=${encodeURIComponent(q)}`)
  return (j.query?.search ?? []).map((s) => s.title)
}

/** Wikidata entities (claims + en label + aliases) */
export async function wikidataEntities(ids, props = 'claims|labels|aliases') {
  const out = new Map()
  await Promise.all(
    chunks([...new Set(ids)].filter(Boolean), 50).map(async (batch) => {
      const j = await getJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=en&props=${props}&ids=${batch.join('|')}`)
      for (const [id, e] of Object.entries(j.entities ?? {})) if (!e.missing) out.set(id, e)
    }),
  )
  return out
}

export async function wikidataLabels(ids) {
  const ents = await wikidataEntities(ids, 'labels')
  const out = new Map()
  for (const [id, e] of ents) if (e.labels?.en?.value) out.set(id, e.labels.en.value)
  // a batch can come back without some items (rate limiting): ask again in small batches, under
  // a different cache key; an item still without an English label is left out, never shown as "Q123"
  const missing = [...new Set(ids)].filter((id) => id && !out.has(id))
  for (const batch of chunks(missing, 7)) {
    const again = await wikidataEntities(batch, 'labels|descriptions')
    for (const [id, e] of again) if (e.labels?.en?.value) out.set(id, e.labels.en.value)
  }
  // last resort: the query service, a separate endpoint with its own limits
  const still = missing.filter((id) => !out.has(id))
  for (const batch of chunks(still, 200)) {
    const rows = await sparql(`SELECT ?i ?l WHERE { VALUES ?i { ${batch.map((q) => `wd:${q}`).join(' ')} } ?i rdfs:label ?l FILTER(lang(?l) = 'en') }`)
    for (const r of rows) out.set(r.i.value.split('/').pop(), r.l.value)
  }
  // some items have lost their English label but keep their English article: use its title
  const unlabelled = missing.filter((id) => !out.has(id))
  for (const batch of chunks(unlabelled, 50)) {
    const j = await getJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=enwiki&ids=${batch.join('|')}`)
    for (const [id, e] of Object.entries(j.entities ?? {})) if (e.sitelinks?.enwiki?.title) out.set(id, e.sitelinks.enwiki.title)
  }
  return out
}

export async function wikidataSearchStatement(stmt) {
  const j = await getJSON(`https://www.wikidata.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(`haswbstatement:${stmt}`)}`)
  return (j.query?.search ?? []).map((s) => s.title)
}

// ---------- claim helpers ----------
export const claims = (e, p) => (e?.claims?.[p] ?? []).filter((c) => c.rank !== 'deprecated')
export const ids = (e, p) => claims(e, p).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)

/** Wikidata time -> {year (astronomical), approx} */
export function wdYear(v) {
  if (!v?.time) return null
  const m = v.time.match(/^([+-])(\d+)-/)
  if (!m) return null
  const y = Number(m[2])
  // Wikidata uses historical numbering for BCE (no year zero)
  const year = m[1] === '-' ? 1 - y : y
  return { year, approx: (v.precision ?? 9) < 9 }
}

export function claimYears(e, p) {
  return claims(e, p)
    .map((c) => wdYear(c.mainsnak?.datavalue?.value))
    .filter(Boolean)
}

/** Value claims with start/end qualifiers: [{id, from, to}] */
export function qualified(e, p) {
  return claims(e, p)
    .map((c) => ({
      id: c.mainsnak?.datavalue?.value?.id,
      amount: c.mainsnak?.datavalue?.value?.amount,
      from: wdYear(c.qualifiers?.P580?.[0]?.datavalue?.value)?.year ?? null,
      to: wdYear(c.qualifiers?.P582?.[0]?.datavalue?.value)?.year ?? null,
      at: wdYear(c.qualifiers?.P585?.[0]?.datavalue?.value)?.year ?? null,
    }))
    .filter((x) => x.id || x.amount)
}

export function coord(e) {
  const v = claims(e, 'P625')[0]?.mainsnak?.datavalue?.value
  return v ? [v.longitude, v.latitude] : null
}

export function kmBetween([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180
  const d = Math.sin(lat1 * r) * Math.sin(lat2 * r) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r)
  return 6371 * Math.acos(Math.min(1, Math.max(-1, d)))
}

/** Wikidata Query Service (SPARQL), cached; POST so large VALUES blocks fit */
export async function sparql(query) {
  const file = path.join(cacheDir, 'sparql-' + createHash('sha1').update(query).digest('hex') + '.json')
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {}
  for (let attempt = 0; ; attempt++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { ...UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }),
    }).catch((e) => ({ ok: false, status: 0, e }))
    if (r.ok) {
      const j = await r.json()
      const rows = j.results.bindings
      await fs.writeFile(file, JSON.stringify(rows))
      await new Promise((res) => setTimeout(res, 1000))
      return rows
    }
    if (attempt > 8) throw new Error(`SPARQL failed: ${r.status}`)
    const after = Number(r.headers?.get?.('retry-after'))
    await new Promise((res) => setTimeout(res, (after > 0 ? after * 1000 : 10000) * Math.min(3, attempt + 1)))
  }
}

/** SPARQL year from xsd:dateTime (WDQS uses astronomical numbering: 0000 = 1 BCE) */
export const sparqlYear = (v) => {
  const m = v?.match(/^(-?)(\d+)-/)
  return m ? (m[1] ? -Number(m[2]) : Number(m[2])) : null
}
