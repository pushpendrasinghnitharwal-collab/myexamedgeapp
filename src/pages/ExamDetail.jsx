import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, ClipboardList, Clock3, FileClock, FileText, Layers3, ListChecks, Play, Sparkles, Target } from 'lucide-react'
import { examById, CATEGORIES, SUBJECTS } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { useStore } from '../lib/store'

export default function ExamDetail({ examId, initialTab = 'overview' }) {
  const L = useL()
  const { state, updateProfile } = useStore()
  const exam = examById(examId)
  const [tab, setTab] = useState(initialTab)
  const [mode, setMode] = useState('practice')
  useEffect(() => { setTab(initialTab) }, [initialTab, examId])
  const tests = useMemo(() => TEST_CATALOGUE[examId] || [], [examId])

  if (!exam) return <div className="directory-empty"><h3>{L({ en: 'Exam not found', hi: 'परीक्षा नहीं मिली' })}</h3><button className="btn primary" onClick={() => navigate('/exams')}>Explore exams</button></div>
  const category = CATEGORIES.find((item) => item.id === exam.category)
  const preview = tests.find((test) => test.type === 'preview')
  const sectionals = tests.filter((test) => test.type === 'sectional')
  const topics = tests.filter((test) => test.type === 'topic')
  const selectedTests = tab === 'overview' ? [preview, ...sectionals.slice(0, 3)].filter(Boolean) : tab === 'sectional' ? sectionals : tab === 'topic' ? topics : []
  const target = state.profile?.examId === exam.id
  const tabs = [
    ['overview', L({ en: 'Overview', hi: 'अवलोकन' })],
    ['full', L({ en: 'Full mocks', hi: 'फुल मॉक' })],
    ['sectional', L({ en: 'Subject-wise', hi: 'विषयवार' })],
    ['topic', L({ en: 'Topic practice', hi: 'टॉपिक अभ्यास' })],
    ['pyq', L({ en: 'PYQ papers', hi: 'PYQ पेपर' })],
  ]

  const start = (test) => navigate(`/test/${exam.id}/${test.id}?mode=${mode}`)
  return (
    <div className="exam-page page-shell">
      <div className="exam-breadcrumb"><button onClick={() => navigate('/exams')}><ArrowLeft size={14} /> {L({ en: 'All exams', hi: 'सभी परीक्षाएँ' })}</button><ChevronRight size={14} /><span>{exam.name}</span></div>
      <section className="exam-hero">
        <div className="exam-hero-main"><div className="section-kicker"><span className="kicker-dot" /> {L({ en: category.name, hi: category.hi })} {L({ en: 'PREPARATION HUB', hi: 'तैयारी केंद्र' })}</div><h1>{exam.name}</h1><p>{exam.subtitle}</p><div className="exam-hero-tags"><span><Layers3 size={14} /> {exam.tier}</span><span><ListChecks size={14} /> {sectionals.length} {L({ en: 'subject sets', hi: 'विषय सेट' })}</span><span><FileClock size={14} /> {L({ en: 'PYQ space', hi: 'PYQ सेक्शन' })}</span></div></div>
        <div className="exam-hero-actions"><button className={`target-button ${target ? 'is-target' : ''}`} onClick={() => updateProfile({ examId: exam.id })}>{target ? <Check size={16} /> : <Target size={16} />}{target ? L({ en: 'Your target exam', hi: 'आपकी लक्ष्य परीक्षा' }) : L({ en: 'Set as my target', hi: 'लक्ष्य बनाएँ' })}</button><button className="exam-primary" onClick={() => preview ? start(preview) : setTab('sectional')}><Play size={14} fill="currentColor" /> {L({ en: 'Start practising', hi: 'अभ्यास शुरू करें' })} <ArrowRight size={15} /></button></div>
      </section>

      <div className="exam-tabs" role="tablist" aria-label="Exam preparation sections">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => id === 'pyq' ? navigate(`/pyq?exam=${exam.id}`) : setTab(id)}>{label}{id === 'pyq' && <ArrowUpRight size={13} />}</button>)}</div>
      <div className="exam-content-grid">
        <div>
          {tab === 'full' ? <div className="full-mock-empty"><span><ClipboardList size={26} /></span><div className="section-kicker">{L({ en: 'COMING SOON', hi: 'जल्द आ रहा है' })}</div><h2>{L({ en: 'Full-length mocks are on the way.', hi: 'फुल-लेंथ मॉक जल्द आ रहे हैं।' })}</h2><p>{L({ en: 'This interface is ready for exam-specific full mocks. In the meantime, explore the existing short practice sets.', hi: 'यह इंटरफेस परीक्षा-विशेष फुल मॉक के लिए तैयार है। तब तक मौजूदा छोटे अभ्यास सेट देखें।' })}</p>{preview && <button className="exam-primary" onClick={() => start(preview)}>{L({ en: 'Try a practice set', hi: 'अभ्यास सेट करें' })} <ArrowRight size={16} /></button>}</div> : <>
            <div className="test-section-heading"><div><div className="section-kicker">{tab === 'overview' ? L({ en: 'A PLACE TO START', hi: 'शुरुआत यहाँ से' }) : tab === 'sectional' ? L({ en: 'FOCUS YOUR PRACTICE', hi: 'विषय पर ध्यान दें' }) : L({ en: 'ONE TOPIC AT A TIME', hi: 'एक समय में एक टॉपिक' })}</div><h2>{tab === 'overview' ? L({ en: 'Explore practice sets', hi: 'अभ्यास सेट देखें' }) : tab === 'sectional' ? L({ en: 'Subject-wise practice', hi: 'विषयवार अभ्यास' }) : L({ en: 'Topic practice', hi: 'टॉपिक अभ्यास' })}</h2><p>{L({ en: 'Short sets using questions already in the app.', hi: 'ऐप में पहले से मौजूद प्रश्नों के छोटे अभ्यास सेट।' })}</p></div><div className="mode-select" aria-label="Test mode"><button className={mode === 'practice' ? 'selected' : ''} aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>{L({ en: 'Practice', hi: 'अभ्यास' })}</button><button className={mode === 'mock' ? 'selected' : ''} aria-pressed={mode === 'mock'} onClick={() => setMode('mock')}>{L({ en: 'Timed', hi: 'समयबद्ध' })}</button></div></div>
            <div className="test-list">{selectedTests.map((test) => <TestRow key={test.id} test={test} L={L} onStart={() => start(test)} />)}{!selectedTests.length && <div className="test-empty">{L({ en: 'No practice sets are available in this section yet.', hi: 'इस सेक्शन में अभी अभ्यास सेट उपलब्ध नहीं हैं।' })}</div>}</div>
            {tab === 'overview' && sectionals.length > 3 && <button className="text-link test-more" onClick={() => setTab('sectional')}>{L({ en: 'See all subject practice', hi: 'सभी विषय अभ्यास देखें' })} <ArrowRight size={15} /></button>}
          </>}
          <div className="content-disclaimer"><CircleHelp size={16} /><span>{L({ en: 'Practice content is from the existing question bank. PYQ papers and research-backed full mocks have not been added yet.', hi: 'अभ्यास सामग्री मौजूदा प्रश्न बैंक से है। PYQ पेपर और शोध-आधारित फुल मॉक अभी नहीं जोड़े गए हैं।' })}</span></div>
        </div>
        <aside className="exam-aside" aria-label="Exam overview">
          <div className="exam-summary"><div className="section-kicker">{L({ en: 'YOUR PREP, AT A GLANCE', hi: 'तैयारी एक नज़र में' })}</div><h3>{L({ en: 'What’s inside', hi: 'क्या उपलब्ध है' })}</h3><p>{L({ en: `Your ${exam.name} preparation space.`, hi: `${exam.name} के लिए आपकी तैयारी की जगह।` })}</p><div className="summary-rows"><div><span><Layers3 size={17} /> {L({ en: 'Subject practice', hi: 'विषय अभ्यास' })}</span><strong>{sectionals.length} {L({ en: 'sets', hi: 'सेट' })}</strong></div><div><span><Target size={17} /> {L({ en: 'Topic practice', hi: 'टॉपिक अभ्यास' })}</span><strong>{topics.length} {L({ en: 'sets', hi: 'सेट' })}</strong></div><div><span><FileClock size={17} /> {L({ en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर' })}</span><strong className="summary-soon">{L({ en: 'Coming soon', hi: 'जल्द' })}</strong></div></div><button onClick={() => navigate(`/pyq?exam=${exam.id}`)}>{L({ en: 'Open PYQ library', hi: 'PYQ लाइब्रेरी खोलें' })}<ArrowRight size={15} /></button></div>
          <div className="exam-tip"><span><Sparkles size={18} /></span><div><strong>{L({ en: 'One step at a time.', hi: 'एक बार में एक कदम।' })}</strong><p>{L({ en: 'Consistent practice is a great place to begin.', hi: 'नियमित अभ्यास एक अच्छी शुरुआत है।' })}</p></div></div>
        </aside>
      </div>
    </div>
  )
}

function TestRow({ test, L, onStart }) {
  const Icon = test.type === 'preview' ? ClipboardList : test.type === 'sectional' ? Layers3 : Target
  return <div className="test-row"><span className={`test-row-icon ${test.type === 'preview' ? 'purple' : test.type === 'sectional' ? 'blue' : 'orange'}`}><Icon size={20} /></span><div className="test-row-info"><span className="test-row-type">{test.type === 'preview' ? L({ en: 'MIXED PRACTICE', hi: 'मिक्स्ड अभ्यास' }) : test.type === 'sectional' ? L({ en: 'SUBJECT PRACTICE', hi: 'विषय अभ्यास' }) : L({ en: 'TOPIC PRACTICE', hi: 'टॉपिक अभ्यास' })}</span><strong>{L({ en: test.title, hi: test.hi })}</strong><span className="test-meta"><span><FileText size={13} /> {test.questions} {L({ en: 'questions', hi: 'प्रश्न' })}</span><span><Clock3 size={13} /> {test.duration} {L({ en: 'min', hi: 'मिनट' })}</span></span></div><button className="test-start" onClick={onStart}>{L({ en: 'Start', hi: 'शुरू' })}<ArrowRight size={15} /></button></div>
}
