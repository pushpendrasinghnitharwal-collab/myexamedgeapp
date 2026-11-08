import React from 'react'
import { Swords } from 'lucide-react'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'

export default function Challenges() {
  const L = useL()
  return <div className="directory-empty page-shell"><span><Swords size={24} aria-hidden="true" /></span><h1>{L({ en: 'No challenges available', hi: 'अभी कोई चुनौती उपलब्ध नहीं है' })}</h1><p>{L({ en: 'Previous sample challenges were retired with the old test bank.', hi: 'पुराने टेस्ट बैंक के साथ नमूना चुनौतियाँ भी हटा दी गई हैं।' })}</p><button className="btn primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}</button></div>
}
