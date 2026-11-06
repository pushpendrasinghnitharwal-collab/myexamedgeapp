import React, { useMemo, useState } from 'react'
import { CATEGORIES, EXAMS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, Pill, Button, EmptyState } from '../components/ui'

export default function Exams() {
  const L = useL()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    return EXAMS.filter((e) => {
      const okCat = cat === 'all' || e.category === cat
      const okQ =
        !q ||
        e.name.toLowerCase().includes(q.toLowerCase()) ||
        e.subtitle.toLowerCase().includes(q.toLowerCase()) ||
        e.hi.includes(q)
      return okCat && okQ
    })
  }, [cat, q])

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'All Exams', hi: 'सभी परीक्षाएँ' })}</div>
          <div className="page-sub">
            {L({
              en: 'Pick your target — every exam has full mocks, sectionals, topic drills and daily quizzes.',
              hi: 'अपना लक्ष्य चुनें — हर परीक्षा में फुल मॉक, सेक्शनल, टॉपिक ड्रिल और डेली क्विज़ हैं।',
            })}
          </div>
        </div>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder={L({ en: 'Search exams…', hi: 'परीक्षा खोजें…' })}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="chip-row">
        <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          🌍 {L({ en: 'All', hi: 'सभी' })} ({EXAMS.length})
        </button>
        {CATEGORIES.map((c) => {
          const n = EXAMS.filter((e) => e.category === c.id).length
          if (!n) return null
          return (
            <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
              {c.icon} {L({ en: c.name, hi: c.hi })} ({n})
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" title="No exams found" sub="Try a different keyword or category." />
        </Card>
      ) : (
        <div className="grid g3">
          {list.map((e) => {
            const c = CATEGORIES.find((x) => x.id === e.category)
            return (
              <Card key={e.id} className="exam-card" onClick={() => navigate(`/exam/${e.id}`)}>
                <div className="spread" style={{ alignItems: 'flex-start' }}>
                  <div className="exam-icon" style={{ background: `${c.color}22`, borderColor: `${c.color}55` }}>
                    {c.icon}
                  </div>
                  <Pill tone="brand">{c.name}</Pill>
                </div>
                <div style={{ marginTop: 13 }}>
                  <div className="bold" style={{ fontSize: 17 }}>{e.name}</div>
                  <div className="tiny muted" style={{ marginBottom: 8 }}>{e.subtitle}</div>
                </div>
                <div className="row wrap" style={{ gap: 7 }}>
                  <span className="pill">⏱ {e.duration} min</span>
                  <span className="pill">📝 {e.questions} Q</span>
                  <span className="pill">🎯 {e.marks} marks</span>
                </div>
                <div className="sep" />
                <div className="spread">
                  <span className="tiny muted">{e.tier}</span>
                  <span className="tiny bold" style={{ color: 'var(--accent)' }}>
                    {L({ en: 'View tests →', hi: 'टेस्ट देखें →' })}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
