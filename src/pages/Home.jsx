import React, { useMemo } from 'react'
import {
  ArrowRight, ArrowUpRight, BarChart3, Bookmark, BookOpen, Building2, CalendarDays,
  CheckCircle2, ChevronRight, Compass, FileClock, Flame, GraduationCap, Landmark, Layers3, Map,
  Play, Sparkles, Target, TrainFront,
} from 'lucide-react'
import { useStore, useAttemptStats, useCurrentStreak } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { CATEGORIES, EXAMS, examById } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'
import { hasPractice, latestTargetAttempt, practiceExamCount } from '../lib/examCatalog'

const popular = [
  { id: 'ssc-cgl', initials: 'SSC', color: 'purple', label: 'Staff Selection' },
  { id: 'ibps-po', initials: 'IBPS', color: 'blue', label: 'Banking' },
  { id: 'upsc-cse', initials: 'UPSC', color: 'orange', label: 'Civil Services' },
  { id: 'rrb-ntpc', initials: 'RRB', color: 'green', label: 'Railways' },
]

const goalCategories = [
  { id: 'ssc', icon: Landmark, color: 'purple' },
  { id: 'banking', icon: Building2, color: 'blue' },
  { id: 'railway', icon: TrainFront, color: 'orange' },
  { id: 'state', icon: Map, color: 'green' },
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
  const preview = (TEST_CATALOGUE[target.id] || []).find((test) => test.type === 'preview')
  const lastAttempt = latestTargetAttempt(state.attempts, target.id)
  const availablePracticeRoute = practiceExamCount ? '/exams?availability=practice' : '/exams'
  const beginPractice = () => preview && navigate(`/test/${target.id}/${preview.id}?mode=practice`)

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const count = state.attempts.filter((attempt) => new Date(attempt.date).toDateString() === date.toDateString())
      .reduce((sum, attempt) => sum + Math.max(0, (attempt.totalQuestions || 0) - (attempt.unattempted || 0)), 0)
    return { label: date.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 1), count, isToday: index === 6, date: date.toDateString() }
  }), [state.attempts])
  const weekMax = Math.max(1, ...week.map((day) => day.count))

  const quickLinks = [
    { icon: Target, tone: 'violet', label: L({ en: 'My target', hi: 'मेरा लक्ष्य' }), detail: target.name, path: `/exam/${target.id}` },
    { icon: Compass, tone: 'blue', label: L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' }), detail: `${EXAMS.length} ${L({ en: 'exams listed', hi: 'परीक्षाएँ' })}`, path: '/exams' },
    { icon: BookOpen, tone: 'mint', label: L({ en: 'Study material', hi: 'अध्ययन सामग्री' }), detail: L({ en: 'Sample resources', hi: 'नमूना सामग्री' }), path: '/materials' },
    { icon: Bookmark, tone: 'peach', label: L({ en: 'Saved questions', hi: 'सहेजे प्रश्न' }), detail: L({ en: 'Question bank rebuilding', hi: 'नया प्रश्न बैंक तैयार हो रहा है' }), path: '/bookmarks' },
  ]

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

      <div className="dashboard-stage">
        <section className="dashboard-hero" aria-label={L({ en: 'Preparation dashboard', hi: 'तैयारी डैशबोर्ड' })}>
          <div className="dashboard-hero-art" aria-hidden="true" />
          <div className="dashboard-hero-content">
            <div className="hero-overline"><Sparkles size={14} /> {L({ en: 'YOUR SPACE TO MOVE FORWARD', hi: 'आपकी तैयारी का नया मुकाम' })}</div>
            <h2>{L({ en: 'Dream bigger.', hi: 'सपने बड़े।' })}<br /><span>{L({ en: 'Go further.', hi: 'हौसले और बड़े।' })}</span></h2>
            <p>{L({ en: 'Every practice session is a step towards your goal.', hi: 'हर अभ्यास सत्र आपको आपके लक्ष्य के करीब लाता है।' })}</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={() => preview ? beginPractice() : navigate(`/exam/${target.id}`)}>{preview ? <Play size={15} fill="currentColor" /> : <BookOpen size={15} />} {preview ? L({ en: 'Start practising', hi: 'अभ्यास शुरू करें' }) : L({ en: 'View exam details', hi: 'परीक्षा विवरण देखें' })}<ArrowRight size={16} /></button>
              <button className="hero-secondary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}<ArrowUpRight size={16} /></button>
            </div>
          </div>
          <button className="hero-goal" onClick={() => navigate(`/exam/${target.id}`)}>
            <span className="hero-goal-icon"><Target size={18} /></span>
            <span><small>{L({ en: 'YOUR TARGET', hi: 'आपका लक्ष्य' })}</small><strong>{target.name}</strong></span>
            <ArrowUpRight size={16} />
          </button>
        </section>
      </div>

      <div className="dashboard-control-deck">
        <aside className="focus-card" aria-label={L({ en: 'Daily progress', hi: 'दैनिक प्रगति' })}>
          <div className="focus-card-head"><div><span className="section-kicker">{L({ en: 'YOUR FOCUS', hi: 'आपका लक्ष्य' })}</span><h3>{L({ en: 'Daily progress', hi: 'दैनिक प्रगति' })}</h3></div><span className="focus-icon"><Target size={18} /></span></div>
          <div className="daily-layout">
            <div className="daily-ring" style={{ background: `conic-gradient(var(--ee-progress) ${progress}%, var(--ee-progress-track) 0)` }}><div><strong>{progress}%</strong><span>{L({ en: 'complete', hi: 'पूरा' })}</span></div></div>
            <div className="daily-copy"><strong>{todayQuestions}<span> / {goal}</span></strong><small>{L({ en: 'questions today', hi: 'आज के प्रश्न' })}</small><p>{progress >= 100 ? L({ en: 'Goal complete. Great work!', hi: 'लक्ष्य पूरा। बहुत बढ़िया!' }) : L({ en: 'Small steps make a big difference.', hi: 'छोटे कदम बड़ा बदलाव लाते हैं।' })}</p></div>
          </div>
          <button className="focus-action" onClick={() => navigate(preview ? `/exam/${target.id}` : availablePracticeRoute)}>{preview ? L({ en: 'Let’s practise', hi: 'अभ्यास शुरू करें' }) : L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}<ArrowRight size={15} /></button>
        </aside>

        <section className="quick-access" aria-labelledby="quick-access-title">
          <div className="quick-access-head">
            <div><span className="section-kicker">{L({ en: 'PICK UP THE PACE', hi: 'तैयारी को रफ़्तार दें' })}</span><h2 id="quick-access-title">{L({ en: 'Your shortcuts', hi: 'आपके शॉर्टकट' })}</h2></div>
            <span className="quick-access-caption">{L({ en: 'Everything you need, one tap away', hi: 'ज़रूरी चीज़ें, एक टैप पर' })}</span>
          </div>
          <div className="quick-access-grid">
            {quickLinks.map(({ icon: Icon, tone, label, detail, path }) => <button className="quick-access-card" key={path} onClick={() => navigate(path)}>
              <span className={`quick-access-icon ${tone}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className="quick-access-copy"><strong>{label}</strong><small>{detail}</small></span>
              <ArrowUpRight className="quick-access-arrow" size={16} aria-hidden="true" />
            </button>)}
          </div>
        </section>
      </div>

      <section className="progress-overview" aria-labelledby="progress-overview-title">
        <div className="progress-overview-head">
          <div><div className="section-kicker">{L({ en: 'YOUR JOURNEY SO FAR', hi: 'अब तक की आपकी यात्रा' })}</div><h2 id="progress-overview-title">{L({ en: 'Your progress, at a glance', hi: 'आपकी प्रगति, एक नज़र में' })}</h2></div>
          <button className="text-link" onClick={() => navigate('/analytics')}>{L({ en: 'View analytics', hi: 'आँकड़े देखें' })}<ArrowRight size={15} /></button>
        </div>
        <div className="dashboard-metrics" aria-label={L({ en: 'Your progress', hi: 'आपकी प्रगति' })}>
          {metrics.map(({ icon: Icon, color, value, label, note }) => <div className={`dash-metric metric-${color}`} key={label}>
            <div className={`metric-icon ${color}`}><Icon size={20} strokeWidth={1.8} /></div>
            <div className="dash-metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
          </div>)}
        </div>
      </section>

      <section className="next-step-card" aria-label={L({ en: 'Your next step', hi: 'आपका अगला कदम' })}>
        <span className="next-step-icon"><Target size={22} /></span>
        <div className="next-step-copy">
          <div className="section-kicker">{L({ en: 'YOUR NEXT STEP', hi: 'आपका अगला कदम' })}</div>
          <h2>{preview ? L({ en: `Make progress on ${target.name}`, hi: `${target.name} की तैयारी आगे बढ़ाएँ` }) : L({ en: `${target.name} is your goal`, hi: `आपका लक्ष्य: ${target.name}` })}</h2>
          <p>{preview ? L({ en: `Mixed practice · ${preview.questions} questions · suggested ${preview.duration} min`, hi: `मिश्रित अभ्यास · ${preview.questions} प्रश्न · सुझाया समय ${preview.duration} मिनट` }) : L({ en: 'The question bank is being rebuilt. Your past results remain on this device.', hi: 'नया प्रश्न बैंक तैयार हो रहा है। पुराने परिणाम इस डिवाइस पर सुरक्षित हैं।' })}</p>
          {lastAttempt && <span className="next-step-history">{L({ en: 'Last result', hi: 'पिछला परिणाम' })} · {Math.round((lastAttempt.accuracy || 0) * 100)}% {L({ en: 'accuracy', hi: 'सटीकता' })}</span>}
        </div>
        <div className="next-step-actions">
          <button className="next-step-primary" onClick={() => preview ? beginPractice() : navigate(`/exam/${target.id}`)}>{preview ? L({ en: 'Start a set', hi: 'सेट शुरू करें' }) : L({ en: 'Exam details', hi: 'परीक्षा विवरण' })}<ArrowRight size={15} /></button>
          <button className="next-step-secondary" onClick={() => lastAttempt ? navigate(`/result/${lastAttempt.id}`) : navigate(preview ? `/exam/${target.id}` : availablePracticeRoute)}>{lastAttempt ? L({ en: 'Review last result', hi: 'पिछला परिणाम देखें' }) : preview ? L({ en: 'See all sets', hi: 'सभी सेट देखें' }) : L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}</button>
        </div>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section>
            <SectionHead eyebrow={L({ en: 'A GOOD PLACE TO BEGIN', hi: 'यहाँ से शुरुआत करें' })} title={L({ en: 'Your preparation toolkit', hi: 'आपकी तैयारी की टूलकिट' })} sub={L({ en: 'Everything you need, all in one place.', hi: 'तैयारी की हर चीज़, एक जगह।' })} action={L({ en: 'Explore all', hi: 'सभी देखें' })} onAction={() => navigate('/exams')} />
            <div className="toolkit-grid">
              <button className="toolkit-card toolkit-tests" onClick={() => navigate(preview ? `/exam/${target.id}` : availablePracticeRoute)}>
                <span className="toolkit-top"><span className="toolkit-icon"><Layers3 size={21} /></span><ArrowUpRight size={17} /></span>
                <span className="toolkit-tag">{L({ en: 'PRACTISE', hi: 'अभ्यास' })}</span>
                <strong>{L({ en: 'Test series', hi: 'टेस्ट सीरीज़' })}</strong>
                <span className="toolkit-desc">{preview ? L({ en: 'Find mixed, subject and topic practice sets.', hi: 'मिक्स्ड, विषय और टॉपिक अभ्यास सेट खोजें।' }) : L({ en: 'Practice is not added for your target yet.', hi: 'आपके लक्ष्य के लिए अभ्यास अभी नहीं जोड़ा गया है।' })}</span>
                <span className="toolkit-link">{preview ? L({ en: 'Explore tests', hi: 'टेस्ट देखें' }) : L({ en: 'Browse other exams', hi: 'अन्य परीक्षाएँ देखें' })} <ArrowRight size={14} /></span>
              </button>
              <button className="toolkit-card toolkit-pyq" onClick={() => navigate(`/pyq?exam=${target.id}`)}>
                <span className="toolkit-top"><span className="toolkit-icon"><FileClock size={21} /></span><ArrowUpRight size={17} /></span>
                <span className="toolkit-tag">{L({ en: 'NOT ADDED YET', hi: 'अभी उपलब्ध नहीं' })}</span>
                <strong>{L({ en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर' })}</strong>
                <span className="toolkit-desc">{L({ en: 'Papers have not been added to the library yet.', hi: 'लाइब्रेरी में पेपर अभी नहीं जोड़े गए हैं।' })}</span>
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

          <section className="goal-section">
            <SectionHead eyebrow={L({ en: 'FIND YOUR PATH', hi: 'अपना रास्ता चुनें' })} title={L({ en: 'Explore by category', hi: 'श्रेणी के अनुसार देखें' })} sub={L({ en: 'Find the exam goals that matter to you.', hi: 'अपने लिए सही परीक्षा लक्ष्य खोजें।' })} action={L({ en: 'All categories', hi: 'सभी श्रेणियाँ' })} onAction={() => navigate('/exams')} />
            <div className="goal-grid">
              {goalCategories.map(({ id, icon: Icon, color }) => {
                const category = CATEGORIES.find((item) => item.id === id)
                const count = EXAMS.filter((exam) => exam.category === id).length
                return <button className={`goal-category goal-${color}`} key={id} onClick={() => navigate(`/exams?c=${id}`)}>
                  <span className="goal-category-icon"><Icon size={19} /></span><ArrowUpRight className="goal-category-arrow" size={15} />
                  <strong>{L({ en: category.name, hi: category.hi })}</strong><small>{count} {L({ en: 'exams listed', hi: 'परीक्षाएँ सूचीबद्ध' })}</small>
                </button>
              })}
            </div>
          </section>

          <section className="popular-section">
            <SectionHead eyebrow={L({ en: 'START EXPLORING', hi: 'देखना शुरू करें' })} title={L({ en: 'Some exams to explore', hi: 'कुछ परीक्षाएँ देखें' })} sub={L({ en: 'Your goal is unique. Your prep should be too.', hi: 'आपका लक्ष्य अनोखा है, तैयारी भी वैसी ही होनी चाहिए।' })} action={L({ en: 'View all exams', hi: 'सभी परीक्षाएँ' })} onAction={() => navigate('/exams')} />
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

        <aside className="dashboard-secondary" aria-label={L({ en: 'Activity and target', hi: 'गतिविधि और लक्ष्य' })}>
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
            <div><span>{L({ en: 'PREPARING FOR', hi: 'तैयारी कर रहे हैं' })}</span><strong>{target.name}</strong><small>{preview ? <>{available} {L({ en: 'subject practice sets', hi: 'विषय अभ्यास सेट' })}</> : L({ en: 'Practice not added yet', hi: 'अभ्यास अभी उपलब्ध नहीं' })}</small></div>
            <label className="target-select-label" title={L({ en: 'Change target exam', hi: 'लक्ष्य परीक्षा बदलें' })}><span className="sr-only">{L({ en: 'Change target exam', hi: 'लक्ष्य परीक्षा बदलें' })}</span><select value={target.id} onChange={(event) => updateProfile({ examId: event.target.value })}>{CATEGORIES.map((category) => <optgroup key={category.id} label={L({ en: category.name, hi: category.hi })}>{EXAMS.filter((exam) => exam.category === category.id).map((exam) => <option value={exam.id} key={exam.id}>{exam.name}{!hasPractice(exam.id) ? ` — ${L({ en: 'info only', hi: 'केवल जानकारी' })}` : ''}</option>)}</optgroup>)}</select><ChevronRight size={18} /></label>
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
