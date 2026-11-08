import React from 'react'
import { Newspaper } from 'lucide-react'
import { useL } from '../lib/i18n'
import { navigate } from '../lib/router'

export default function CurrentAffairs() {
  const L = useL()
  return <div className="page-shell">
    <div className="page-head"><div><h1 className="page-title">{L({ en: 'Current affairs', hi: 'करेंट अफेयर्स' })}</h1><p className="page-sub">{L({ en: 'A fresh, source-reviewed collection is being prepared.', hi: 'स्रोतों से जाँचा हुआ नया संग्रह तैयार किया जा रहा है।' })}</p></div></div>
    <div className="directory-empty"><span><Newspaper size={24} aria-hidden="true" /></span><h2>{L({ en: 'Nothing published yet', hi: 'अभी कुछ प्रकाशित नहीं है' })}</h2><p>{L({ en: 'The previous sample stories and quiz were retired. New current-affairs material has not been added yet.', hi: 'पुराने नमूना समाचार और क्विज़ हटा दिए गए हैं। नई करेंट अफेयर्स सामग्री अभी नहीं जोड़ी गई है।' })}</p><button className="btn primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}</button></div>
  </div>
}
