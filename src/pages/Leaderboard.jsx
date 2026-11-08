import React from 'react'
import { Trophy } from 'lucide-react'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'

export default function Leaderboard() {
  const L = useL()
  return <div className="directory-empty page-shell"><span><Trophy size={24} aria-hidden="true" /></span><h1>{L({ en: 'No leaderboard available yet', hi: 'अभी लीडरबोर्ड उपलब्ध नहीं है' })}</h1><p>{L({ en: 'The sample rankings were retired. Your own previous results remain in your profile.', hi: 'नमूना रैंकिंग हटा दी गई है। आपके पुराने परिणाम प्रोफ़ाइल में सुरक्षित हैं।' })}</p><button className="btn primary" onClick={() => navigate('/profile')}>{L({ en: 'View my profile', hi: 'मेरी प्रोफ़ाइल देखें' })}</button></div>
}
