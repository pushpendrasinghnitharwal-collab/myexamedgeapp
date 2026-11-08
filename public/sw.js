const CACHE = 'examedge-v15'
const CORE = [
  '/', '/index.html', '/manifest.webmanifest', '/icon.svg?v=2',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/icon-maskable.svg?v=2', '/apple-touch-icon.png',
  '/images/dashboard-new.webp', '/images/exams-new.webp', '/images/library-new.webp',
  '/images/study-orbit.webp', '/images/exam-discovery.webp', '/images/edge-momentum.webp',
]
// Replaced with Vite's fingerprinted app shell during production builds.
const BUILD_ASSETS = /* __BUILD_ASSETS__ */ []

self.addEventListener('install', (e) => {
  // Keep the current worker if the new offline shell cannot be downloaded.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...CORE, ...BUILD_ASSETS])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      // An already-open page can still need lazy, fingerprinted files from its
      // original release. Keep the two previous shells until a later upgrade.
      const previous = keys.filter((key) => key.startsWith('examedge-') && key !== CACHE).slice(-2)
      return Promise.all([
        ...keys.filter((key) => key.startsWith('examedge-') && key !== CACHE && !previous.includes(key)).map((key) => caches.delete(key)),
        // Versions through v12 bundled the retired question bank in main-*.js.
        // Remove those cached bundles while keeping old lazy chunks for open tabs.
        ...previous.filter((key) => /^examedge-v(?:[1-9]|1[0-2])$/.test(key)).map(async (key) => {
          const cache = await caches.open(key)
          const requests = await cache.keys()
          await Promise.all(requests.filter((request) => /^\/assets\/main-[^/]+\.js$/.test(new URL(request.url).pathname))
            .map((request) => cache.delete(request, { ignoreVary: true })))
        }),
      ])
    }).then(() => self.clients.claim())
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
      fetch(req, { cache: 'no-store' })
        .then(async (res) => {
          // Do not replace the offline shell with a server error or non-HTML.
          if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
            try { await (await caches.open(CACHE)).put('/index.html', res.clone()) } catch { /* keep the previous shell */ }
          }
          return res
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match('/index.html')))
    )
    return
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Fingerprinted files are identical regardless of Origin. Some hosts add
      // `Vary: Origin`, so ignore it for these assets to keep offline working.
      const fingerprinted = url.pathname.startsWith('/assets/')
      let hit = await cache.match(req, { ignoreVary: fingerprinted })
      if (!hit && fingerprinted) {
        // Keep lazy imports in an older open tab working after an upgrade.
        const previous = (await caches.keys()).filter((key) => key.startsWith('examedge-') && key !== CACHE).reverse()
        for (const key of previous) {
          hit = await (await caches.open(key)).match(req, { ignoreVary: true })
          if (hit) break
        }
      }
      if (hit) return hit
      const res = await fetch(req)
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone())
      return res
    })
  )
})
