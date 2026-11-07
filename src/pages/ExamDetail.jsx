import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, ClipboardList, Clock3, ExternalLink, FileClock, FileText, Layers3, ListChecks, Play, Sparkles, Target } from 'lucide-react'
import { examById, CATEGORIES, officialSourceForExam } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'
import { practiceSetCount } from '../lib/examCatalog'
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

  if (!exam) return <div className="directory-empty"><h3>{L({ en: 'Exam not found', hi: 'परीक्षा नहीं मिली' })}</h3><button className="btn primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}</button></div>
  const category = CATEGORIES.find((item) => item.id === exam.category)
  const source = officialSourceForExam(exam)
  const preview = tests.find((test) => test.type === 'preview')
  const sectionals = tests.filter((test) => test.type === 'sectional')
  const topics = tests.filter((test) => test.type === 'topic')
  const sets = practiceSetCount(exam.id)
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
        <div className="exam-hero-main"><div className="section-kicker"><span className="kicker-dot" /> {L({ en: category.name, hi: category.hi })} {L({ en: 'EXAM DIRECTORY', hi: 'परीक्षा डायरेक्टरी' })}</div><h1>{exam.name}</h1><p>{exam.subtitle}</p><div className="exam-hero-tags"><span><ListChecks size={14} /> {sets ? `${sets} ${L({ en: 'practice sets', hi: 'अभ्यास सेट' })}` : L({ en: 'Practice not added', hi: 'अभ्यास अभी नहीं जोड़ा गया' })}</span><span><FileClock size={14} /> {L({ en: 'PYQ papers not added', hi: 'PYQ पेपर अभी नहीं जोड़े गए' })}</span></div></div>
        <div className="exam-hero-actions"><button className={`target-button ${target ? 'is-target' : ''}`} onClick={() => updateProfile({ examId: exam.id })}>{target ? <Check size={16} /> : <Target size={16} />}{target ? L({ en: 'Your target exam', hi: 'आपकी लक्ष्य परीक्षा' }) : L({ en: 'Set as my target', hi: 'लक्ष्य बनाएँ' })}</button>{preview ? <button className="exam-primary" onClick={() => start(preview)}><Play size={14} fill="currentColor" /> {L({ en: 'Start practising', hi: 'अभ्यास शुरू करें' })} <ArrowRight size={15} /></button> : <button className="exam-primary" onClick={() => navigate('/exams?availability=practice')}>{L({ en: 'Practice other exams', hi: 'अन्य परीक्षाओं का अभ्यास' })} <ArrowRight size={15} /></button>}</div>
      </section>

      <div className="exam-tabs" role="tablist" aria-label={L({ en: 'Exam preparation sections', hi: 'परीक्षा तैयारी के सेक्शन' })}>{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => id === 'pyq' ? navigate(`/pyq?exam=${exam.id}`) : setTab(id)}>{label}{id === 'pyq' && <ArrowUpRight size={13} />}</button>)}</div>
      <div className="exam-content-grid">
        <div>
          {exam.description && tab === 'overview' && <div className="exam-about"><div className="section-kicker">{L({ en: 'ABOUT THIS EXAM', hi: 'परीक्षा के बारे में' })}</div><p>{L(exam.description)}</p></div>}
          {tab === 'full' ? <div className="full-mock-empty"><span><ClipboardList size={26} /></span><div className="section-kicker">{L({ en: 'NOT ADDED YET', hi: 'अभी नहीं जोड़ा गया' })}</div><h2>{L({ en: 'No full-length mocks yet.', hi: 'फुल-लेंथ मॉक अभी उपलब्ध नहीं हैं।' })}</h2><p>{preview ? L({ en: 'The available short practice sets are not official full-length mock papers.', hi: 'उपलब्ध छोटे अभ्यास सेट आधिकारिक फुल-लेंथ मॉक पेपर नहीं हैं।' }) : L({ en: 'Full-length mocks and practice sets have not been added for this exam.', hi: 'इस परीक्षा के लिए फुल-लेंथ मॉक और अभ्यास सेट अभी नहीं जोड़े गए हैं।' })}</p>{preview ? <button className="exam-primary" onClick={() => start(preview)}>{L({ en: 'Try a practice set', hi: 'अभ्यास सेट करें' })} <ArrowRight size={16} /></button> : <button className="exam-primary" onClick={() => navigate('/exams?availability=practice')}>{L({ en: 'Browse available practice', hi: 'उपलब्ध अभ्यास देखें' })} <ArrowRight size={16} /></button>}</div> : !preview ? <div className="no-practice-card"><span className="no-practice-icon"><BookOpen size={24} /></span><div className="section-kicker">{L({ en: 'EXAM INFORMATION', hi: 'परीक्षा जानकारी' })}</div><h2>{L({ en: 'Practice isn’t available yet', hi: 'अभ्यास अभी उपलब्ध नहीं है' })}</h2><p>{L({ en: `We haven’t added practice sets or PYQ papers for ${exam.name}. You can save this as your target and explore practice for other exams.`, hi: `${exam.name} के लिए अभ्यास सेट या PYQ पेपर अभी नहीं जोड़े गए हैं। आप इसे अपना लक्ष्य बना सकते हैं और अन्य परीक्षाओं का अभ्यास देख सकते हैं।` })}</p><div className="no-practice-actions"><button className="exam-primary" onClick={() => navigate('/exams?availability=practice')}>{L({ en: 'Browse available practice', hi: 'उपलब्ध अभ्यास देखें' })} <ArrowRight size={16} /></button>{source && <OfficialLink source={source} L={L} />}</div></div> : <>
            <div className="test-section-heading"><div><div className="section-kicker">{tab === 'overview' ? L({ en: 'A PLACE TO START', hi: 'शुरुआत यहाँ से' }) : tab === 'sectional' ? L({ en: 'FOCUS YOUR PRACTICE', hi: 'विषय पर ध्यान दें' }) : L({ en: 'ONE TOPIC AT A TIME', hi: 'एक समय में एक टॉपिक' })}</div><h2>{tab === 'overview' ? L({ en: 'Explore practice sets', hi: 'अभ्यास सेट देखें' }) : tab === 'sectional' ? L({ en: 'Subject-wise practice', hi: 'विषयवार अभ्यास' }) : L({ en: 'Topic practice', hi: 'टॉपिक अभ्यास' })}</h2><p>{L({ en: 'Short sets using questions already in the app.', hi: 'ऐप में पहले से मौजूद प्रश्नों के छोटे अभ्यास सेट।' })}</p></div>{selectedTests.length > 0 && <div className="mode-select" aria-label={L({ en: 'Test mode', hi: 'टेस्ट मोड' })}><button className={mode === 'practice' ? 'selected' : ''} aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>{L({ en: 'Practice', hi: 'अभ्यास' })}</button><button className={mode === 'mock' ? 'selected' : ''} aria-pressed={mode === 'mock'} onClick={() => setMode('mock')}>{L({ en: 'Timed', hi: 'समयबद्ध' })}</button></div>}</div>
            <div className="test-list">{selectedTests.map((test) => <TestRow key={test.id} test={test} L={L} onStart={() => start(test)} />)}{!selectedTests.length && <div className="test-empty">{L({ en: 'No practice sets are available in this section yet.', hi: 'इस सेक्शन में अभी अभ्यास सेट उपलब्ध नहीं हैं।' })}</div>}</div>
            {tab === 'overview' && sectionals.length > 3 && <button className="text-link test-more" onClick={() => setTab('sectional')}>{L({ en: 'See all subject practice', hi: 'सभी विषय अभ्यास देखें' })} <ArrowRight size={15} /></button>}
          </>}
          <div className="content-disclaimer"><CircleHelp size={16} /><span>{L({ en: 'Available practice uses the existing, unverified question bank. PYQ papers and research-backed full mocks have not been added.', hi: 'उपलब्ध अभ्यास मौजूदा, असत्यापित प्रश्न बैंक से है। PYQ पेपर और शोध-आधारित फुल मॉक अभी नहीं जोड़े गए हैं।' })}</span></div>
        </div>
        <aside className="exam-aside" aria-label={L({ en: 'Exam overview', hi: 'परीक्षा अवलोकन' })}>
          <div className="exam-summary"><div className="section-kicker">{L({ en: 'YOUR PREP, AT A GLANCE', hi: 'तैयारी एक नज़र में' })}</div><h3>{L({ en: 'What’s inside', hi: 'क्या उपलब्ध है' })}</h3><p>{L({ en: `Available in ${exam.name}.`, hi: `${exam.name} में उपलब्ध।` })}</p><div className="summary-rows"><div><span><Layers3 size={17} /> {L({ en: 'Subject practice', hi: 'विषय अभ्यास' })}</span><strong>{sectionals.length} {L({ en: 'sets', hi: 'सेट' })}</strong></div><div><span><Target size={17} /> {L({ en: 'Topic practice', hi: 'टॉपिक अभ्यास' })}</span><strong>{topics.length} {L({ en: 'sets', hi: 'सेट' })}</strong></div><div><span><FileClock size={17} /> {L({ en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर' })}</span><strong className="summary-soon">{L({ en: 'Not added', hi: 'उपलब्ध नहीं' })}</strong></div></div><button onClick={() => navigate(`/pyq?exam=${exam.id}`)}>{L({ en: 'Open PYQ library', hi: 'PYQ लाइब्रेरी खोलें' })}<ArrowRight size={15} /></button></div>
          {source ? <div className="official-card"><span className="official-icon"><ExternalLink size={18} /></span><div className="section-kicker">{L({ en: 'OFFICIAL SOURCE', hi: 'आधिकारिक स्रोत' })}</div><h3>{L({ en: 'Check the latest notice', hi: 'नवीनतम सूचना देखें' })}</h3><p>{L({ en: 'For current dates, eligibility and the exam pattern, refer to the official website.', hi: 'ताज़ा तारीखों, पात्रता और परीक्षा पैटर्न के लिए आधिकारिक वेबसाइट देखें।' })}{exam.source === 'rrb' && ` ${L({ en: 'Also check your regional RRB.', hi: 'अपने क्षेत्रीय आरआरबी की सूचना भी देखें।' })}`}</p><OfficialLink source={source} L={L} named /></div> : <div className="exam-tip"><span><Sparkles size={18} /></span><div><strong>{L({ en: 'One step at a time.', hi: 'एक बार में एक कदम।' })}</strong><p>{L({ en: 'Consistent practice is a great place to begin.', hi: 'नियमित अभ्यास एक अच्छी शुरुआत है।' })}</p></div></div>}
        </aside>
      </div>
    </div>
  )
}

function OfficialLink({ source, L, named = false }) {
  return <a className="official-link" href={source.url} target="_blank" rel="noopener noreferrer">{named ? L({ en: source.name, hi: source.hi }) : L({ en: 'Official website', hi: 'आधिकारिक वेबसाइट' })}<ExternalLink size={14} /><span className="sr-only">{L({ en: ' (opens in a new tab)', hi: ' (नए टैब में खुलेगा)' })}</span></a>
}

function TestRow({ test, L, onStart }) {
  const Icon = test.type === 'preview' ? ClipboardList : test.type === 'sectional' ? Layers3 : Target
  return <div className="test-row"><span className={`test-row-icon ${test.type === 'preview' ? 'purple' : test.type === 'sectional' ? 'blue' : 'orange'}`}><Icon size={20} /></span><div className="test-row-info"><span className="test-row-type">{test.type === 'preview' ? L({ en: 'MIXED PRACTICE', hi: 'मिक्स्ड अभ्यास' }) : test.type === 'sectional' ? L({ en: 'SUBJECT PRACTICE', hi: 'विषय अभ्यास' }) : L({ en: 'TOPIC PRACTICE', hi: 'टॉपिक अभ्यास' })}</span><strong>{L({ en: test.title, hi: test.hi })}</strong><span className="test-meta"><span><FileText size={13} /> {test.questions} {L({ en: 'questions', hi: 'प्रश्न' })}</span><span><Clock3 size={13} /> {test.duration} {L({ en: 'min', hi: 'मिनट' })}</span></span></div><button className="test-start" onClick={onStart}>{L({ en: 'Start', hi: 'शुरू' })}<ArrowRight size={15} /></button></div>
}
