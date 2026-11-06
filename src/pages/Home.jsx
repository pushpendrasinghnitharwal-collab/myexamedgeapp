import React, { useMemo } from 'react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BookOpen, CalendarDays,
  CheckCircle2, ChevronRight, Clock3, FileClock, Flame, GraduationCap, Layers3,
  Play, Sparkles, Target, TrendingUp,
} from 'lucide-react'
import { useStore, useAttemptStats, useCurrentStreak } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { EXAMS, examById } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'

const popular = [
  { id: 'ssc-cgl', initials: 'SSC', color: 'purple', label: 'Staff Selection' },
  { id: 'ibps-po', initials: 'IBPS', color: 'blue', label: 'Banking' },
  { id: 'upsc-cse', initials: 'UPSC', color: 'orange', label: 'Civil Services' },
  { id: 'rrb-ntpc', initials: 'RRB', color: 'green', label: 'Railways' },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { en: 'Good morning', hi: 'सुप्रभात' }
  if (hour < 17) return { en: 'Good afternoon', hi: 'नमस्कार' }
  return { en: 'Good evening', hi: 'शुभ संध्या' }
}

function SectionHead({ eyebrow, title, sub, action, onAction }) {
  return <div className="dash-section-head"><div>{eyebrow && <div className="section-kicker">{eyebrow}</div>}<h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action && <button className="text-link" onClick={onAction}>{action}<ArrowRight size={15} /></button>}</div>
}

