import React, { useMemo, useState } from 'react'
import { ArrowRight, BarChart3, Bookmark, BookOpen, ChevronDown, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { QUESTIONS } from '../data/questions'
import { TOPICS, SUBJECTS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, Pill, Button, useToast } from '../components/ui'

const KEYS = ['A', 'B', 'C', 'D', 'E']
const difficulties = {
  easy: { en: 'Easy', hi: 'आसान' },
  medium: { en: 'Medium', hi: 'मध्यम' },
  hard: { en: 'Hard', hi: 'कठिन' },
}

export default function Bookmarks() {
  const { state, toggleBookmark } = useStore()
  const L = useL()
  const toast = useToast()
  const [open, setOpen] = useState(null)

  const saved = useMemo(
    () => state.bookmarks.map((id) => QUESTIONS.find((q) => q.id === id)).filter(Boolean),
    [state.bookmarks]
  )

  return (
    <div className="bookmarks-page page-shell">
      <section className="saved-hero" aria-labelledby="saved-title">
        <div className="saved-hero-copy">
          <div className="section-kicker"><Sparkles size={14} aria-hidden="true" /> {L({ en: 'YOUR REVISION SPACE', hi: 'आपकी दोहराव की जगह' })}</div>
          <h1 id="saved-title">{L({ en: 'Saved questions', hi: 'सहेजे गए प्रश्न' })}</h1>
          <p>{L({ en: 'A little collection for the topics you want to revisit.', hi: 'उन प्रश्नों का संग्रह जिन्हें आप फिर से दोहराना चाहते हैं।' })}</p>
        </div>
        <div className="saved-total"><Bookmark size={20} aria-hidden="true" /><div><strong>{saved.length}</strong><small>{L({ en: saved.length === 1 ? 'question saved' : 'questions saved', hi: 'प्रश्न सहेजे' })}</small></div></div>
      </section>

      {saved.length ? <>
        <div className="saved-section-head"><div><span className="section-kicker">{L({ en: 'PICK UP WHERE YOU LEFT OFF', hi: 'जहाँ छोड़ा था, वहीं से शुरू करें' })}</span><h2>{L({ en: 'Ready to revise', hi: 'दोहराने के लिए तैयार' })}</h2><p>{L({ en: 'Saved on this device.', hi: 'इसी डिवाइस पर सहेजे गए हैं।' })}</p></div><button className="text-link" onClick={() => navigate('/analytics')}><BarChart3 size={16} aria-hidden="true" /> {L({ en: 'Your progress', hi: 'आपकी प्रगति' })}</button></div>
        <div className="saved-list">
          {saved.map((q, index) => {
            const isOpen = open === q.id
            const topic = TOPICS[q.topic]
            return (
              <Card key={q.id} className="saved-question">
                <div className="saved-question-head">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Pill tone="brand">{L({ en: topic?.name || q.topic, hi: topic?.hi || topic?.name || q.topic })}</Pill>
                    {topic && SUBJECTS[topic.subject] && <Pill>{SUBJECTS[topic.subject].short}</Pill>}
                    <Pill tone={q.diff === 'easy' ? 'success' : q.diff === 'medium' ? 'warn' : 'danger'}>{L(difficulties[q.diff] || { en: q.diff, hi: q.diff })}</Pill>
                  </div>
                  <button type="button" className="saved-remove" aria-label={L({ en: `Remove saved question ${index + 1}`, hi: `सहेजा प्रश्न ${index + 1} हटाएँ` })} onClick={() => {
                    toggleBookmark(q.id)
                    toast(L({ en: 'Removed from saved questions', hi: 'सहेजे प्रश्नों से हटाया गया' }), '✓')
                  }}><Bookmark size={18} fill="currentColor" aria-hidden="true" /></button>
                </div>
                <div className="q-text saved-question-text">{L(q.q)}</div>
                {isOpen && <div id={`saved-answer-${q.id}`}>
                  {q.o.map((option, i) => <div key={i} className={`option ${i === q.a ? 'correct' : ''}`} style={{ cursor: 'default' }}>
                    <div className="opt-key">{KEYS[i]}</div><div style={{ flex: 1 }}>{L(option)}</div>{i === q.a && <span className="pill success">✓</span>}
                  </div>)}
                  <div className="explain" style={{ marginTop: 12 }}><b>{L({ en: 'Solution: ', hi: 'समाधान: ' })}</b>{L(q.exp)}</div>
                </div>}
                <Button size="sm" className="saved-reveal" aria-expanded={isOpen} aria-controls={isOpen ? `saved-answer-${q.id}` : undefined} onClick={() => setOpen(isOpen ? null : q.id)}>
                  {isOpen ? L({ en: 'Hide answer & solution', hi: 'उत्तर और समाधान छिपाएँ' }) : L({ en: 'Show answer & solution', hi: 'उत्तर और समाधान दिखाएँ' })}<ChevronDown size={15} className={isOpen ? 'is-open' : ''} aria-hidden="true" />
                </Button>
              </Card>
            )
          })}
        </div>
      </> : <div className="saved-empty">
        <span className="saved-empty-icon"><BookOpen size={27} aria-hidden="true" /></span>
        <h2>{L({ en: 'Your revision list starts here', hi: 'आपकी दोहराव सूची यहाँ से शुरू होती है' })}</h2>
        <p>{L({ en: 'Use the bookmark icon during a practice session to save a question for later.', hi: 'अभ्यास के दौरान बुकमार्क आइकन से प्रश्न बाद के लिए सहेजें।' })}</p>
        <button className="exam-primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore practice', hi: 'अभ्यास देखें' })}<ArrowRight size={16} aria-hidden="true" /></button>
      </div>}
    </div>
  )
}
