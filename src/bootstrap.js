// A previous release registered a cache-first service worker even in the dev
// preview. Clear that worker before loading Vite modules, otherwise it can keep
// serving an older app indefinitely. Learner data in localStorage is untouched.
async function start() {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    try {
      const root = new URL('/', location.href).href
      const registrations = await navigator.serviceWorker.getRegistrations()
      const previous = registrations.filter((registration) => {
        const worker = registration.active || registration.waiting || registration.installing
        return registration.scope === root && worker && new URL(worker.scriptURL).pathname === '/sw.js'
      })
      const wasControlled = Boolean(navigator.serviceWorker.controller)
      await Promise.all(previous.map((registration) => registration.unregister()))
      if (previous.length && wasControlled) {
        if ('caches' in window) {
          const names = await caches.keys()
          await Promise.all(names.filter((name) => name.startsWith('examedge-')).map((name) => caches.delete(name)))
        }
        // An unregistered worker still controls this document until navigation.
        location.reload()
        return
      }
    } catch (error) {
      // Cache cleanup should not prevent the app from opening.
      console.warn('Could not clear the previous preview cache:', error)
    }
  }
  await import('./main.jsx')
}

start()