export default function Home() {
  const { state, updateProfile } = useStore()
  const L = useL()
  const stats = useAttemptStats()
  const streak = useCurrentStreak()
  const target = examById(state.profile?.examId) || examById('ssc-cgl')
  const firstName = state.profile?.name?.split(' ')[0] || 'Aspirant'
  const name = firstName === 'Aspirant' && state.profile?.isGuest ? L({ en: 'Aspirant', hi: 'अभ्यर्थी' }) : firstName
  const today = new Date()
  const todayAttempts = state.attempts.filter((attempt) => new Date(attempt.date).toDateString() === today.toDateString())
  const todayQuestions = todayAttempts.reduce((sum, attempt) => sum + Math.max(0, (attempt.totalQuestions || 0) - (attempt.unattempted || 0)), 0)
  const goal = Math.max(1, state.dailyGoal || 25)
  const progress = Math.min(100, Math.round((todayQuestions / goal) * 100))
  const answeredTotal = state.attempts.reduce((sum, attempt) => sum + Math.max(0, (attempt.totalQuestions || 0) - (attempt.unattempted || 0)), 0)
  const available = (TEST_CATALOGUE[target.id] || []).filter((test) => test.type === 'sectional').length

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const count = state.attempts.filter((attempt) => new Date(attempt.date).toDateString() === date.toDateString())
      .reduce((sum, attempt) => sum + Math.max(0, (attempt.totalQuestions || 0) - (attempt.unattempted || 0)), 0)
    return { label: date.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 1), count, isToday: index === 6, date: date.toDateString() }
  }), [state.attempts])
  const weekMax = Math.max(1, ...week.map((day) => day.count))

  const metrics = [
    { icon: ClipboardMetric, color: 'purple', value: stats.attempts, label: L({ en: 'Tests completed', hi: 'पूरे किए टेस्ट' }), note: L({ en: 'Every step counts', hi: 'हर कदम मायने रखता है' }) },
    { icon: CheckCircle2, color: 'blue', value: answeredTotal, label: L({ en: 'Questions attempted', hi: 'प्रयास किए प्रश्न' }), note: L({ en: 'Keep practising', hi: 'अभ्यास जारी रखें' }) },
    { icon: Target, color: 'peach', value: answeredTotal ? `${Math.round(stats.accuracy * 100)}%` : '—', label: L({ en: 'Overall accuracy', hi: 'कुल सटीकता' }), note: L({ en: 'Across your tests', hi: 'आपके टेस्ट में' }) },
    { icon: Flame, color: 'mint', value: L({ en: `${streak} ${streak === 1 ? 'day' : 'days'}`, hi: `${streak} दिन` }), label: L({ en: 'Current streak', hi: 'वर्तमान स्ट्रीक' }), note: L({ en: 'Build a habit', hi: 'आदत बनाएँ' }) },
  ]

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <div>
          <div className="section-kicker"><span className="kicker-dot" /> {L({ en: 'YOUR LEARNING SPACE', hi: 'आपकी अध्ययन की जगह' })}</div>
          <h1>{L(greeting())}, {name}<span className="hello-spark"> ✦</span></h1>
          <p>{L({ en: 'A little progress every day adds up. Let’s get started.', hi: 'हर दिन की छोटी प्रगति आपको आगे ले जाती है। चलिए शुरू करें।' })}</p>
        </div>
        <div className="welcome-date"><CalendarDays size={16} /> {today.toLocaleDateString(langFor(state.settings.lang), { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      </div>

      <section className="dashboard-hero" aria-label="Preparation dashboard">
        <div className="dashboard-hero-art" aria-hidden="true" />
        <div className="dashboard-hero-content">
          <div className="hero-overline"><Sparkles size={14} /> {L({ en: 'YOUR NEXT CHAPTER STARTS HERE', hi: 'आपका अगला कदम यहाँ से' })}</div>
          <h2>{L({ en: 'Your ambition.', hi: 'आपके सपने।' })}<br /><span>{L({ en: 'Your edge.', hi: 'आपकी पहचान।' })}</span></h2>
          <p>{L({ en: 'A little focus today. A future full of possibility.', hi: 'आज थोड़ी एकाग्रता। कल अपार संभावनाएँ।' })}</p>
          <div className="hero-actions">
            <button className="hero-primary" onClick={() => navigate(`/exam/${target.id}`)}><Play size={15} fill="currentColor" /> {L({ en: 'Start practising', hi: 'अभ्यास शुरू करें' })}<ArrowRight size={16} /></button>
            <button className="hero-secondary" onClick={() => navigate(`/pyq?exam=${target.id}`)}>{L({ en: 'View PYQ library', hi: 'PYQ लाइब्रेरी देखें' })}<ArrowUpRight size={16} /></button>
          </div>
        </div>
        <button className="hero-goal" onClick={() => navigate(`/exam/${target.id}`)}>
          <span className="hero-goal-icon"><Target size={18} /></span>
          <span><small>{L({ en: 'YOUR TARGET', hi: 'आपका लक्ष्य' })}</small><strong>{target.name}</strong></span>
          <ArrowUpRight size={16} />
        </button>
      </section>

      <div className="dashboard-metrics" aria-label="Your progress">
        {metrics.map(({ icon: Icon, color, value, label, note }) => <div className={`dash-metric metric-${color}`} key={label}>
          <div className={`metric-icon ${color}`}><Icon size={20} strokeWidth={1.8} /></div>
          <div className="dash-metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
        </div>)}
      </div>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section>
            <SectionHead eyebrow={L({ en: 'A GOOD PLACE TO BEGIN', hi: 'यहाँ से शुरुआत करें' })} title={L({ en: 'Your preparation toolkit', hi: 'आपकी तैयारी की टूलकिट' })} sub={L({ en: 'Everything you need, all in one place.', hi: 'तैयारी की हर चीज़, एक जगह।' })} action={L({ en: 'Explore all', hi: 'सभी देखें' })} onAction={() => navigate('/exams')} />
            <div className="toolkit-grid">
              <button className="toolkit-card toolkit-tests" onClick={() => navigate(`/exam/${target.id}`)}>
                <span className="toolkit-top"><span className="toolkit-icon"><Layers3 size={21} /></span><ArrowUpRight size={17} /></span>
                <span className="toolkit-tag">{L({ en: 'PRACTISE', hi: 'अभ्यास' })}</span>
                <strong>{L({ en: 'Test series', hi: 'टेस्ट सीरीज़' })}</strong>
                <span className="toolkit-desc">{L({ en: 'Find mixed, subject and topic practice sets.', hi: 'मिक्स्ड, विषय और टॉपिक अभ्यास सेट खोजें।' })}</span>
                <span className="toolkit-link">{L({ en: 'Explore tests', hi: 'टेस्ट देखें' })} <ArrowRight size={14} /></span>
              </button>
              <button className="toolkit-card toolkit-pyq" onClick={() => navigate(`/pyq?exam=${target.id}`)}>
                <span className="toolkit-top"><span className="toolkit-icon"><FileClock size={21} /></span><ArrowUpRight size={17} /></span>
                <span className="toolkit-tag">{L({ en: 'COMING SOON', hi: 'जल्द आ रहा है' })}</span>
                <strong>{L({ en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर' })}</strong>
                <span className="toolkit-desc">{L({ en: 'A dedicated paper library for every exam.', hi: 'हर परीक्षा के लिए एक अलग पेपर लाइब्रेरी।' })}</span>
                <span className="toolkit-link">{L({ en: 'Explore library', hi: 'लाइब्रेरी देखें' })} <ArrowRight size={14} /></span>
              </button>
              <button className="toolkit-card toolkit-material" onClick={() => navigate('/materials')}>
                <span className="toolkit-top"><span className="toolkit-icon"><BookOpen size={21} /></span><ArrowUpRight size={17} /></span>
                <span className="toolkit-tag">{L({ en: 'REVISE', hi: 'दोहराएँ' })}</span>
                <strong>{L({ en: 'Study material', hi: 'अध्ययन सामग्री' })}</strong>
                <span className="toolkit-desc">{L({ en: 'Revisit important concepts at your own pace.', hi: 'अपनी गति से महत्वपूर्ण कॉन्सेप्ट दोहराएँ।' })}</span>
                <span className="toolkit-link">{L({ en: 'Browse resources', hi: 'सामग्री देखें' })} <ArrowRight size={14} /></span>
              </button>
            </div>
          </section>

          <section className="popular-section">
            <SectionHead eyebrow={L({ en: 'FIND YOUR PATH', hi: 'अपना रास्ता चुनें' })} title={L({ en: 'Explore popular exams', hi: 'लोकप्रिय परीक्षाएँ देखें' })} sub={L({ en: 'Your goal is unique. Your prep should be too.', hi: 'आपका लक्ष्य अनोखा है, तैयारी भी वैसी ही होनी चाहिए।' })} action={L({ en: 'View all exams', hi: 'सभी परीक्षाएँ' })} onAction={() => navigate('/exams')} />
            <div className="popular-grid">
              {popular.map((item) => {
                const exam = examById(item.id)
                return <button className="popular-card" key={item.id} onClick={() => navigate(`/exam/${item.id}`)}>
                  <span className={`exam-monogram ${item.color}`}>{item.initials}</span>
                  <span className="popular-info"><strong>{exam.name}</strong><small>{item.label}</small></span>
                  <span className="popular-arrow"><ChevronRight size={17} /></span>
                </button>
              })}
            </div>
          </section>
        </div>

        <aside className="dashboard-secondary" aria-label="Daily progress">
          <div className="focus-card">
            <div className="focus-card-head"><div><span className="section-kicker">{L({ en: 'YOUR FOCUS', hi: 'आपका लक्ष्य' })}</span><h3>{L({ en: 'Daily progress', hi: 'दैनिक प्रगति' })}</h3></div><span className="focus-icon"><Target size={18} /></span></div>
            <div className="daily-layout">
              <div className="daily-ring" style={{ background: `conic-gradient(var(--ee-progress) ${progress}%, var(--ee-progress-track) 0)` }}><div><strong>{progress}%</strong><span>{L({ en: 'complete', hi: 'पूरा' })}</span></div></div>
              <div className="daily-copy"><strong>{todayQuestions}<span> / {goal}</span></strong><small>{L({ en: 'questions today', hi: 'आज के प्रश्न' })}</small><p>{progress >= 100 ? L({ en: 'Goal complete. Great work!', hi: 'लक्ष्य पूरा। बहुत बढ़िया!' }) : L({ en: 'Small steps make a big difference.', hi: 'छोटे कदम बड़ा बदलाव लाते हैं।' })}</p></div>
            </div>
            <button className="focus-action" onClick={() => navigate(`/exam/${target.id}`)}>{L({ en: 'Let’s practise', hi: 'अभ्यास शुरू करें' })}<ArrowRight size={15} /></button>
          </div>

          <div className="week-card">
            <div className="week-card-head"><div><span className="section-kicker">{L({ en: 'KEEP SHOWING UP', hi: 'नियमित बने रहें' })}</span><h3>{L({ en: 'Your week', hi: 'आपका सप्ताह' })}</h3></div><button onClick={() => navigate('/analytics')} aria-label="View analytics"><ArrowUpRight size={17} /></button></div>
            <p>{L({ en: 'Questions attempted in the last 7 days', hi: 'पिछले 7 दिनों में प्रयास किए प्रश्न' })}</p>
            <div className="week-chart" aria-label="Questions attempted in the last seven days">
              {week.map((day) => <div className="week-day" key={day.date} title={`${day.date}: ${day.count} questions`}><div className="week-track"><span className={day.isToday ? 'today' : ''} style={{ height: `${day.count ? Math.max(8, (day.count / weekMax) * 100) : 0}%` }} /></div><small className={day.isToday ? 'today' : ''}>{day.label}</small></div>)}
            </div>
            {!answeredTotal && <div className="week-empty">{L({ en: 'Your activity will appear here.', hi: 'आपकी गतिविधि यहाँ दिखाई देगी।' })}</div>}
          </div>

          <div className="target-card">
            <div className="target-card-icon"><GraduationCap size={20} /></div>
            <div><span>{L({ en: 'PREPARING FOR', hi: 'तैयारी कर रहे हैं' })}</span><strong>{target.name}</strong><small>{available} {L({ en: 'subject practice sets', hi: 'विषय अभ्यास सेट' })}</small></div>
            <label className="target-select-label" title="Change target exam"><span className="sr-only">Change target exam</span><select value={target.id} onChange={(event) => updateProfile({ examId: event.target.value })}>{EXAMS.map((exam) => <option value={exam.id} key={exam.id}>{exam.name}</option>)}</select><ChevronRight size={18} /></label>
          </div>
        </aside>
      </div>
      <div className="dashboard-footer"><span>EXAMEDGE <span>✦</span> {L({ en: 'MADE FOR THE JOURNEY', hi: 'आपकी यात्रा के लिए' })}</span><span>{L({ en: 'One day at a time.', hi: 'एक दिन, एक कदम।' })}</span></div>
    </div>
  )
}

function ClipboardMetric(props) {
  return <BarChart3 {...props} />
}

function langFor(lang) {
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}
