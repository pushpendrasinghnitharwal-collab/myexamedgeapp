import React, { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, FileText, Info, NotebookText, Search, X } from 'lucide-react'
import { MATERIALS, MATERIAL_TYPES } from '../data/materials'
import { SUBJECTS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'

export default function Materials() {
  const L = useL()
  const [type, setType] = useState('all')
  const [subject, setSubject] = useState('all')
  const [query, setQuery] = useState('')
  const subjects = useMemo(() => [...new Set(MATERIALS.map((item) => item.subject))], [])
  const list = useMemo(() => {
    const term = query.trim().toLowerCase()
    return MATERIALS.filter((item) => (type === 'all' || item.type === type)
      && (subject === 'all' || item.subject === subject)
      && (!term || item.title.en.toLowerCase().includes(term) || item.title.hi.toLowerCase().includes(term)))
  }, [type, subject, query])

  return (
    <div className="materials-page page-shell">
      <div className="page-intro library-intro">
        <div className="intro-copy">
          <div className="section-kicker"><span className="kicker-dot" /> {L({ en: 'YOUR STUDY LIBRARY', hi: 'आपकी अध्ययन लाइब्रेरी' })}</div>
          <h1>{L({ en: 'A little knowledge.', hi: 'थोड़ा ज्ञान।' })}<br /><span>{L({ en: 'A lot of possibility.', hi: 'बहुत सारी संभावनाएँ।' })}</span></h1>
          <p>{L({ en: 'Explore the sample resources already in your library.', hi: 'अपनी लाइब्रेरी में मौजूद नमूना सामग्री देखें।' })}</p>
        </div>
      </div>

      <div className="materials-notice"><Info size={17} /><span>{L({ en: 'These existing sample resources have not yet been reviewed for accuracy.', hi: 'इन मौजूदा नमूना संसाधनों की सटीकता की अभी समीक्षा नहीं हुई है।' })}</span></div>

      <div className="browse-toolbar">
        <div><div className="section-kicker">{L({ en: 'EXPLORE AND REVISE', hi: 'पढ़ें और दोहराएँ' })}</div><h2>{L({ en: 'Study material', hi: 'अध्ययन सामग्री' })} <span>{MATERIALS.length}</span></h2><p>{L({ en: 'Find a resource for your next study session.', hi: 'अपने अगले अध्ययन सत्र के लिए सामग्री खोजें।' })}</p></div>
        <label className="browse-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={L({ en: 'Search materials', hi: 'सामग्री खोजें' })} aria-label={L({ en: 'Search materials', hi: 'सामग्री खोजें' })} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      </div>

      <div className="material-filters">
        <div className="category-tabs" aria-label="Resource type">
          {MATERIAL_TYPES.map((item) => <button key={item.id} className={type === item.id ? 'selected' : ''} aria-pressed={type === item.id} onClick={() => setType(item.id)}>{L(item.label)}</button>)}
        </div>
        <label className="material-subject"><span className="sr-only">{L({ en: 'Filter by subject', hi: 'विषय के अनुसार फ़िल्टर करें' })}</span><select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="all">{L({ en: 'All subjects', hi: 'सभी विषय' })}</option>{subjects.map((id) => <option key={id} value={id}>{L({ en: SUBJECTS[id]?.name || id, hi: SUBJECTS[id]?.hi || id })}</option>)}</select></label>
      </div>

      <div className="exam-result-count">{list.length} {L({ en: list.length === 1 ? 'resource' : 'resources', hi: 'संसाधन' })} <span>{L({ en: 'to explore', hi: 'उपलब्ध हैं' })}</span></div>
      {list.length ? <div className="material-grid">
        {list.map((item) => {
          const Icon = item.type === 'pdf' ? FileText : item.type === 'ebook' ? BookOpen : NotebookText
          const subjectName = L({ en: SUBJECTS[item.subject]?.name || item.subject, hi: SUBJECTS[item.subject]?.hi || item.subject })
          return <button className={`material-tile material-${item.type}`} key={item.id} onClick={() => navigate(`/material/${item.id}`)}>
            <span className="material-tile-top"><span className="material-icon"><Icon size={21} /></span><span className="material-status">{item.free ? L({ en: 'SAMPLE RESOURCE', hi: 'नमूना सामग्री' }) : L({ en: 'RESOURCE DETAILS', hi: 'सामग्री विवरण' })}</span></span>
            <span className="material-subject-name">{subjectName}</span>
            <strong>{L(item.title)}</strong>
            <span className="material-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
            <span className="material-tile-bottom"><span>{item.free ? L({ en: 'Open resource', hi: 'सामग्री खोलें' }) : L({ en: 'View details', hi: 'विवरण देखें' })}</span><ArrowRight size={16} /></span>
          </button>
        })}
      </div> : <div className="directory-empty"><span><Search size={24} /></span><h3>{L({ en: 'No resources found', hi: 'कोई सामग्री नहीं मिली' })}</h3><p>{L({ en: 'Try another search or filter.', hi: 'दूसरा खोज शब्द या फ़िल्टर आज़माएँ।' })}</p><button className="btn primary" onClick={() => { setQuery(''); setType('all'); setSubject('all') }}>{L({ en: 'Clear filters', hi: 'फ़िल्टर हटाएँ' })}</button></div>}
    </div>
  )
}
