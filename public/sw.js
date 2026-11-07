const CACHE = 'examedge-v9'
const CORE = [
  '/', '/index.html', '/manifest.webmanifest', '/icon.svg?v=2',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/icon-maskable.svg?v=2', '/apple-touch-icon.png',
  '/images/dashboard-new.webp', '/images/exams-new.webp', '/images/library-new.webp',
  '/images/study-orbit.webp', '/images/exam-discovery.webp',
]
// Replaced with Vite's fingerprinted app shell during production builds.
const BUILD_ASSETS = /* __BUILD_ASSETS__ */ []

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...CORE, ...BUILD_ASSETS])).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('examedge-') && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Cache-first for assets, network-first for navigation (so updates ship fast).
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match('/index.html')))
    )
    return
  }

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      // Fingerprinted build assets are the same regardless of Origin. Some
      // hosts add `Vary: Origin`, while pre-cache requests have no Origin header;
      // ignoring Vary here lets module scripts and fonts work offline.
      cache.match(req, { ignoreVary: url.pathname.startsWith('/assets/') }).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone())
          }
          return res
        })
      )
    )
  )
})
