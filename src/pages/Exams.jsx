import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, BriefcaseBusiness, Building2, CheckCircle2, GraduationCap, Landmark, Map, Search, Shield, TrainFront, X } from 'lucide-react'
import { CATEGORIES, EXAMS } from '../data/exams'
import { filterExams, practiceExamCount, practiceSetCount } from '../lib/examCatalog'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { useStore } from '../lib/store'

const visuals = {
  ssc: { icon: Landmark, tone: 'purple' },
  banking: { icon: Building2, tone: 'blue' },
  railway: { icon: TrainFront, tone: 'orange' },
  upsc: { icon: Landmark, tone: 'pink' },
  state: { icon: Map, tone: 'green' },
  teaching: { icon: GraduationCap, tone: 'purple' },
  defence: { icon: Shield, tone: 'blue' },
  other: { icon: BriefcaseBusiness, tone: 'orange' },
}
const validAvailability = (value) => ['practice', 'info'].includes(value) ? value : 'all'

export default function Exams({ initialCategory = 'all', initialQuery = '', initialAvailability = 'all' }) {
  const L = useL()
  const { state } = useStore()
  const [category, setCategory] = useState(initialCategory || 'all')
  const [query, setQuery] = useState(initialQuery || '')
  const [availability, setAvailability] = useState(validAvailability(initialAvailability))

  useEffect(() => { setCategory(initialCategory || 'all') }, [initialCategory])
  useEffect(() => { setQuery(initialQuery || '') }, [initialQuery])
  useEffect(() => { setAvailability(validAvailability(initialAvailability)) }, [initialAvailability])

  const list = useMemo(() => filterExams({ category, query, availability }), [category, query, availability])
  const clearFilters = () => { setCategory('all'); setQuery(''); setAvailability('all') }
  const filters = [
    { id: 'all', label: L({ en: 'All', hi: 'सभी' }), count: EXAMS.length },
    { id: 'practice', label: L({ en: 'Practice available', hi: 'अभ्यास उपलब्ध' }), count: practiceExamCount },
    { id: 'info', label: L({ en: 'Info only', hi: 'केवल जानकारी' }), count: EXAMS.length - practiceExamCount },
  ]

  return (
    <div className="browse-page page-shell">
      <div className="page-intro directory-intro">
        <div className="intro-copy"><div className="section-kicker"><span className="kicker-dot" /> {L({ en: 'FIND YOUR DIRECTION', hi: 'अपना लक्ष्य चुनें' })}</div><h1>{L({ en: 'Find your exam.', hi: 'अपनी परीक्षा खोजें।' })}<br /><span>{L({ en: 'Own your preparation.', hi: 'अपनी तैयारी को दिशा दें।' })}</span></h1><p>{L({ en: 'Discover exam goals and see where practice is ready to start.', hi: 'परीक्षाएँ खोजें और देखें कि कहाँ अभ्यास उपलब्ध है।' })}</p><div className="intro-badge"><BookOpen size={15} /> {EXAMS.length} {L({ en: 'exams listed', hi: 'परीक्षाएँ सूचीबद्ध' })} <span aria-hidden="true">·</span> {practiceExamCount} {L({ en: 'with practice', hi: 'में अभ्यास' })}</div></div>
      </div>

      <div className="browse-toolbar">
        <div><div className="section-kicker">{L({ en: 'THE EXAM DIRECTORY', hi: 'परीक्षा डायरेक्टरी' })}</div><h2>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })} <span>{EXAMS.length}</span></h2><p>{L({ en: 'Choose a category, then find the right exam for you.', hi: 'श्रेणी चुनें और अपने लिए सही परीक्षा खोजें।' })}</p></div>
        <div className="browse-search" role="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L({ en: 'Search exam or keyword', hi: 'परीक्षा या शब्द खोजें' })} aria-label={L({ en: 'Search exams by name or keyword', hi: 'परीक्षा का नाम या शब्द खोजें' })} />{query && <button type="button" aria-label={L({ en: 'Clear search', hi: 'खोज हटाएँ' })} onClick={() => setQuery('')}><X size={16} /></button>}</div>
      </div>

      <div className="category-tabs" role="group" aria-label={L({ en: 'Exam categories', hi: 'परीक्षा श्रेणियाँ' })}>
        <button className={category === 'all' ? 'selected' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>{L({ en: 'All exams', hi: 'सभी परीक्षाएँ' })} <span>{EXAMS.length}</span></button>
        {CATEGORIES.map((item) => {
          const count = EXAMS.filter((exam) => exam.category === item.id).length
          return count ? <button key={item.id} className={category === item.id ? 'selected' : ''} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{L({ en: item.name, hi: item.hi })}<span>{count}</span></button> : null
        })}
      </div>

      <div className="directory-filter-row">
        <div className="availability-filter" role="group" aria-label={L({ en: 'Filter by practice availability', hi: 'अभ्यास उपलब्धता से फ़िल्टर करें' })}>
          <span>{L({ en: 'SHOW', hi: 'दिखाएँ' })}</span>
          {filters.map((item) => <button key={item.id} className={availability === item.id ? 'selected' : ''} aria-pressed={availability === item.id} onClick={() => setAvailability(item.id)}>{item.label} <small>{item.count}</small></button>)}
        </div>
        <div className="exam-result-count" aria-live="polite">{list.length} {L({ en: list.length === 1 ? 'exam' : 'exams', hi: 'परीक्षाएँ' })} <span>{L({ en: 'found', hi: 'मिलीं' })}</span></div>
      </div>

      {list.length ? <div className="exam-directory">
        {list.map((exam) => {
          const cat = CATEGORIES.find((item) => item.id === exam.category)
          const visual = visuals[exam.category]
          const Icon = visual.icon
          const sets = practiceSetCount(exam.id)
          const isTarget = state.profile?.examId === exam.id
          return <button className={`directory-card tone-${visual.tone}`} key={exam.id} onClick={() => navigate(`/exam/${exam.id}`)}>
            <span className="directory-top"><span className={`directory-icon ${visual.tone}`}><Icon size={22} strokeWidth={1.8} /></span><span className="directory-category">{L({ en: cat.name, hi: cat.hi })}</span></span>
            <span className="directory-name">{exam.name}{isTarget && <span className="directory-target">{L({ en: 'YOUR TARGET', hi: 'आपका लक्ष्य' })}</span>}</span>
            <span className="directory-subtitle">{exam.subtitle}</span>
            <span className={`directory-status ${sets ? 'available' : 'unavailable'}`}>
              {sets ? <CheckCircle2 size={15} /> : <BookOpen size={15} />}
              {sets ? `${sets} ${L({ en: sets === 1 ? 'practice set' : 'practice sets', hi: 'अभ्यास सेट' })}` : L({ en: 'Practice not added', hi: 'अभ्यास अभी नहीं जोड़ा गया' })}
            </span>
            <span className="directory-bottom"><span>{sets ? L({ en: 'Explore practice', hi: 'अभ्यास देखें' }) : L({ en: 'View exam details', hi: 'परीक्षा विवरण देखें' })}</span><span className="directory-arrow"><ArrowRight size={16} /></span></span>
          </button>
        })}
      </div> : <div className="directory-empty"><span><Search size={24} /></span><h3>{L({ en: 'No exams found', hi: 'कोई परीक्षा नहीं मिली' })}</h3><p>{L({ en: 'Try a different search or change your filters.', hi: 'दूसरा नाम खोजें या फ़िल्टर बदलें।' })}</p><button className="btn primary" onClick={clearFilters}>{L({ en: 'Clear filters', hi: 'फ़िल्टर हटाएँ' })}</button></div>}
    </div>
  )
}
