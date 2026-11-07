import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { googleAuthConfig } from './googleAuthConfig'

const config = googleAuthConfig(import.meta.env)
const GoogleAuthContext = createContext(null)

function publicUser(user) {
  return user ? { uid: user.uid, displayName: user.displayName || '', email: user.email || '' } : null
}

// Google authentication is separate from the optional Express/JWT account. It
// never sends a Firebase token to that backend or changes the local progress.
export function GoogleAuthProvider({ children }) {
  const [status, setStatus] = useState(config ? 'loading' : 'unconfigured')
  const [user, setUser] = useState(null)
  const [initializationError, setInitializationError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const client = useRef(null)

  useEffect(() => {
    if (!config) return undefined
    let active = true
    let unsubscribe

    // Load the SDK only when an owner has configured it. It is still included
    // in the production offline app shell by the Vite precache plugin.
    Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appSdk, authSdk]) => {
      if (!active) return
      const name = 'examedge-google-auth'
      const app = appSdk.getApps().find((item) => item.name === name) || appSdk.initializeApp(config, name)
      const auth = authSdk.getAuth(app)
      client.current = { auth, authSdk }
      unsubscribe = authSdk.onAuthStateChanged(auth, (firebaseUser) => {
        if (!active) return
        setUser(publicUser(firebaseUser))
        setInitializationError(null)
        setStatus('ready')
      }, (error) => {
        if (!active) return
        setInitializationError(error?.code || 'auth/initialization-failed')
        setStatus('error')
      })
    }).catch((error) => {
      if (!active) return
      setInitializationError(error?.code || 'auth/initialization-failed')
      setStatus('error')
    })

    return () => {
      active = false
      if (unsubscribe) unsubscribe()
      client.current = null
    }
  }, [retryCount])

  const retry = useCallback(() => {
    if (!config) return
    setInitializationError(null)
    setStatus('loading')
    setRetryCount((count) => count + 1)
  }, [])

  const signIn = useCallback(async () => {
    if (!client.current) throw Object.assign(new Error('Google sign-in is not ready'), { code: 'auth/initialization-failed' })
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw Object.assign(new Error('Offline'), { code: 'auth/network-request-failed' })
    }
    const { auth, authSdk } = client.current
    const provider = new authSdk.GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    // Popup sign-in is recommended by Firebase for apps hosted outside Firebase
    // when redirect flows encounter browsers that block third-party storage.
    const result = await authSdk.signInWithPopup(auth, provider)
    return publicUser(result.user)
  }, [])

  const signOut = useCallback(async () => {
    if (!client.current) throw Object.assign(new Error('Google sign-in is not ready'), { code: 'auth/initialization-failed' })
    const { auth, authSdk } = client.current
    await authSdk.signOut(auth)
  }, [])

  const value = useMemo(() => ({ configured: Boolean(config), status, user, initializationError, signIn, signOut, retry }), [status, user, initializationError, signIn, signOut, retry])
  return <GoogleAuthContext.Provider value={value}>{children}</GoogleAuthContext.Provider>
}

export function useGoogleAuth() {
  const value = useContext(GoogleAuthContext)
  if (!value) throw new Error('useGoogleAuth must be used inside GoogleAuthProvider')
  return value
}
