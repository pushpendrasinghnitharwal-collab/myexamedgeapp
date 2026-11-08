import React, { useEffect, useState } from 'react'
import { ArrowRight, BookOpenCheck, ChevronDown, Clock3, FileClock, Files, SearchCheck, ShieldCheck } from 'lucide-react'
import { CATEGORIES, EXAMS, examById } from '../data/exams'
import { useStore } from '../lib/store'
import { useL } from '../lib/i18n'
import { navigate } from '../lib/router'
import { hasPractice } from '../lib/examCatalog'

export default function PYQLibrary({ selectedExam }) {
  const { state } = useStore()
  const L = useL()
  const initial = examById(selectedExam) ? selectedExam : (state.profile?.examId || 'ssc-cgl')
  const [examId, setExamId] = useState(initial)
  const [year, setYear] = useState('all')
  useEffect(() => {
    setExamId(examById(selectedExam) ? selectedExam : (state.profile?.examId || 'ssc-cgl'))
  }, [selectedExam, state.profile?.examId])
  const exam = examById(examId) || examById('ssc-cgl')
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, index) => thisYear - index)
  const visibleYears = year === 'all' ? years : years.filter((item) => item === year)

  const changeExam = (id) => {
    setExamId(id)
    setYear('all')
    navigate(`/pyq?exam=${encodeURIComponent(id)}`)
  }

  return (
    <div className="pyq-page page-shell">
      <div className="pyq-hero">
        <div><div className="hero-overline"><FileClock size={15} /> {L({ en: 'THE PAPER LIBRARY', hi: 'पेपर लाइब्रेरी' })}</div><h1>{L({ en: 'Learn from the past.', hi: 'पुराने पेपर से सीखें।' })}<br /><span>{L({ en: 'Prepare for what’s next.', hi: 'आने वाली परीक्षा की तैयारी करें।' })}</span></h1><p>{L({ en: 'A separate space for previous year papers, organised exam by exam.', hi: 'हर परीक्षा के पिछले वर्ष के पेपर के लिए एक अलग जगह।' })}</p></div>
      </div>

      <div className="pyq-layout">
        <div>
          <div className="browse-toolbar pyq-toolbar"><div><div className="section-kicker">{L({ en: 'EXPLORE BY EXAM', hi: 'परीक्षा के अनुसार देखें' })}</div><h2>{L({ en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर' })}</h2><p>{L({ en: 'Select your exam and the year you want to explore.', hi: 'अपनी परीक्षा और वर्ष चुनें।' })}</p></div>
            <label className="pyq-select"><span className="sr-only">Select exam</span><select value={exam.id} onChange={(event) => changeExam(event.target.value)}>{CATEGORIES.map((category) => <optgroup key={category.id} label={category.name}>{EXAMS.filter((item) => item.category === category.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup>)}</select><ChevronDown size={16} /></label>
          </div>
          <div className="pyq-filter"><span>{L({ en: 'YEAR', hi: 'वर्ष' })}</span><div className="year-tabs"><button className={year === 'all' ? 'selected' : ''} onClick={() => setYear('all')}>{L({ en: 'All years', hi: 'सभी वर्ष' })}</button>{years.map((item) => <button key={item} className={year === item ? 'selected' : ''} onClick={() => setYear(item)}>{item}</button>)}</div></div>
          <div className="pyq-empty-banner"><span><Files size={22} /></span><div><strong>{L({ en: `Papers for ${exam.name} are not added yet`, hi: `${exam.name} के पेपर अभी नहीं जोड़े गए हैं` })}</strong><p>{L({ en: 'This is a preview of the library. Year-wise papers will appear here when they are available.', hi: 'यह लाइब्रेरी का प्रीव्यू है। उपलब्ध होने पर वर्षवार पेपर यहाँ दिखेंगे।' })}</p></div></div>
          <div className="pyq-years">{visibleYears.map((item) => <div className="pyq-year-row" key={item}><span className="pyq-year-icon"><FileClock size={19} /></span><span className="pyq-year-title"><strong>{exam.name} · {item}</strong><small>{L({ en: 'Year-wise paper', hi: 'वर्षवार पेपर' })}</small></span><span className="pyq-status"><Clock3 size={13} /> {L({ en: 'Not added yet', hi: 'अभी उपलब्ध नहीं' })}</span></div>)}</div>
          <button className="text-link pyq-back" onClick={() => navigate(hasPractice(exam.id) ? `/exam/${exam.id}` : '/exams')}>{hasPractice(exam.id) ? <>{L({ en: 'Explore practice for', hi: 'अभ्यास देखें' })} {exam.name}</> : L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })} <ArrowRight size={15} /></button>
        </div>
        <aside className="pyq-research-card" aria-label="Research plan"><span className="research-icon"><SearchCheck size={22} /></span><div className="section-kicker">{L({ en: 'THE PLAN', hi: 'योजना' })}</div><h3>{L({ en: 'Built with purpose.', hi: 'सोच-समझकर तैयार।' })}</h3><p>{L({ en: 'The library is designed to make exam research easier to navigate.', hi: 'परीक्षा शोध को व्यवस्थित रखने के लिए यह लाइब्रेरी बनाई गई है।' })}</p><div className="research-list"><div><span><ShieldCheck size={16} /></span><div><strong>{L({ en: 'Source-first', hi: 'पहले स्रोत' })}</strong><small>{L({ en: 'Paper sources to be verified', hi: 'पेपर स्रोतों का सत्यापन' })}</small></div></div><div><span><Files size={16} /></span><div><strong>{L({ en: 'Exam & year-wise', hi: 'परीक्षा और वर्षवार' })}</strong><small>{L({ en: 'Easy to find and revisit', hi: 'खोजने और दोहराने में आसान' })}</small></div></div><div><span><BookOpenCheck size={16} /></span><div><strong>{L({ en: 'Analysis-ready', hi: 'विश्लेषण के लिए तैयार' })}</strong><small>{L({ en: 'A foundation for future insights', hi: 'आगे के विश्लेषण की शुरुआत' })}</small></div></div></div><div className="research-note">{L({ en: 'No papers or analysis have been added in this interface preview.', hi: 'इस प्रीव्यू में अभी पेपर या विश्लेषण नहीं जोड़े गए हैं।' })}</div></aside>
      </div>
    </div>
  )
}
