import React, { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, CircleMinus, Clock3, FileText, RotateCcw, Sparkles, Target, XCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { examById, TOPICS, SUBJECTS } from '../data/exams'
import { QUESTIONS } from '../data/questions'
import { formatTime, shortDate } from '../lib/utils'

export default function Results({ attemptId }) {
  const { state, toggleBookmark } = useStore()
  const L = useL()
  const [tab, setTab] = useState('overview')
  const [filter, setFilter] = useState('all')
  const attempt = state.attempts.find((item) => item.id === attemptId)
  const exam = attempt ? examById(attempt.examId) : null

  const analysis = useMemo(() => {
    if (!attempt) return { questions: [], topics: [], subjects: [] }
    const questions = (attempt.perQuestion || []).map((record) => ({ ...record, question: QUESTIONS.find((q) => q.id === record.qid) })).filter((record) => record.question)
    const topicMap = {}
    const subjectMap = {}
    questions.forEach(({ question, chosen }) => {
      if (chosen == null || chosen < 0) return
      const subject = TOPICS[question.topic]?.subject
      const topic = topicMap[question.topic] || (topicMap[question.topic] = { id: question.topic, attempted: 0, correct: 0 })
      topic.attempted += 1
      if (chosen === question.a) topic.correct += 1
      if (subject) {
        const summary = subjectMap[subject] || (subjectMap[subject] = { id: subject, attempted: 0, correct: 0 })
        summary.attempted += 1
        if (chosen === question.a) summary.correct += 1
      }
    })
    return { questions, topics: Object.values(topicMap), subjects: Object.values(subjectMap) }
  }, [attempt])

  if (!attempt || !exam) return <div className="directory-empty"><h3>{L({ en: 'Result not found', hi: 'परिणाम नहीं मिला' })}</h3><p>{L({ en: 'This result may no longer be available on this device.', hi: 'यह परिणाम इस डिवाइस पर उपलब्ध नहीं है।' })}</p><button className="btn primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}</button></div>

  const answered = attempt.correct + attempt.wrong
  const accuracy = answered ? Math.round((attempt.correct / answered) * 100) : 0
  const scorePercent = attempt.maxScore > 0 ? Math.max(0, Math.min(100, (attempt.score / attempt.maxScore) * 100)) : 0
  const shown = analysis.questions.filter(({ question, chosen }) => {
    if (filter === 'correct') return chosen === question.a
    if (filter === 'wrong') return chosen >= 0 && chosen !== question.a
    if (filter === 'skipped') return chosen == null || chosen < 0
    return true
  })

  const metrics = [
    { icon: CheckCircle2, label: L({ en: 'Correct', hi: 'सही' }), value: attempt.correct, tone: 'green' },
    { icon: XCircle, label: L({ en: 'Incorrect', hi: 'गलत' }), value: attempt.wrong, tone: 'pink' },
    { icon: CircleMinus, label: L({ en: 'Unanswered', hi: 'अनुत्तरित' }), value: attempt.unattempted, tone: 'orange' },
    { icon: Clock3, label: L({ en: 'Time spent', hi: 'लगा समय' }), value: formatTime(attempt.timeSpent || 0), tone: 'blue' },
  ]

  return <div className="result-page page-shell">
    <div className="exam-breadcrumb"><button onClick={() => navigate(`/exam/${exam.id}`)}><ArrowLeft size={14} /> {L({ en: 'Back to preparation', hi: 'तैयारी पर वापस जाएँ' })}</button><span> / </span><span>{L({ en: 'Your result', hi: 'आपका परिणाम' })}</span></div>
    <section className="result-hero"><div className="result-hero-copy"><div className="section-kicker"><span className="kicker-dot" /> {L({ en: 'SESSION COMPLETE', hi: 'सत्र पूरा हुआ' })}</div><h1>{L({ en: 'Every attempt is progress.', hi: 'हर प्रयास एक प्रगति है।' })}</h1><p>{L({ en: 'Take a moment to review what you learned.', hi: 'एक पल रुकें और अपनी सीख को देखें।' })}</p><div className="result-session"><span>{exam.name}</span><span>·</span><span>{attempt.title}</span><span>·</span><span>{shortDate(attempt.date)}</span></div><div className="result-actions"><button className="exam-primary" onClick={() => setTab('review')}>{L({ en: 'Review answers', hi: 'उत्तर देखें' })}<ArrowRight size={15} /></button>{attempt.testId !== 'ca-daily' && <button className="target-button" onClick={() => navigate(`/test/${attempt.examId}/${attempt.testId}?mode=${attempt.mode}`)}><RotateCcw size={14} /> {L({ en: 'Try again', hi: 'फिर से करें' })}</button>}</div></div><div className="result-score-ring" style={{ background: `conic-gradient(var(--ee-progress) ${scorePercent}%, var(--ee-progress-track) 0)` }}><div><span>{L({ en: 'PRACTICE SCORE', hi: 'अभ्यास स्कोर' })}</span><strong>{attempt.score}<small> / {attempt.maxScore}</small></strong><small>{L({ en: 'marks', hi: 'अंक' })}</small></div></div></section>

    <div className="result-metrics">{metrics.map(({ icon: Icon, label, value, tone }) => <div className={`result-metric result-${tone}`} key={label}><span className={`result-metric-icon ${tone}`}><Icon size={19} /></span><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>

    <div className="exam-tabs result-tabs" role="tablist" aria-label="Result sections">{[
      ['overview', L({ en: 'Overview', hi: 'अवलोकन' })], ['topics', L({ en: 'Topic analysis', hi: 'टॉपिक विश्लेषण' })], ['review', L({ en: 'Question review', hi: 'प्रश्न समीक्षा' })],
    ].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>

    {tab === 'overview' && <div className="result-overview"><div className="result-panel"><div className="result-panel-head"><div><div className="section-kicker">{L({ en: 'THE BREAKDOWN', hi: 'विस्तृत जानकारी' })}</div><h2>{L({ en: 'Your performance', hi: 'आपका प्रदर्शन' })}</h2><p>{L({ en: 'A snapshot of this practice session.', hi: 'इस अभ्यास सत्र की एक झलक।' })}</p></div><span className="result-accuracy">{answered ? `${accuracy}%` : '—'}<small>{L({ en: 'accuracy', hi: 'सटीकता' })}</small></span></div><div className="result-distribution"><span style={{ width: `${attempt.totalQuestions ? attempt.correct / attempt.totalQuestions * 100 : 0}%` }} /><span style={{ width: `${attempt.totalQuestions ? attempt.wrong / attempt.totalQuestions * 100 : 0}%` }} /><span style={{ width: `${attempt.totalQuestions ? attempt.unattempted / attempt.totalQuestions * 100 : 0}%` }} /></div><div className="result-legend"><span><i />{L({ en: 'Correct', hi: 'सही' })} {attempt.correct}</span><span><i />{L({ en: 'Incorrect', hi: 'गलत' })} {attempt.wrong}</span><span><i />{L({ en: 'Unanswered', hi: 'अनुत्तरित' })} {attempt.unattempted}</span></div><div className="result-divider" /><h3>{L({ en: 'By subject', hi: 'विषयवार' })}</h3>{analysis.subjects.length ? <div className="result-progress-list">{analysis.subjects.map((subject) => <PerformanceRow key={subject.id} title={L({ en: SUBJECTS[subject.id]?.name || subject.id, hi: SUBJECTS[subject.id]?.hi || subject.id })} item={subject} />)}</div> : <p className="result-empty">{L({ en: 'Answer a question to see your subject-wise performance.', hi: 'विषयवार प्रदर्शन देखने के लिए प्रश्नों के उत्तर दें।' })}</p>}</div><aside className="result-next" aria-label="Next steps"><span><Sparkles size={21} /></span><div className="section-kicker">{L({ en: 'KEEP THE MOMENTUM', hi: 'गति बनाए रखें' })}</div><h3>{L({ en: 'Ready for your next step?', hi: 'अगले कदम के लिए तैयार?' })}</h3><p>{L({ en: 'Review your answers, then continue with a topic that needs a little more attention.', hi: 'अपने उत्तर देखें और फिर किसी टॉपिक का अभ्यास करें।' })}</p><button onClick={() => setTab('review')}>{L({ en: 'Review this session', hi: 'इस सत्र की समीक्षा करें' })}<ArrowRight size={15} /></button></aside></div>}

    {tab === 'topics' && <div className="result-panel result-single"><div className="section-kicker">{L({ en: 'FIND YOUR FOCUS', hi: 'अपना ध्यान चुनें' })}</div><h2>{L({ en: 'Topic-wise performance', hi: 'टॉपिकवार प्रदर्शन' })}</h2><p>{L({ en: 'Based on questions you answered in this session.', hi: 'इस सत्र में आपके उत्तर दिए प्रश्नों के आधार पर।' })}</p>{analysis.topics.length ? <div className="result-progress-list">{analysis.topics.map((topic) => <PerformanceRow key={topic.id} title={L({ en: TOPICS[topic.id]?.name || topic.id, hi: TOPICS[topic.id]?.hi || topic.id })} item={topic} />)}</div> : <p className="result-empty">{L({ en: 'No answered questions to analyse yet.', hi: 'विश्लेषण के लिए अभी उत्तर दिए प्रश्न नहीं हैं।' })}</p>}</div>}

    {tab === 'review' && <div className="review-section"><div className="review-heading"><div><div className="section-kicker">{L({ en: 'LEARN FROM EVERY QUESTION', hi: 'हर प्रश्न से सीखें' })}</div><h2>{L({ en: 'Question review', hi: 'प्रश्न समीक्षा' })}</h2><p>{L({ en: 'Review your choices and the available explanations.', hi: 'अपने उत्तर और उपलब्ध समाधान देखें।' })}</p></div><div className="review-filters">{[['all', 'All', 'सभी'], ['correct', 'Correct', 'सही'], ['wrong', 'Incorrect', 'गलत'], ['skipped', 'Unanswered', 'अनुत्तरित']].map(([id, en, hi]) => <button key={id} className={filter === id ? 'selected' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{L({ en, hi })}</button>)}</div></div>{shown.length ? <div className="review-list">{shown.map(({ qid, chosen, question }, index) => {
      const status = chosen == null || chosen < 0 ? 'skipped' : chosen === question.a ? 'correct' : 'wrong'
      const bookmarked = state.bookmarks.includes(qid)
      return <article className="review-card" key={qid}><div className="review-card-top"><span className={`review-status ${status}`}>{status === 'correct' ? L({ en: 'Correct', hi: 'सही' }) : status === 'wrong' ? L({ en: 'Incorrect', hi: 'गलत' }) : L({ en: 'Unanswered', hi: 'अनुत्तरित' })}</span><span className="review-topic">{L({ en: TOPICS[question.topic]?.name || '', hi: TOPICS[question.topic]?.hi || '' })}</span><button className={bookmarked ? 'saved' : ''} onClick={() => toggleBookmark(qid)} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}><Bookmark size={17} fill={bookmarked ? 'currentColor' : 'none'} /></button></div><h3>{L(question.q)}</h3><div className="review-answers"><div><span>{L({ en: 'Your answer', hi: 'आपका उत्तर' })}</span><strong>{chosen >= 0 ? L(question.o[chosen]) : L({ en: 'Not answered', hi: 'उत्तर नहीं दिया' })}</strong></div><div><span>{L({ en: 'Correct answer', hi: 'सही उत्तर' })}</span><strong>{L(question.o[question.a])}</strong></div></div><div className="review-explanation"><strong>{L({ en: 'Explanation', hi: 'समाधान' })}</strong><p>{L(question.exp)}</p></div></article>
    })}</div> : <div className="test-empty">{L({ en: 'No questions to show for this filter.', hi: 'इस फ़िल्टर में दिखाने के लिए कोई प्रश्न नहीं है।' })}</div>}</div>}
  </div>
}

function PerformanceRow({ title, item }) {
  const percent = item.attempted ? Math.round(item.correct / item.attempted * 100) : 0
  return <div className="performance-row"><div><strong>{title}</strong><span>{item.correct}/{item.attempted} · {percent}%</span></div><div className="performance-track"><span style={{ width: `${percent}%` }} /></div></div>
}
