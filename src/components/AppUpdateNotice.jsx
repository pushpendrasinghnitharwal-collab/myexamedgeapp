import React, { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useL } from '../lib/i18n'

// Never reload automatically: a learner might be in the middle of a test.
export default function AppUpdateNotice({ route }) {
  const [updateReady, setUpdateReady] = useState(false)
  const L = useL()
  const path = route.split('?')[0]
  const inTest = path === '/test' || path.startsWith('/test/')

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    // Vite source modules should never be cached during development.
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()))
      return undefined
    }

    let active = true
    let registration
    let lastCheck = 0
    let hadController = Boolean(navigator.serviceWorker.controller)
    const onControllerChange = () => {
      // The first install is not an update to the page already being used.
      if (hadController) setUpdateReady(true)
      hadController = true
    }
    const checkForUpdate = (force = false) => {
      if (!registration || navigator.onLine === false || (!force && Date.now() - lastCheck < 60000)) return
      lastCheck = Date.now()
      registration.update().catch(() => {})
    }
    const register = () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((result) => {
      if (!active) return
      registration = result
      checkForUpdate(true)
    }).catch(() => {})
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
    const onOnline = () => checkForUpdate(true)

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => {
      active = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('load', register)
    }
  }, [])

  if (!updateReady) return null
  return (
    <aside className="app-update" role="status">
      <span className="app-update-icon"><RefreshCw size={18} aria-hidden="true" /></span>
      <div className="app-update-copy">
        <strong>{L({ en: 'An update is ready', hi: 'नया अपडेट तैयार है' })}</strong>
        <span>{inTest
          ? L({ en: 'Finish your test before refreshing.', hi: 'रिफ्रेश करने से पहले अपना टेस्ट पूरा करें।' })
          : L({ en: 'Refresh when you are ready.', hi: 'तैयार होने पर रिफ्रेश करें।' })}</span>
      </div>
      {!inTest && <button type="button" className="app-update-action" onClick={() => window.location.reload()}>{L({ en: 'Refresh', hi: 'रिफ्रेश' })}</button>}
      <button type="button" className="app-update-close" aria-label={L({ en: 'Dismiss update notice', hi: 'अपडेट सूचना बंद करें' })} onClick={() => setUpdateReady(false)}><X size={16} aria-hidden="true" /></button>
    </aside>
  )
}
