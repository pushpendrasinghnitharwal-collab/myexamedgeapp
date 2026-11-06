import React, { useMemo, useState } from 'react'
import { MATERIALS, MATERIAL_TYPES } from '../data/materials'
import { SUBJECTS } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { useStore } from '../lib/store'
import { Card, CardHead, Pill, Button, EmptyState } from '../components/ui'

export default function Materials() {
  const L = useL()
  const { state } = useStore()
  const [type, setType] = useState('all')
  const [subj, setSubj] = useState('all')
  const [q, setQ] = useState('')

  const subs = useMemo(() => {
    const set = new Set(MATERIALS.map((m) => m.subject))
    return [...set]
  }, [])

  const list = useMemo(
    () =>
      MATERIALS.filter((m) => {
        const okT = type === 'all' || m.type === type
        const okS = subj === 'all' || m.subject === subj
        const okQ = !q || m.title.en.toLowerCase().includes(q.toLowerCase()) || m.title.hi.includes(q)
        return okT && okS && okQ
      }),
    [type, subj, q]
  )

  const free = MATERIALS.filter((m) => m.free).length

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Study Material', hi: 'अध्ययन सामग्री' })}</div>
          <div className="page-sub">
            {L({
              en: `${MATERIALS.length} titles · ${free} free forever · notes, formula sheets, PYQ bundles and monthly magazines.`,
              hi: `${MATERIALS.length} शीर्षक · ${free} सदा के लिए निःशुल्क · नोट्स, सूत्र पत्रक, PYQ बंडल और मासिक पत्रिकाएँ।`,
            })}
          </div>
        </div>
        <input
          className="input"
          style={{ maxWidth: 250 }}
          placeholder={L({ en: 'Search material…', hi: 'सामग्री खोजें…' })}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="row wrap" style={{ gap: 14 }}>
        <div className="chip-row">
          {MATERIAL_TYPES.map((t) => (
            <button key={t.id} className={`chip ${type === t.id ? 'on' : ''}`} onClick={() => setType(t.id)}>
              {t.icon} {L(t.label)}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <button className={`chip ${subj === 'all' ? 'on' : ''}`} onClick={() => setSubj('all')}>
            {L({ en: 'All subjects', hi: 'सभी विषय' })}
          </button>
          {subs.map((s) => (
            <button key={s} className={`chip ${subj === s ? 'on' : ''}`} onClick={() => setSubj(s)}>
              {SUBJECTS[s]?.icon} {L({ en: SUBJECTS[s]?.name || s, hi: SUBJECTS[s]?.hi || s })}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" title="Nothing found" sub="Try a different filter or keyword." />
        </Card>
      ) : (
        <div className="grid g3">
          {list.map((m) => (
            <Card key={m.id} className="exam-card" onClick={() => navigate(`/material/${m.id}`)}>
              <div className="spread" style={{ alignItems: 'flex-start' }}>
                <div className="exam-icon" style={{ background: 'var(--grad-soft)', borderColor: 'rgba(99,102,241,0.35)' }}>
                  {m.type === 'pdf' ? '📄' : m.type === 'ebook' ? '📖' : '📝'}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {m.free ? <Pill tone="success">FREE</Pill> : <Pill tone="gold">PRO</Pill>}
                </div>
              </div>
              <div className="bold" style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.4 }}>{L(m.title)}</div>
              <div className="row wrap tiny muted" style={{ gap: 10, marginTop: 8 }}>
                <span>📄 {m.pages} {L({ en: 'pages', hi: 'पृष्ठ' })}</span>
                <span>💾 {m.size}</span>
                <span>⭐ {m.rating}</span>
                <span>⬇ {(m.downloads / 1000).toFixed(1)}k</span>
              </div>
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                {m.tags.map((t) => (
                  <span key={t} className="pill">
                    {t}
                  </span>
                ))}
              </div>
              <div className="sep" />
              <div className="spread">
                <span className="tiny muted">{L({ en: 'Updated', hi: 'अपडेट' })} {m.updated}</span>
                <span className="tiny bold" style={{ color: 'var(--accent)' }}>
                  {L({ en: 'Open →', hi: 'खोलें →' })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
