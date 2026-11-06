import React, { useState } from 'react'
import { MATERIALS } from '../data/materials'
import { SUBJECTS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { useStore } from '../lib/store'
import { Card, CardHead, Pill, Button, useToast } from '../components/ui'

export default function MaterialReader({ materialId }) {
  const L = useL()
  const toast = useToast()
  const { state, updateProfile } = useStore()
  const m = MATERIALS.find((x) => x.id === materialId)
  const [page, setPage] = useState(0)
  const [fontSize, setFontSize] = useState(15)

  if (!m) return <div className="empty">Material not found</div>

  const isPro = state.profile?.plan === 'pro'
  const locked = !m.free && !isPro
  const perPage = 2
  const pages = Math.max(1, Math.ceil(m.sections.length / perPage))
  const shown = m.sections.slice(page * perPage, page * perPage + perPage)

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title" style={{ fontSize: 22 }}>{L(m.title)}</div>
          <div className="page-sub">
            {SUBJECTS[m.subject]?.icon} {L({ en: SUBJECTS[m.subject]?.name || m.subject, hi: SUBJECTS[m.subject]?.hi || m.subject })} · {m.pages}{' '}
            {L({ en: 'pages', hi: 'पृष्ठ' })} · {m.size}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg">
            <button onClick={() => setFontSize((f) => Math.max(12, f - 1))}>A−</button>
            <button onClick={() => setFontSize((f) => Math.min(22, f + 1))}>A+</button>
          </div>
          <Button size="sm" onClick={() => window.print()}>
            🖨 {L({ en: 'Save as PDF', hi: 'PDF सहेजें' })}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/materials')}>
            ← {L({ en: 'Library', hi: 'लाइब्रेरी' })}
          </Button>
        </div>
      </div>

      <div className="grid g-side">
        <div className="stack" style={{ gap: 18 }}>
          <Card>
            <CardHead
              title={L({ en: 'Table of contents', hi: 'विषय-सूची' })}
              right={
                <Pill tone="brand">
                  {page + 1} / {pages}
                </Pill>
              }
            />
            <div className="stack sm">
              {m.sections.map((s, i) => (
                <div
                  key={s.h.en}
                  className="row"
                  style={{ gap: 10, padding: '9px 11px', borderRadius: 11, background: 'var(--surface-2)', cursor: 'pointer', border: '1px solid var(--line)' }}
                  onClick={() => setPage(Math.floor(i / perPage))}
                >
                  <span className="pill brand" style={{ minWidth: 26, justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                  <span className="small bold" style={{ flex: 1 }}>{L(s.h)}</span>
                  <span className="tiny muted">{s.rows.length} {L({ en: 'formulas', hi: 'सूत्र' })}</span>
                </div>
              ))}
            </div>
            <div className="sep" />
            <div className="spread">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← {L({ en: 'Prev', hi: 'पिछला' })}
              </Button>
              <Button size="sm" variant="primary" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
                {L({ en: 'Next', hi: 'अगला' })} →
              </Button>
            </div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'Download', hi: 'डाउनलोड' })} />
            <div className="stack sm">
              {[
                ['📄', 'PDF (print-ready)', '2.4 MB'],
                ['📱', 'Mobile-friendly PDF', '1.8 MB'],
                ['🖼️', 'Image pages (PNG)', '12 MB'],
              ].map(([i, t, s]) => (
                <div key={t} className="row" style={{ gap: 10 }}>
                  <span>{i}</span>
                  <div style={{ flex: 1 }}>
                    <div className="small bold">{L({ en: t, hi: t })}</div>
                    <div className="tiny muted">{s}</div>
                  </div>
                  <Button size="sm" onClick={() => window.print()}>
                    ⬇
                  </Button>
                </div>
              ))}
            </div>
            <div className="sep" />
            <div className="tiny muted">
              {L({
                en: 'Downloads:',
                hi: 'डाउनलोड:',
              })}{' '}
              <span className="bold">{m.downloads.toLocaleString('en-IN')}</span> · ⭐ {m.rating} ·{' '}
              {L({ en: 'Updated', hi: 'अपडेट' })} {m.updated}
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {locked ? (
            <Card style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 42 }}>🔒</div>
              <h3 style={{ fontSize: 20, marginTop: 10 }}>{L({ en: 'Premium document', hi: 'प्रीमियम दस्तावेज़' })}</h3>
              <p className="small muted" style={{ maxWidth: 420, margin: '10px auto 18px' }}>
                {L({
                  en: 'Unlock this with EXAMEDGE Premium — unlimited mocks, all premium notes, live tests and deep analytics.',
                  hi: 'EXAMEDGE प्रीमियम के साथ अनलॉक करें — असीमित मॉक, सभी प्रीमियम नोट्स, लाइव टेस्ट और गहरा विश्लेषण।',
                })}
              </p>
              <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
                <Button variant="primary" onClick={() => navigate('/pricing')}>
                  💎 {L({ en: 'Upgrade', hi: 'अपग्रेड करें' })}
                </Button>
                <Button onClick={() => navigate('/materials')}>
                  {L({ en: 'Browse free material', hi: 'निःशुल्क सामग्री देखें' })}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {shown.map((s) => (
                <Card key={s.h.en}>
                  <div className="bold" style={{ fontSize: 18, marginBottom: 4 }}>
                    {L(s.h)}
                  </div>
                  <div className="tiny muted" style={{ marginBottom: 12 }}>
                    {L({ en: 'Essential formulas & shortcuts', hi: 'आवश्यक सूत्र एवं शॉर्टकट' })}
                  </div>
                  <div>
                    {s.rows.map((r, i) => (
                      <div key={i} className="solution-step">
                        <div className="step-n">{i + 1}</div>
                        <div style={{ flex: 1, fontSize: fontSize }}>
                          <b>{r[0]}</b>
                          <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{r[1]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              <Card>
                <CardHead
                  title={L({ en: 'Practice this topic', hi: 'इस टॉपिक का अभ्यास करें' })}
                  sub={L({ en: 'Turn theory into marks', hi: 'सिद्धांत को अंकों में बदलें' })}
                />
                <div className="row wrap" style={{ gap: 10 }}>
                  <Button variant="primary" onClick={() => navigate(`/test/${state.profile?.examId || 'ssc-cgl'}/${state.profile?.examId || 'ssc-cgl'}-topic-${m.subject}`)}>
                    🎯 {L({ en: 'Start topic drill', hi: 'टॉपिक ड्रिल शुरू करें' })}
                  </Button>
                  <Button onClick={() => {
                    toast(L({ en: 'Added to your revision list', hi: 'आपकी दोहराव सूची में जोड़ा गया' }), '🔖')
                  }}>
                    🔖 {L({ en: 'Save for revision', hi: 'दोहराव के लिए सहेजें' })}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
