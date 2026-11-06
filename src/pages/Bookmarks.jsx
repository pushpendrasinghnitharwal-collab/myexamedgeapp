import React, { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { QUESTIONS } from '../data/questions'
import { TOPICS, SUBJECTS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, EmptyState, useToast } from '../components/ui'

const KEYS = ['A', 'B', 'C', 'D']

export default function Bookmarks() {
  const { state, toggleBookmark } = useStore()
  const L = useL()
  const toast = useToast()
  const [open, setOpen] = useState(null)

  const saved = useMemo(
    () => state.bookmarks.map((id) => QUESTIONS.find((q) => q.id === id)).filter(Boolean),
    [state.bookmarks]
  )

  if (!saved.length) {
    return (
      <Card>
        <EmptyState
          icon="🔖"
          title="No saved questions yet"
          sub="Tap the ☆ on any question while taking a test to save it here for revision."
          action={<Button variant="primary" onClick={() => navigate('/exams')}>Browse tests</Button>}
        />
      </Card>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Saved questions', hi: 'सहेजे गए प्रश्न' })}</div>
          <div className="page-sub">
            {L({
              en: `${saved.length} questions saved on this device for revision.`,
              hi: `दोहराव के लिए इस डिवाइस पर ${saved.length} प्रश्न सहेजे गए हैं।`,
            })}
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate('/analytics')}>
          📊 {L({ en: 'Analytics', hi: 'विश्लेषण' })}
        </Button>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {saved.map((q) => {
          const isOpen = open === q.id
          return (
            <Card key={q.id}>
              <div className="spread" style={{ marginBottom: 10 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Pill tone="brand">{TOPICS[q.topic]?.name}</Pill>
                  <Pill>{SUBJECTS[TOPICS[q.topic]?.subject]?.short}</Pill>
                  <Pill tone={q.diff === 'easy' ? 'success' : q.diff === 'medium' ? 'warn' : 'danger'}>{q.diff}</Pill>
                </div>
                <button
                  className="icon-btn"
                  style={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.5)' }}
                  onClick={() => {
                    toggleBookmark(q.id)
                    toast('Removed from saved', '🗑')
                  }}
                >
                  ★
                </button>
              </div>
              <div className="q-text" style={{ fontSize: 15 }}>{L(q.q)}</div>
              {isOpen ? (
                <>
                  {q.o.map((o, i) => (
                    <div key={i} className={`option ${i === q.a ? 'correct' : ''}`} style={{ cursor: 'default' }}>
                      <div className="opt-key">{KEYS[i]}</div>
                      <div style={{ flex: 1 }}>{L(o)}</div>
                      {i === q.a && <span className="pill success">✓</span>}
                    </div>
                  ))}
                  <div className="explain" style={{ marginTop: 12 }}>
                    <b>{L({ en: 'Solution: ', hi: 'समाधान: ' })}</b>
                    {L(q.exp)}
                  </div>
                </>
              ) : (
                <Button size="sm" onClick={() => setOpen(isOpen ? null : q.id)}>
                  {L({ en: 'Show answer & solution', hi: 'उत्तर और समाधान दिखाएँ' })}
                </Button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
