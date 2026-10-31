// The reader's Wikipedia client. Articles and hover-card terms are fetched by the browser from
// Wikipedia's public APIs (CORS, anonymous), only when a reader opens or hovers something, and
// cached for the session. Text is turned into a small tree here, so no Wikipedia HTML is ever
// injected into the page. Which article belongs to which event is curated at build time
// (public/data/articles.json, checked by scripts/build-data/articles.mjs).
//
// Language: the reader follows the viewer's language (browser setting, or the reader's picker).
// Article keys are English titles ("Thomas Jefferson") or language-qualified ("fr|Thomas Jefferson").
// An English key is translated through Wikipedia's interlanguage links; when the article does not
// exist in that language the English one is shown and the reader says so.
import { useEffect, useState, useSyncExternalStore } from 'react'

export const LANGS: Record<string, string> = {
  en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
  ru: 'Русский', uk: 'Українська', el: 'Ελληνικά', tr: 'Türkçe', hy: 'Հայերեն', ka: 'ქართული', ar: 'العربية', fa: 'فارسی',
  hi: 'हिन्दी', zh: '中文', ja: '日本語', ko: '한국어',
}
let lang = (() => {
  try {
    const saved = localStorage.getItem('atlas.lang')
    if (saved && saved in LANGS) return saved
  } catch {
    // storage blocked: fall through to the browser language
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase()
  return nav in LANGS ? nav : 'en'
})()
const langListeners = new Set<() => void>()
export const getLang = () => lang
export function setLang(l: string) {
  if (!(l in LANGS) || l === lang) return
  lang = l
  try {
    localStorage.setItem('atlas.lang', l)
  } catch {
    // kept for this visit only
  }
  langListeners.forEach((f) => f())
}
export const useLang = () =>
  useSyncExternalStore(
    (f) => {
      langListeners.add(f)
      return () => void langListeners.delete(f)
    },
    () => lang,
  )

type Ref = { lang: string; title: string }
const splitKey = (key: string): Ref => {
  const m = key.match(/^([a-z]{2,3})\|(.+)$/)
  return m ? { lang: m[1], title: m[2] } : { lang: 'en', title: key }
}
const keyOf = (r: Ref) => (r.lang === 'en' ? r.title : `${r.lang}|${r.title}`)
/** The title to show for an article key */
export const displayTitle = (key: string) => splitKey(key).title.split('#')[0]
const api = (l: string) => `https://${l}.wikipedia.org/w/api.php`
const rest = (l: string) => `https://${l}.wikipedia.org/api/rest_v1`

/** A run of text: plain, or a link to another article */
export type Inline = string | { text: string; link?: string; b?: boolean; i?: boolean }
export type Block = { kind: 'p'; parts: Inline[] } | { kind: 'li'; parts: Inline[] }
export type Section = { heading: string; blocks: Block[] }
export type Shot = { src: string; srcset: string; caption: string; file: string; signature: boolean }
export type Article = { title: string; url: string; lead: Block[]; sections: Section[]; lang: string; fallback: boolean }
export type Term = {
  title: string
  url: string
  description: string | null
  extract: string
  qid: string | null
  coords: [number, number] | null
  thumb: string | null
  disambiguation: boolean
}

export const wikiUrl = (key: string) => {
  const { lang: l, title } = splitKey(key)
  return `https://${l}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%23/, '#')}`
}

/** An English key in the current language, via interlanguage links; falls back to English */
function localize(key: string): Promise<Ref & { fallback: boolean }> {
  const ref = splitKey(key)
  const l = lang
  if (ref.lang !== 'en' || l === 'en' || ref.title.includes('#')) return Promise.resolve({ ...ref, fallback: false })
  return once(`l:${l}:${ref.title}`, async () => {
    const j = await json(`${api('en')}?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=langlinks&lllang=${l}&titles=${encodeURIComponent(ref.title)}`)
    const t = j.query?.pages?.[0]?.langlinks?.[0]?.title as string | undefined
    return t ? { lang: l, title: t, fallback: false } : { ...ref, fallback: true }
  })
}

const cache = new Map<string, Promise<unknown>>()
function once<T>(key: string, f: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) {
    p = f()
    // a failed request may succeed later (offline, rate limit): don't cache failures
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

async function json(url: string) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { 'Api-User-Agent': 'AtlasOfTime/0.5 (in-app reader)' } })
    if (r.ok) return r.json()
    if ((r.status === 429 || r.status >= 500) && attempt < 2) {
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
      continue
    }
    throw new Error(`Wikipedia ${r.status}`)
  }
}

