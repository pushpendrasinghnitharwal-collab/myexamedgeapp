import React from 'react'
import { ArrowLeft, CheckCircle2, CircleMinus, Clock3, XCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { examById } from '../data/exams'
import { formatTime, shortDate } from '../lib/utils'

// Preserve historical scores, but never recreate deleted question content or
// present scores from the old unverified bank as official SSC marks.
export default function Results({ attemptId }) {
  const { state } = useStore()
  const L = useL()
  const attempt = state.attempts.find((item) => item.id === attemptId)
  const exam = attempt ? examById(attempt.examId) : null
  if (!attempt || !exam) return <div className="directory-empty"><h1>{L({ en: 'Result not found', hi: 'परिणाम नहीं मिला' })}</h1><button className="btn primary" onClick={() => navigate('/profile')}>{L({ en: 'Back to profile', hi: 'प्रोफ़ाइल पर जाएँ' })}</button></div>
  const percent = attempt.maxScore > 0 ? Math.max(0, Math.min(100, attempt.score / attempt.maxScore * 100)) : 0
  const metrics = [
    { icon: CheckCircle2, label: L({ en: 'Correct', hi: 'सही' }), value: attempt.correct, tone: 'green' },
    { icon: XCircle, label: L({ en: 'Incorrect', hi: 'गलत' }), value: attempt.wrong, tone: 'pink' },
    { icon: CircleMinus, label: L({ en: 'Unanswered', hi: 'अनुत्तरित' }), value: attempt.unattempted, tone: 'orange' },
    { icon: Clock3, label: L({ en: 'Time spent', hi: 'लगा समय' }), value: formatTime(attempt.timeSpent || 0), tone: 'blue' },
  ]
  return <div className="result-page page-shell">
    <div className="exam-breadcrumb"><button onClick={() => navigate('/profile')}><ArrowLeft size={14} /> {L({ en: 'Back to profile', hi: 'प्रोफ़ाइल पर जाएँ' })}</button></div>
    <section className="result-hero"><div className="result-hero-copy"><div className="section-kicker">{L({ en: 'SAVED HISTORY', hi: 'सहेजा इतिहास' })}</div><h1>{L({ en: 'Your previous practice', hi: 'आपका पिछला अभ्यास' })}</h1><p>{L({ en: 'This result is from the retired, unverified question bank and is not an official SSC score.', hi: 'यह परिणाम हटाए गए असत्यापित प्रश्न बैंक से है और आधिकारिक SSC स्कोर नहीं है।' })}</p><div className="result-session"><span>{exam.name}</span><span>·</span><span>{attempt.title}</span><span>·</span><span>{shortDate(attempt.date)}</span></div></div><div className="result-score-ring" style={{ background: `conic-gradient(var(--ee-progress) ${percent}%, var(--ee-progress-track) 0)` }}><div><span>{L({ en: 'PRACTICE SCORE', hi: 'अभ्यास स्कोर' })}</span><strong>{attempt.score}<small> / {attempt.maxScore}</small></strong><small>{L({ en: 'marks', hi: 'अंक' })}</small></div></div></section>
    <div className="result-metrics">{metrics.map(({ icon: Icon, label, value, tone }) => <div className={`result-metric result-${tone}`} key={label}><span className={`result-metric-icon ${tone}`}><Icon size={19} aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>
    <div className="result-panel result-single"><h2>{L({ en: 'Question review unavailable', hi: 'प्रश्न समीक्षा उपलब्ध नहीं है' })}</h2><p>{L({ en: 'The old questions were removed. This score and your saved notes remain on your device.', hi: 'पुराने प्रश्न हटा दिए गए हैं। यह स्कोर और आपके सहेजे नोट इस डिवाइस पर सुरक्षित हैं।' })}</p></div>
  </div>
}
