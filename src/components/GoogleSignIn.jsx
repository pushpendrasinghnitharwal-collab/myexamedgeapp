import React, { useState } from 'react'
import { useGoogleAuth } from '../lib/googleAuth'
import { googleAuthError } from '../lib/googleAuthConfig'
import { useL } from '../lib/i18n'

export function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11.03a9.43 9.43 0 0 1-4.09 6.2v4.81h6.62c3.87-3.56 6.05-8.8 6.05-14.51Z" />
      <path fill="#34A853" d="M24 44.5c5.53 0 10.17-1.83 13.56-4.97l-6.62-5.37c-1.83 1.22-4.17 1.94-6.94 1.94-5.34 0-9.86-3.6-11.48-8.44H5.68v4.96C9.05 39.73 16 44.5 24 44.5Z" />
      <path fill="#FBBC05" d="M12.52 27.66a12.3 12.3 0 0 1 0-7.32v-4.96H5.68a20.5 20.5 0 0 0 0 17.24l6.84-4.96Z" />
      <path fill="#EA4335" d="M24 11.9c3.01 0 5.72 1.04 7.85 3.08l5.9-5.9C34.16 5.74 29.53 3.5 24 3.5 16 3.5 9.05 8.27 5.68 15.38l6.84 4.96C14.14 15.5 18.66 11.9 24 11.9Z" />
    </svg>
  )
}

export function GoogleSignInButton({ onSuccess, className = '' }) {
  const { status, signIn, initializationError, retry } = useGoogleAuth()
  const L = useL()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const displayedError = error || (status === 'error' ? initializationError || 'auth/initialization-failed' : null)

  const handleSignIn = async () => {
    if (busy || status !== 'ready') return
    setError(null)
    setBusy(true)
    try {
      const user = await signIn()
      if (user) onSuccess?.(user)
    } catch (err) {
      setError(err?.code || 'auth/unknown')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`google-signin ${className}`}>
      <button type="button" className="google-signin-button" onClick={handleSignIn} disabled={busy || status !== 'ready'}>
        <GoogleMark />
        <span>{busy ? L({ en: 'Opening Google…', hi: 'Google खुल रहा है…' }) : status === 'loading' ? L({ en: 'Getting sign-in ready…', hi: 'साइन इन तैयार हो रहा है…' }) : L({ en: 'Continue with Google', hi: 'Google से आगे बढ़ें' })}</span>
      </button>
      {displayedError && <p className="google-signin-error" role="alert">{L(googleAuthError(displayedError))}</p>}
      {status === 'error' && <button type="button" className="google-signin-retry" onClick={() => { setError(null); retry() }}>{L({ en: 'Try again', hi: 'फिर कोशिश करें' })}</button>}
    </div>
  )
}
