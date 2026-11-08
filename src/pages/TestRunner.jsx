import React from 'react'
import { BookOpen } from 'lucide-react'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'

// Old deep links must fail safely instead of rebuilding a retired mock.
export default function TestRunner() {
  const L = useL()
  return <div className="directory-empty page-shell">
    <span><BookOpen size={24} aria-hidden="true" /></span>
    <h1>{L({ en: 'This practice set is no longer available', hi: 'यह अभ्यास सेट अब उपलब्ध नहीं है' })}</h1>
    <p>{L({ en: 'The previous question bank was retired while a new SSC CGL bank is being prepared. Your saved attempt history stays on this device.', hi: 'नया SSC CGL प्रश्न बैंक तैयार होने के दौरान पुराना प्रश्न बैंक हटा दिया गया है। आपके पुराने प्रयास इस डिवाइस पर सुरक्षित हैं।' })}</p>
    <button className="btn primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}</button>
  </div>
}