// ---------- curated event -> article index ----------
type ArticleIndex = { events: Record<string, string>; entities: Record<string, string> }
let indexP: Promise<ArticleIndex> | null = null
export const loadArticleIndex = () =>
  (indexP ??= fetch('/data/articles.json')
    .then((r) => r.json() as Promise<ArticleIndex>)
    .catch((e) => {
      indexP = null
      throw e
    }))

export function useArticleIndex() {
  const [idx, setIdx] = useState<ArticleIndex | null>(null)
  useEffect(() => {
    loadArticleIndex().then(setIdx, () => {})
  }, [])
  return idx
}

// ---------- country events from Wikidata (scripts/build-data/country-events.mjs) ----------
type CountryEvents = Record<string, [number, string][]>
let countryP: Promise<CountryEvents> | null = null
export function useCountryEvents() {
  const [ev, setEv] = useState<CountryEvents | null>(null)
  useEffect(() => {
    ;(countryP ??= fetch('/data/events-auto.json')
      .then((r) => r.json())
      .then((j) => j.events as CountryEvents)
      .catch((e) => {
        countryP = null
        throw e
      })).then(setEv, () => {})
  }, [])
  return ev
}

// ---------- HTML -> blocks ----------
const DROP = [
  '.infobox', 'table', '.navbox', '.hatnote', '.shortdescription', 'sup', '.mw-ref', '.reference', 'style', 'link', 'figure',
  '.thumb', '.mw-empty-elt', '.noprint', '.metadata', '.ambox', '.sidebar', '.mw-editsection', '.geo-inline', '#coordinates',
  '.side-box', '.rt-commentedText + .reference', '.IPA', '.nowrap.noprint', 'audio', 'video', '.mw-ext-score', '.gallery', 'math',
  '.mwe-math-element', '.ext-phonos', '.portalbox', 'img', '[title*="respelling"]', '[title*="Help:IPA"]',
  // pronunciation in other languages' Wikipedias (fr: .API, de: .Lautschrift-style IPA spans)
  '.API', 'a[href*="Alphabet_phon"]', 'a[href*="Liste_der_IPA"]', 'a[href*="Internationales_Phonetisches"]',
].join(',')

/** "./Thomas_Jefferson" or "/wiki/Thomas_Jefferson#Early_life" -> "Thomas Jefferson" (main namespace only) */
function linkTarget(href: string | null): string | null {
  if (!href) return null
  const m = href.match(/^(?:\.\/|\/wiki\/)([^?]+)$/)
  if (!m) return null
  const t = decodeURIComponent(m[1].split('#')[0]).replace(/_/g, ' ')
  if (!t || /^(File|Help|Special|Category|Wikipedia|Template|Portal|Talk|Wiktionary|Module|Draft|User):/i.test(t)) return null
  return t
}

function inlines(node: Node, out: Inline[], l: string, style: { b?: boolean; i?: boolean } = {}) {
  for (const c of Array.from(node.childNodes)) {
    if (c.nodeType === 3) {
      const text = c.textContent ?? ''
      if (text) out.push(style.b || style.i ? { text, ...style } : text)
    } else if (c.nodeType === 1) {
      const el = c as Element
      const tag = el.tagName
      if (tag === 'A') {
        const text = el.textContent ?? ''
        const t = linkTarget(el.getAttribute('href'))
        const link = t && keyOf({ lang: l, title: t })
        if (text) out.push(link ? { text, link, ...style } : style.b || style.i ? { text, ...style } : text)
      } else if (tag === 'B' || tag === 'STRONG') inlines(el, out, l, { ...style, b: true })
      else if (tag === 'I' || tag === 'EM') inlines(el, out, l, { ...style, i: true })
      else if (tag === 'BR') out.push(' ')
      else inlines(el, out, l, style)
    }
  }
}

/** Tidy what removing references and pronunciation spans leaves behind */
function tidy(parts: Inline[]): Inline[] {
  const merged: Inline[] = []
  for (const p of parts) {
    const last = merged[merged.length - 1]
    if (typeof p === 'string' && typeof last === 'string') merged[merged.length - 1] = last + p
    else merged.push(p)
  }
  const out = merged.map((p) =>
    typeof p === 'string'
      ? p
          .replace(/\[(\d+|[a-z]|citation needed|note \d+|nb \d+)\]/gi, '')
          .replace(/,?\s*pronounced(?=\s*[);,])/g, '')
          .replace(/\(\s*[;,]?\s*\)/g, '')
          .replace(/\(\s*;\s*/g, '(')
          .replace(/\s+([,.;:)])/g, '$1')
          .replace(/\s{2,}/g, ' ')
      : p,
  )
  if (typeof out[0] === 'string') out[0] = (out[0] as string).trimStart()
  const n = out.length - 1
  if (typeof out[n] === 'string') out[n] = (out[n] as string).trimEnd()
  return out.filter((p) => (typeof p === 'string' ? p.length > 0 : p.text.length > 0))
}

