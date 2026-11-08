import React from 'react'
import { ArrowRight, Bookmark, BookOpen, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'

export default function Bookmarks() {
  const { state } = useStore()
  const L = useL()
  const hasOldReferences = state.bookmarks.length > 0
  const savedNotes = Object.entries(state.notes || {}).filter(([, text]) => typeof text === 'string' && text.trim())
  return <div className="bookmarks-page page-shell">
    <section className="saved-hero" aria-labelledby="saved-title">
      <div className="saved-hero-copy"><div className="section-kicker"><Sparkles size={14} aria-hidden="true" /> {L({ en: 'YOUR REVISION SPACE', hi: 'आपकी दोहराव की जगह' })}</div><h1 id="saved-title">{L({ en: 'Saved questions', hi: 'सहेजे गए प्रश्न' })}</h1><p>{L({ en: 'Your space for questions you want to revisit.', hi: 'उन प्रश्नों की जगह जिन्हें आप फिर से दोहराना चाहते हैं।' })}</p></div>
      <div className="saved-total"><Bookmark size={20} aria-hidden="true" /><div><strong>0</strong><small>{L({ en: 'questions available', hi: 'प्रश्न उपलब्ध' })}</small></div></div>
    </section>
    <div className="saved-empty"><span className="saved-empty-icon"><BookOpen size={27} aria-hidden="true" /></span><h2>{L({ en: 'A fresh question bank is being prepared', hi: 'नया प्रश्न बैंक तैयार हो रहा है' })}</h2><p>{hasOldReferences ? L({ en: 'Questions from the retired bank can no longer be displayed. Your saved references and notes remain on this device.', hi: 'पुराने प्रश्न बैंक के प्रश्न अब नहीं दिखाए जा सकते। आपके सहेजे संदर्भ और नोट इस डिवाइस पर सुरक्षित हैं।' }) : L({ en: 'There are no questions available to save yet.', hi: 'अभी सहेजने के लिए कोई प्रश्न उपलब्ध नहीं है।' })}</p><button className="exam-primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}<ArrowRight size={16} aria-hidden="true" /></button></div>
    {savedNotes.length > 0 && <section className="result-panel" aria-labelledby="saved-notes-title" style={{ marginTop: 20 }}>
      <h2 id="saved-notes-title">{L({ en: 'Your saved notes', hi: 'आपके सहेजे नोट्स' })}</h2>
      <p>{L({ en: 'Notes remain here even though their old questions are unavailable.', hi: 'पुराने प्रश्न उपलब्ध नहीं हैं, पर आपके नोट यहाँ सुरक्षित हैं।' })}</p>
      <div className="stack" style={{ gap: 12 }}>{savedNotes.map(([id, text]) => <article key={id} className="card" style={{ overflowWrap: 'anywhere' }}><span className="tiny muted">{L({ en: 'Retired question reference', hi: 'पुराने प्रश्न का संदर्भ' })}: {id}</span><p style={{ whiteSpace: 'pre-wrap' }}>{text}</p></article>)}</div>
    </section>}
  </div>
}
