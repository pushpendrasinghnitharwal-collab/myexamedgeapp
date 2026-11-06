import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, BriefcaseBusiness, Building2, GraduationCap, Landmark, Map, Search, Shield, TrainFront, X } from 'lucide-react'
import { CATEGORIES, EXAMS } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'

const visuals = {
  ssc: { icon: Landmark, tone: 'purple', initials: 'SSC' },
  banking: { icon: Building2, tone: 'blue', initials: 'BANK' },
  railway: { icon: TrainFront, tone: 'orange', initials: 'RRB' },
  upsc: { icon: Landmark, tone: 'pink', initials: 'UPSC' },
  state: { icon: Map, tone: 'green', initials: 'PSC' },
  teaching: { icon: GraduationCap, tone: 'purple', initials: 'TET' },
  defence: { icon: Shield, tone: 'blue', initials: 'DEF' },
  other: { icon: BriefcaseBusiness, tone: 'orange', initials: 'EXAM' },
}

export default function Exams({ initialCategory = 'all', initialQuery = '' }) {
  const L = useL()
  const [category, setCategory] = useState(initialCategory || 'all')
  const [query, setQuery] = useState(initialQuery || '')

  useEffect(() => { setCategory(initialCategory || 'all') }, [initialCategory])
  useEffect(() => { setQuery(initialQuery || '') }, [initialQuery])

  const list = useMemo(() => {
    const search = query.trim().toLowerCase()
    return EXAMS.filter((exam) => {
      const matchesCategory = category === 'all' || exam.category === category
      const matchesSearch = !search || `${exam.name} ${exam.subtitle} ${exam.hi}`.toLowerCase().includes(search)
      return matchesCategory && matchesSearch
    })
  }, [category, query])

  return (
    <div className="browse-page page-shell">
      <div className="page-intro directory-intro">
        <div className="intro-copy"><div className="section-kicker"><span className="kicker-dot" /> {L({ en: 'FIND YOUR DIRECTION', hi: 'अपना लक्ष्य चुनें' })}</div><h1>{L({ en: 'Find your exam.', hi: 'अपनी परीक्षा खोजें।' })}<br /><span>{L({ en: 'Own your preparation.', hi: 'अपनी तैयारी को दिशा दें।' })}</span></h1><p>{L({ en: 'From your first practice set to the final stretch, start here.', hi: 'पहले अभ्यास से लेकर परीक्षा तक, शुरुआत यहाँ से करें।' })}</p><div className="intro-badge"><BookOpen size={15} /> {EXAMS.length} {L({ en: 'exam pathways to explore', hi: 'परीक्षा विकल्प' })}</div></div>
      </div>

      <div className="browse-toolbar">
        <div><div className="section-kicker">{L({ en: 'THE EXAM DIRECTORY', hi: 'परीक्षा डायरेक्टरी' })}</div><h2>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })} <span>{EXAMS.length}</span></h2><p>{L({ en: 'Choose your goal to explore its preparation space.', hi: 'तैयारी शुरू करने के लिए अपना लक्ष्य चुनें।' })}</p></div>
        <label className="browse-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L({ en: 'Search by exam name', hi: 'परीक्षा का नाम खोजें' })} aria-label="Search by exam name" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      </div>

      <div className="category-tabs" aria-label="Exam categories">
        <button className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>{L({ en: 'All exams', hi: 'सभी परीक्षाएँ' })} <span>{EXAMS.length}</span></button>
        {CATEGORIES.map((item) => {
          const count = EXAMS.filter((exam) => exam.category === item.id).length
          return count ? <button key={item.id} className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)}>{L({ en: item.name, hi: item.hi })}<span>{count}</span></button> : null
        })}
      </div>

      <div className="exam-result-count">{list.length} {L({ en: list.length === 1 ? 'exam' : 'exams', hi: 'परीक्षाएँ' })} <span>{L({ en: 'to explore', hi: 'उपलब्ध हैं' })}</span></div>
      {list.length ? <div className="exam-directory">
        {list.map((exam) => {
          const cat = CATEGORIES.find((item) => item.id === exam.category)
          const visual = visuals[exam.category]
          const Icon = visual.icon
          const sets = (TEST_CATALOGUE[exam.id] || []).filter((test) => ['preview', 'sectional', 'topic'].includes(test.type)).length
          return <button className="directory-card" key={exam.id} onClick={() => navigate(`/exam/${exam.id}`)}>
            <span className="directory-top"><span className={`directory-icon ${visual.tone}`}><Icon size={22} strokeWidth={1.8} /></span><span className="directory-category">{L({ en: cat.name, hi: cat.hi })}</span></span>
            <strong>{exam.name}</strong><span className="directory-subtitle">{exam.subtitle}</span>
            <span className="directory-meta"><span><BookOpen size={14} /> {sets} {L({ en: 'practice sets', hi: 'अभ्यास सेट' })}</span><span className="directory-dot" />{exam.tier}</span>
            <span className="directory-bottom"><span>{L({ en: 'Explore preparation', hi: 'तैयारी देखें' })}</span><span className="directory-arrow"><ArrowRight size={16} /></span></span>
          </button>
        })}
      </div> : <div className="directory-empty"><span><Search size={24} /></span><h3>{L({ en: 'No exams found', hi: 'कोई परीक्षा नहीं मिली' })}</h3><p>{L({ en: 'Try a different search or choose another category.', hi: 'दूसरा नाम या श्रेणी चुनें।' })}</p><button className="btn primary" onClick={() => { setCategory('all'); setQuery('') }}>{L({ en: 'Clear filters', hi: 'फ़िल्टर हटाएँ' })}</button></div>}
    </div>
  )
}
