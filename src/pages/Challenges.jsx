import React, { useMemo, useState } from 'react'
import { FRIENDS } from '../lib/leaderboard'
import { EXAMS } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, Bar, useToast, Modal, EmptyState } from '../components/ui'

const AV = ['linear-gradient(135deg,#6366f1,#8b5cf6)', 'linear-gradient(135deg,#f43f5e,#fb7185)', 'linear-gradient(135deg,#10b981,#34d399)', 'linear-gradient(135deg,#f59e0b,#fbbf24)', 'linear-gradient(135deg,#22d3ee,#67e8f9)']

export default function Challenges() {
  const L = useL()
  const toast = useToast()
  const { state } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [examId, setExamId] = useState(state.profile?.examId || 'ssc-cgl')
  const [selected, setSelected] = useState(['f1', 'f2'])
  const [invite, setInvite] = useState('')

  const drills = useMemo(
    () => (TEST_CATALOGUE[examId] || []).filter((t) => t.type === 'drill' || t.type === 'topic').slice(0, 6),
    [examId]
  )

  const active = [
    { id: 'c1', title: '10-Question Sprint', opponent: FRIENDS[0], myScore: 8, oppScore: 7, total: 10, ends: '2h left', exam: 'SSC CGL' },
    { id: 'c2', title: 'Quant Speed Battle', opponent: FRIENDS[1], myScore: 12, oppScore: 14, total: 20, ends: '1d left', exam: 'IBPS PO' },
    { id: 'c3', title: 'GK Marathon', opponent: FRIENDS[3], myScore: 25, oppScore: 25, total: 50, ends: '3d left', exam: 'RRB NTPC' },
  ]

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Challenges', hi: 'चुनौतियाँ' })}</div>
          <div className="page-sub">
            {L({
              en: 'Head-to-head contests with friends. Same paper, same timer, one winner.',
              hi: 'दोस्तों के साथ आमने-सामने मुकाबला। एक ही पेपर, एक ही टाइमर, एक ही विजेता।',
            })}
          </div>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          ＋ {L({ en: 'Create challenge', hi: 'चुनौती बनाएँ' })}
        </Button>
      </div>

      <div className="grid g3">
        <Card>
          <Stat icon="⚔️" value={active.length} label={L({ en: 'Active challenges', hi: 'सक्रिय चुनौतियाँ' })} />
        </Card>
        <Card>
          <Stat icon="🏅" value={12} label={L({ en: 'Challenges won', hi: 'जीती गई चुनौतियाँ' })} />
        </Card>
        <Card>
          <Stat icon="🥇" value="78%" label={L({ en: 'Win rate', hi: 'जीत दर' })} />
        </Card>
      </div>

      <Card>
        <CardHead
          icon="⚔️"
          title={L({ en: 'Live challenges', hi: 'लाइव चुनौतियाँ' })}
          sub={L({ en: 'You have not accepted any pending challenge', hi: 'आपने कोई लंबित चुनौती स्वीकार नहीं की है' })}
        />
        <div className="stack" style={{ gap: 14 }}>
          {active.map((c) => {
            const mine = c.myScore / c.total
            const theirs = c.oppScore / c.total
            const leading = mine >= theirs
            return (
              <div key={c.id} className="card" style={{ background: 'var(--surface-2)', padding: 16 }}>
                <div className="spread" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="bold">{c.title}</div>
                    <div className="tiny muted">
                      {c.exam} · {c.ends}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <Pill tone={leading ? 'success' : 'danger'}>
                      {leading ? '🏆 ' + L({ en: 'Leading', hi: 'आगे' }) : L({ en: 'Trailing', hi: 'पीछे' })}
                    </Pill>
                    <Button size="sm" variant="primary" onClick={() => navigate(`/test/${c.exam.toLowerCase().replace(/\s+/g, '-')}/${c.exam.toLowerCase().replace(/\s+/g, '-')}-drill`)}>
                      {L({ en: 'Attempt', hi: 'प्रयास करें' })}
                    </Button>
                  </div>
                </div>
                <div className="sep" />
                <div className="row" style={{ gap: 14 }}>
                  <div className="avatar" style={{ background: AV[0], width: 34, height: 34, fontSize: 12 }}>
                    {(state.profile?.name || 'Y')[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="spread tiny" style={{ marginBottom: 4 }}>
                      <span className="bold">{state.profile?.name || 'You'}</span>
                      <span className="num bold">{c.myScore}/{c.total}</span>
                    </div>
                    <Bar value={mine} tone="linear-gradient(90deg,#6366f1,#22d3ee)" />
                  </div>
                  <div className="avatar" style={{ background: AV[3], width: 34, height: 34, fontSize: 12 }}>
                    {c.opponent.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="spread tiny" style={{ marginBottom: 4 }}>
                      <span className="bold">{c.opponent.name}</span>
                      <span className="num bold">{c.oppScore}/{c.total}</span>
                    </div>
                    <Bar value={theirs} tone="linear-gradient(90deg,#f59e0b,#fbbf24)" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid g2">
        <Card>
          <CardHead icon="📨" title={L({ en: 'Invite friends', hi: 'दोस्तों को बुलाएँ' })} sub={L({ en: 'Share a code — no app install needed', hi: 'कोड साझा करें — ऐप इंस्टॉल करने की ज़रूरत नहीं' })} />
          <div className="field">
            <label>{L({ en: 'Invite code', hi: 'आमंत्रण कोड' })}</label>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="EXAMEDGE-XXXX" />
              <Button
                onClick={() => {
                  navigator.clipboard?.writeText(invite || 'EXAMEDGE-7K2M')
                  toast('Invite code copied', '📋')
                }}
              >
                ⬇
              </Button>
            </div>
          </div>
          <Button
            className="block"
            variant="primary"
            onClick={() => {
              navigator.clipboard?.writeText(`Join me on EXAMEDGE! Use my invite code: ${invite || 'EXAMEDGE-7K2M'}`)
              toast('Invite link copied to clipboard', '📤')
            }}
          >
            📤 {L({ en: 'Copy invite link', hi: 'आमंत्रण लिंक कॉपी करें' })}
          </Button>
          <div className="sep" />
          <div className="tiny muted">
            {L({
              en: 'Friends on EXAMEDGE:',
              hi: 'EXAMEDGE पर दोस्त:',
            })}{' '}
            <span className="bold">{FRIENDS.length}</span>
          </div>
        </Card>

        <Card>
          <CardHead icon="🔥" title={L({ en: 'Daily streak challenge', hi: 'दैनिक स्ट्रीक चुनौती' })} sub={L({ en: 'Solve 20 questions every day for 7 days', hi: '7 दिनों तक हर दिन 20 प्रश्न हल करें' })} />
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="spread small" style={{ marginBottom: 6 }}>
                <span className="bold">Day {Math.min(7, state.streak.count)} of 7</span>
                <span className="muted num">{Math.min(7, state.streak.count)}/7</span>
              </div>
              <Bar value={Math.min(1, state.streak.count / 7)} />
              <div className="row wrap" style={{ gap: 5, marginTop: 10 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 13,
                      background: i < state.streak.count ? 'var(--grad)' : 'var(--surface-3)',
                      color: i < state.streak.count ? '#fff' : 'var(--muted)',
                      fontWeight: 800,
                    }}
                  >
                    {i < state.streak.count ? '✓' : i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="sep" />
          <div className="kv">
            <span className="k">{L({ en: 'Reward on completion', hi: 'पूरा होने पर पुरस्कार' })}</span>
            <span className="bold">+200 XP · 💎 Badge</span>
          </div>
        </Card>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={L({ en: 'Create a challenge', hi: 'चुनौती बनाएँ' })}>
        <div className="field">
          <label>{L({ en: 'Choose exam', hi: 'परीक्षा चुनें' })}</label>
          <select className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
            {EXAMS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{L({ en: 'Pick the paper', hi: 'पेपर चुनें' })}</label>
          <div className="stack sm">
            {drills.map((t) => (
              <div key={t.id} className="row" style={{ gap: 10, padding: '9px 11px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                <span>🎯</span>
                <div style={{ flex: 1 }}>
                  <div className="small bold">{L({ en: t.title, hi: t.hi })}</div>
                  <div className="tiny muted">
                    {t.questions} Q · {t.duration} min
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowCreate(false)}>
                  {L({ en: 'Select', hi: 'चुनें' })}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{L({ en: 'Challenge friends', hi: 'दोस्तों को चुनें' })}</label>
          <div className="stack sm">
            {FRIENDS.map((f) => {
              const on = selected.includes(f.id)
              return (
                <div
                  key={f.id}
                  className="row"
                  style={{ gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)' }}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 7,
                      background: on ? 'var(--grad)' : 'var(--surface-3)',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {on ? '✓' : ''}
                  </div>
                  <div className="avatar" style={{ background: AV[f.avatar % 5], width: 28, height: 28, fontSize: 11, borderRadius: 8 }}>
                    {f.name[0]}
                  </div>
                  <span className="small bold" style={{ flex: 1 }}>
                    {f.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Button className="block" onClick={() => setShowCreate(false)}>
            {L({ en: 'Cancel', hi: 'रद्द करें' })}
          </Button>
          <Button
            variant="primary"
            className="block"
            onClick={() => {
              setShowCreate(false)
              toast(L({ en: `Challenge sent to ${selected.length} friends!`, hi: `${selected.length} दोस्तों को चुनौती भेजी गई!` }), '⚔️')
            }}
          >
            ⚔️ {L({ en: 'Send challenge', hi: 'चुनौती भेजें' })}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