function blocksFrom(html: string, maxWords: number, l: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('.mw-parser-output') ?? doc.body
  root.querySelectorAll(DROP).forEach((n) => n.remove())
  const blocks: Block[] = []
  let words = 0
  for (const el of Array.from(root.querySelectorAll(':scope > p, :scope > ul, :scope > section > p'))) {
    if (words >= maxWords) break
    if (el.tagName === 'P') {
      const parts: Inline[] = []
      inlines(el, parts, l)
      const t = tidy(parts)
      const text = t.map((p) => (typeof p === 'string' ? p : p.text)).join('')
      if (text.trim().length < 2) continue
      words += text.split(/\s+/).length
      blocks.push({ kind: 'p', parts: t })
    } else if (blocks.length) {
      // short bullet lists only (e.g. the terms of a treaty), and only after some prose
      for (const li of Array.from(el.querySelectorAll(':scope > li')).slice(0, 6)) {
        const parts: Inline[] = []
        inlines(li, parts, l)
        const t = tidy(parts)
        if (t.length) blocks.push({ kind: 'li', parts: t })
      }
    }
  }
  return blocks
}

// sections worth reading in a short article, in the order they help: why it happened, then what followed
// (English, then the same headings in the other reader languages where Wikipedia commonly uses them)
const BEFORE = /^(background|origins?|causes?|prelude|context|precursors?|history|etymology and origins|early (life|years)( and (education|career|family))?|biography|hintergrund|vorgeschichte|contexte|origines|antecedentes|contexto|contesto|antefatti|voorgeschiedenis|tło|предыстория|предпосылки|передумови|ön ?plan|arka plan)$/i
const AFTER = /^(aftermath|legacy|consequences|impact|significance|outcome|results?|effects|influence|assessment|historical significance|folgen|nachwirkung|bedeutung|conséquences|postérité|héritage|consecuencias|legado|consequências|conseguenze|eredità|gevolgen|skutki|последствия|итоги|наслідки|sonuçlar)$/i

/** A concise article: the lead (whole), plus "Background" and "Aftermath"/"Legacy" when the article has them */
export function article(key: string): Promise<Article> {
  return once(`a:${lang}:${key}`, async () => {
    const ref = await localize(key)
    const l = ref.lang
    const titleWithSection = keyOf(ref)
    const [title, only] = ref.title.split('#')
    const q = (extra: string) => `${api(l)}?action=parse&format=json&formatversion=2&origin=*&redirects=1&page=${encodeURIComponent(title)}&disableeditsection=1&disabletoc=1&disablelimitreport=1${extra}`
    const secs: { index: string; line: string; toclevel: number; anchor: string }[] = (await json(q('&prop=sections'))).parse.sections
    const html = (index: string) => json(q(`&prop=text&section=${index}`)).then((j) => j.parse.text as string)
    const plain = (s: string) => s.replace(/<[^>]+>/g, '')
    if (only) {
      const s = secs.find((x) => x.anchor === only.replace(/ /g, '_') || plain(x.line) === only)
      if (!s) throw new Error('section not found')
      return { title: `${title}: ${plain(s.line)}`, url: wikiUrl(titleWithSection), lead: blocksFrom(await html(s.index), 420, l), sections: [], lang: l, fallback: ref.fallback }
    }
    const top = secs.filter((s) => s.toclevel === 1)
    const picks = [top.find((s) => BEFORE.test(plain(s.line))), top.find((s) => AFTER.test(plain(s.line)))].filter((s): s is (typeof secs)[number] => !!s)
    const [lead, ...rest] = await Promise.all([html('0'), ...picks.map((s) => html(s.index))])
    return {
      title,
      url: wikiUrl(keyOf({ lang: l, title })),
      lead: blocksFrom(lead, 600, l),
      sections: picks.map((s, i) => ({ heading: plain(s.line), blocks: blocksFrom(rest[i], 170, l) })).filter((s) => s.blocks.length),
      lang: l,
      fallback: ref.fallback,
    }
  })
}

