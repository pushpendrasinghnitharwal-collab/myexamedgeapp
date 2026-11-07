import React, { useState } from 'react'
import { MATERIALS } from '../data/materials'
import { SUBJECTS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { useStore } from '../lib/store'
import { Card, CardHead, Pill, Button } from '../components/ui'
import { Info } from 'lucide-react'

export default function MaterialReader({ materialId }) {
  const L = useL()
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
          <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>{L(m.title)}</h1>
          <div className="page-sub">
            {L({ en: SUBJECTS[m.subject]?.name || m.subject, hi: SUBJECTS[m.subject]?.hi || m.subject })} · {L({ en: 'Sample resource', hi: 'नमूना सामग्री' })}
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

      <div className="content-disclaimer"><Info size={16} /><span>{L({ en: 'This existing sample resource has not yet been reviewed for accuracy.', hi: 'इस मौजूदा नमूना सामग्री की सटीकता की अभी समीक्षा नहीं हुई है।' })}</span></div>

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
                <button
                  type="button"
                  key={s.h.en}
                  className="row"
                  style={{ gap: 10, width: '100%', padding: '9px 11px', borderRadius: 11, background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)' }}
                  onClick={() => setPage(Math.floor(i / perPage))}
                >
                  <span className="pill brand" style={{ minWidth: 26, justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                  <span className="small bold" style={{ flex: 1 }}>{L(s.h)}</span>
                  <span className="tiny muted">{s.rows.length} {L({ en: 'formulas', hi: 'सूत्र' })}</span>
                </button>
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
            <CardHead title={L({ en: 'Print this page', hi: 'यह पृष्ठ प्रिंट करें' })} sub={L({ en: 'Use your browser to print or save this page as a PDF.', hi: 'इस पृष्ठ को प्रिंट या PDF के रूप में सेव करने के लिए ब्राउज़र का उपयोग करें।' })} />
            <Button size="sm" onClick={() => window.print()}>{L({ en: 'Print or save as PDF', hi: 'प्रिंट या PDF सेव करें' })}</Button>
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {locked ? (
            <Card style={{ textAlign: 'center', padding: 40 }}>
              <h3 style={{ fontSize: 20, marginTop: 10 }}>{L({ en: 'Resource unavailable', hi: 'सामग्री उपलब्ध नहीं है' })}</h3>
              <p className="small muted" style={{ maxWidth: 420, margin: '10px auto 18px' }}>
                {L({ en: 'This sample resource is not currently available to open on the free plan.', hi: 'यह नमूना सामग्री निःशुल्क योजना में अभी खोलने के लिए उपलब्ध नहीं है।' })}
              </p>
              <Button onClick={() => navigate('/materials')}>{L({ en: 'Back to library', hi: 'लाइब्रेरी पर वापस जाएँ' })}</Button>
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
                  <Button variant="primary" onClick={() => navigate(`/exam/${state.profile?.examId || 'ssc-cgl'}?tab=sectional`)}>
                    {L({ en: 'Browse practice sets', hi: 'अभ्यास सेट देखें' })}
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
