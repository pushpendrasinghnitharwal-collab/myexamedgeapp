import { useStore } from './store'
import { useCallback } from 'react'

// Picks the right language variant of a bilingual object.
export function useL() {
  const { state } = useStore()
  const lang = state.settings.lang
  return useCallback((obj) => {
    if (obj == null) return ''
    if (typeof obj === 'string') return obj
    return obj[lang] ?? obj.en ?? ''
  }, [lang])
}

export function useLang() {
  const { state } = useStore()
  return state.settings.lang
}

export const T = (obj, lang = 'en') => {
  if (obj == null) return ''
  if (typeof obj === 'string') return obj
  return obj[lang] ?? obj.en ?? ''
}
