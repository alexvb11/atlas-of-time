// Atlas of Time service worker: makes the site installable and usable offline for what has been
// seen before.
//   - the page and its scripts: network first, cached copy when offline (always up to date online)
//   - data files and textures (same site): cache first, refreshed in the background
//   - map tiles, Wikipedia articles and pictures (other sites): cached as they are viewed, so
//     places and articles already visited open offline; the tile cache is capped
const VERSION = 'v2'
const SHELL = `atlas-shell-${VERSION}`
const DATA = `atlas-data-${VERSION}`
const REMOTE = `atlas-remote-${VERSION}`
const REMOTE_MAX = 3000

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// on a first visit the page loaded before this worker took control: it sends what it fetched
// so that visit works offline too
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache') return
  const urls = e.data.urls.filter((u) => new URL(u).origin === self.location.origin)
  e.waitUntil(
    Promise.all(
      urls.map((u) =>
        caches.open(/\/assets\/|\/$|\.html/.test(new URL(u).pathname) ? SHELL : DATA).then((c) =>
          c.match(u).then((hit) => hit || fetch(u).then((r) => r.ok && c.put(u, r)).catch(() => {})),
        ),
      ),
    ),
  )
})

async function trim(name, max) {
  const c = await caches.open(name)
  const keys = await c.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k)
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const same = url.origin === self.location.origin
  // the page and app code: fresh when online
  if (same && (req.mode === 'navigate' || url.pathname.includes('/assets/'))) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(SHELL).then((c) => c.put(req, r.clone()))
          return r
        })
        // servers mark responses as varying by Origin; a cached copy is fine for any origin here
        .catch(() => caches.match(req, { ignoreVary: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./', { ignoreVary: true }) : undefined))),
    )
    return
  }
  // data and textures: cached, refreshed behind the scenes
  if (same) {
    e.respondWith(
      caches.open(DATA).then(async (c) => {
        const hit = await c.match(req, { ignoreVary: true })
        const net = fetch(req)
          .then((r) => {
            if (r.ok) c.put(req, r.clone())
            return r
          })
          .catch(() => hit)
        return hit || net
      }),
    )
    return
  }
  // tiles, Wikipedia and its pictures: network first, kept for offline
  if (/eox\.at|elevation-tiles-prod|gibs\.earthdata|wikipedia\.org|wikimedia\.org|wikidata\.org/.test(url.hostname)) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok || r.type === 'opaque') caches.open(REMOTE).then((c) => c.put(req, r.clone()).then(() => trim(REMOTE, REMOTE_MAX)))
          return r
        })
        .catch(() => caches.match(req, { ignoreVary: true })),
    )
  }
})
