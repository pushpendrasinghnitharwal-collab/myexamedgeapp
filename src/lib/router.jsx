import { useEffect, useState, useCallback } from 'react'

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/')

  useEffect(() => {
    const on = () => {
      setHash(window.location.hash.slice(1) || '/')
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const navigate = useCallback((path) => {
    window.location.hash = path
  }, [])

  const parts = hash.split('/').filter(Boolean)
  return { path: hash, parts, navigate }
}

export function navigate(path) {
  window.location.hash = path
}