// ---------- terms (hover cards) ----------
export function term(key: string): Promise<Term> {
  return once(`t:${lang}:${key}`, async () => {
    const ref = await localize(key)
    const j = await json(`${rest(ref.lang)}/page/summary/${encodeURIComponent(ref.title.replace(/ /g, '_'))}?redirect=true`)
    return {
      title: j.title,
      url: j.content_urls?.desktop?.page ?? wikiUrl(keyOf({ lang: ref.lang, title: j.title })),
      description: j.description ?? null,
      extract: j.extract ?? '',
      qid: j.wikibase_item ?? null,
      coords: j.coordinates ? [j.coordinates.lon, j.coordinates.lat] : null,
      thumb: j.originalimage?.source ?? j.thumbnail?.source ?? null,
      disambiguation: j.type === 'disambiguation',
    }
  })
}

// files that are page furniture, not pictures of the subject
const JUNK = /(flag_of|coat_of_arms|seal_of|logo|icon|commons-|wiki(source|quote|media|data|books|news|versity|voyage)|symbol|question_book|edit-clear|padlock|disambig|portal|crystal_clear|nuvola|gnome|ambox|speaker|loudspeaker|sound|audio|\.ogg|\.oga|\.webm|\.ogv|\.mid|\.pdf|\.djvu|\.tif)/i

/** The pictures a Wikipedia article itself uses, in article order, with their captions */
export function film(key: string): Promise<Shot[]> {
  return once(`f:${lang}:${key}`, async () => {
    // a person's signature, when Wikidata records one (P109): the films end on it
    const signatureP = signatureOf(key).catch(() => null)
    const ref = await localize(key)
    const j = await json(`${rest(ref.lang)}/page/media-list/${encodeURIComponent(ref.title.split('#')[0].replace(/ /g, '_'))}?redirect=true`)
    const seen = new Set<string>()
    const shots: Shot[] = []
    let sig: Shot | null = null
    const abs = (s: string) => (s.startsWith('//') ? 'https:' + s : s)
    for (const it of j.items ?? []) {
      if (it.type !== 'image' || !it.srcset?.length) continue
      const file: string = it.title ?? ''
      const signature = /signature|autograph|signatur/i.test(file)
      if (JUNK.test(file) || (/\.svg$/i.test(file) && !signature)) continue
      // skip near-duplicates such as 'X (cropped).jpg' next to 'X.jpg'
      const stem = file.replace(/\.\w+$/, '').toLowerCase().replace(/\b(\d+x\d+|close|cropped|crop|edit(ed)?|restored|retouched)\b/g, '').replace(/[^a-z0-9]+/g, '')
      if (seen.has(stem)) continue
      seen.add(stem)
      const shot = {
        src: abs(it.srcset[0].src),
        srcset: it.srcset.map((s: { src: string; scale: string }) => `${abs(s.src)} ${s.scale}`).join(', '),
        caption: (it.caption?.text ?? '').replace(/\s+/g, ' ').trim(),
        file,
        signature,
      }
      // a signature is saved for the closing shot
      if (signature) sig ??= shot
      else if (shots.length < 8) shots.push(shot)
    }
    sig ??= await signatureP
    return sig ? [...shots, sig] : shots
  })
}

/** Promise -> state, keyed so a new key resets to loading */
export function useAsync<T>(key: string | null, f: (key: string) => Promise<T>) {
  // the reader language is part of the key: switching language refetches
  const l = useLang()
  const k = key && `${l}\u0000${key}`
  const [state, setState] = useState<{ key: string | null; data?: T; error?: boolean }>({ key: null })
  useEffect(() => {
    if (!k || !key) return
    let live = true
    f(key).then(
      (data) => live && setState({ key: k, data }),
      () => live && setState({ key: k, error: true }),
    )
    return () => {
      live = false
    }
    // f is a stable module function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  return state.key === k ? state : { key: k, data: undefined, error: false }
}

async function signatureOf(title: string): Promise<Shot | null> {
  const t = await term(title)
  if (!t.qid) return null
  const j = await json(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&entity=${t.qid}&property=P109`)
  const file: string | undefined = j.claims?.P109?.[0]?.mainsnak?.datavalue?.value
  if (!file) return null
  const path = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}`
  return { src: `${path}?width=500`, srcset: `${path}?width=500 1x, ${path}?width=960 2x`, caption: `Signature of ${t.title}`, file: `File:${file}`, signature: true }
}
