import React, { useState } from 'react'
import { useStore, useAttemptStats } from '../lib/store'
import { api, isLoggedIn } from '../lib/api'
import { EXAMS, examById, CATEGORIES } from '../data/exams'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, Stat, Bar, Modal } from '../components/ui'
import { shortDate } from '../lib/utils'

function AccountCard() {
  const { state, login, logout } = useStore()
  const L = useL()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const loggedIn = isLoggedIn() && state.auth?.user

  const doLogin = async () => {
    setBusy(true); setMsg(null)
    try {
      const u = await login(email.trim(), password)
      setMsg({ ok: true, text: `Logged in as ${u.name} — attempts now sync to the server` })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally { setBusy(false) }
  }

  return (
    <Card style={{ padding: 18 }}>
      <CardHead title={L({ en: 'Account & Cloud Sync', hi: 'खाता और क्लाउड sync' })} sub={L({ en: 'Sign in so attempts, streaks and leaderboard work across devices', hi: 'साइन इन करें ताकिbezeichnung, streak और leaderboard सभी devices पर sync हों' })} />
      {loggedIn ? (
        <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
          <Pill tone="ok">{state.auth.user.email}</Pill>
          <span className="muted" style={{ fontSize: 13 }}>{L({ en: 'Plan', hi: 'योजना' })}: {state.auth.user.plan} · XP {state.auth.user.xp} · 🔥 {state.auth.user.streak}</span>
          <Button variant="ghost" onClick={logout}>{L({ en: 'Sign out', hi: 'साइन आउट' })}</Button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row wrap" style={{ gap: 10 }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="email — e.g. 9876543210@examedge.in"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" type="password" style={{ flex: '1 1 160px' }} placeholder={L({ en: 'password', hi: 'पासवर्ड' })}
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button onClick={doLogin} disabled={busy || !email || !password}>{busy ? '…' : L({ en: 'Sign in', hi: 'साइन इन' })}</Button>
          </div>
          {msg && <div style={{ fontSize: 13, color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</div>}
          <div className="muted" style={{ fontSize: 12 }}>
            {L({ en: 'Tip: your onboarding phone number is your password. New here? Register from the welcome screen and your account is created automatically.', hi: 'टिप: आपका onboarding phone number ही आपका पासवर्ड है।' })}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Profile() {
  const { state, updateProfile } = useStore()
  const L = useL()
  const stats = useAttemptStats()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.profile?.name || '')
  const [examId, setExamId] = useState(state.profile?.examId || 'ssc-cgl')

  const p = state.profile
  const level = Math.floor(state.xp / 500) + 1
  const levelProgress = (state.xp % 500) / 500
  const target = examById(p?.examId)

  const BADGES = [
    ['🎯', 'First Steps', 'first-test'],
    ['🔥', '7-Day Streak', 'streak-7'],
    ['🏆', 'Test Warrior', 'tests-10'],
    ['💎', 'Sharpshooter', 'accuracy-80'],
    ['🧮', 'Quant Ace', 'quant-90'],
  ]

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="hero">
        <div className="spread" style={{ flexWrap: 'wrap', gap: 20 }}>
          <div className="row" style={{ gap: 18 }}>
            <div
              className="avatar"
              style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--grad)', fontSize: 30, fontWeight: 800 }}
            >
              {(p?.name || 'E')[0].toUpperCase()}
            </div>
            <div>
              <div className="eyebrow">
                <span className="dot" /> {L({ en: 'Level', hi: 'स्तर' })} {level} · {state.xp} XP
              </div>
              <h1 style={{ fontSize: 28, margin: '4px 0 6px' }}>{p?.name || 'Aspirant'}</h1>
              <div className="row wrap" style={{ gap: 8 }}>
                <Pill tone="brand">🎯 {target?.name || 'No target exam'}</Pill>
                <Pill tone={p?.plan === 'pro' ? 'gold' : ''}>{p?.plan === 'pro' ? '💎 Premium' : L({ en: 'Free plan', hi: 'निःशुल्क योजना' })}</Pill>
                <Pill>🔥 {state.streak.count}</Pill>
                <Pill>🪙 {state.coins}</Pill>
              </div>
            </div>
          </div>
          <div style={{ minWidth: 240, flex: '1 1 240px' }}>
            <div className="spread small" style={{ marginBottom: 6 }}>
              <span className="muted">{L({ en: 'Progress to next level', hi: 'अगले स्तर तक प्रगति' })}</span>
              <span className="bold num">{500 - (state.xp % 500)} XP</span>
            </div>
            <Bar value={levelProgress} />
            <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                ✎ {L({ en: 'Edit profile', hi: 'प्रोफ़ाइल संपादित करें' })}
              </Button>
              <Button size="sm" onClick={() => navigate('/settings')}>
                ⚙️ {L({ en: 'Settings', hi: 'सेटिंग्स' })}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid g4">
        <Card><Stat icon="📝" value={stats.attempts} label={L({ en: 'Tests taken', hi: 'टेस्ट' })} /></Card>
        <Card><Stat icon="✅" value={stats.totalCorrect} label={L({ en: 'Correct', hi: 'सही' })} /></Card>
        <Card><Stat icon="🎯" value={`${Math.round(stats.accuracy * 100)}%`} label={L({ en: 'Accuracy', hi: 'सटीकता' })} /></Card>
        <Card><Stat icon="⏱" value={`${Math.round(stats.totalTime / 3600)}h`} label={L({ en: 'Hours practised', hi: 'अभ्यास घंटे' })} /></Card>
      </div>

      <div className="grid g-main">
        <div className="stack" style={{ gap: 18 }}>
          <AccountCard />
          <Card>
            <CardHead
              title={L({ en: 'Achievements', hi: 'उपलब्धियाँ' })}
              sub={L({ en: 'Badges you have unlocked', hi: 'आपके अर्जित बैज' })}
            />
            <div className="grid g3" style={{ gap: 12 }}>
              {BADGES.map(([i, n, id]) => {
                const earned = state.achievements.includes(id)
                return (
                  <div
                    key={id}
                    className="card center"
                    style={{ padding: 18, background: earned ? 'var(--grad-soft)' : 'var(--surface-2)', borderColor: earned ? 'rgba(99,102,241,0.4)' : 'var(--line)' }}
                  >
                    <div style={{ fontSize: 28, filter: earned ? 'none' : 'grayscale(1)', opacity: earned ? 1 : 0.45 }}>{i}</div>
                    <div className="small bold" style={{ marginTop: 6 }}>{n}</div>
                    <div className="tiny muted">{earned ? L({ en: 'Unlocked', hi: 'अनलॉक' }) : L({ en: 'Locked', hi: 'लॉक' })}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'Test history', hi: 'टेस्ट इतिहास' })} />
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{L({ en: 'Test', hi: 'टेस्ट' })}</th>
                    <th>{L({ en: 'Date', hi: 'तारीख' })}</th>
                    <th>{L({ en: 'Mode', hi: 'मोड' })}</th>
                    <th>{L({ en: 'Score', hi: 'अंक' })}</th>
                    <th>{L({ en: 'Accuracy', hi: 'सटीकता' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.attempts.map((a) => (
                    <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/result/${a.id}`)}>
                      <td className="bold">{a.title}</td>
                      <td className="muted small">{shortDate(a.date)}</td>
                      <td>
                        <Pill tone={a.mode === 'mock' ? 'brand' : ''}>{a.mode === 'mock' ? L({ en: 'Mock', hi: 'मॉक' }) : L({ en: 'Practice', hi: 'प्रैक्टिस' })}</Pill>
                      </td>
                      <td className="bold num">{a.score}</td>
                      <td className="num muted small">{Math.round(a.accuracy * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card>
            <CardHead title={L({ en: 'Target exam', hi: 'लक्ष्य परीक्षा' })} />
            {target && (
              <>
                <div className="row" style={{ gap: 12 }}>
                  <div className="exam-icon" style={{ background: 'var(--grad-soft)' }}>
                    {CATEGORIES.find((c) => c.id === target.category)?.icon}
                  </div>
                  <div>
                    <div className="bold">{target.name}</div>
                    <div className="tiny muted">
                      {target.questions} Q · {target.duration} min · {target.marks} marks
                    </div>
                  </div>
                </div>
                <Button size="sm" className="block" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>
                  {L({ en: 'Change target', hi: 'लक्ष्य बदलें' })}
                </Button>
              </>
            )}
          </Card>

          <Card>
            <CardHead title={L({ en: 'Shortcut', hi: 'शॉर्टकट' })} />
            <div className="stack sm">
              {[
                ['📊', L({ en: 'Full analytics', hi: 'पूर्ण विश्लेषण' }), '/analytics'],
                ['🏆', L({ en: 'Leaderboard', hi: 'लीडरबोर्ड' }), '/leaderboard'],
                ['📰', L({ en: 'Current affairs', hi: 'समसामयिक घटनाक्रम' }), '/current-affairs'],
                ['📚', L({ en: 'Study material', hi: 'अध्ययन सामग्री' }), '/materials'],
                ['💎', L({ en: 'Upgrade plan', hi: 'प्लान अपग्रेड करें' }), '/pricing'],
              ].map(([i, l, path]) => (
                <div key={path} className="nav-item" onClick={() => navigate(path)}>
                  <span className="ico">{i}</span>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'Member since', hi: 'सदस्य बने' })} />
            <div className="kv">
              <span className="k">{L({ en: 'Joined', hi: 'शामिल' })}</span>
              <span className="bold">{p?.joinedAt ? shortDate(p.joinedAt) : '—'}</span>
            </div>
            <div className="kv">
              <span className="k">{L({ en: 'Device', hi: 'डिवाइस' })}</span>
              <span className="bold">Web · Android</span>
            </div>
            <div className="kv">
              <span className="k">{L({ en: 'Plan', hi: 'योजना' })}</span>
              <span className="bold">{p?.plan === 'pro' ? 'Premium' : 'Free'}</span>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={L({ en: 'Edit profile', hi: 'प्रोफ़ाइल संपादित करें' })}>
        <div className="field">
          <label>{L({ en: 'Your name', hi: 'आपका नाम' })}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>{L({ en: 'Target exam', hi: 'लक्ष्य परीक्षा' })}</label>
          <select className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
            {EXAMS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.subtitle}
              </option>
            ))}
          </select>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Button className="block" onClick={() => setEditing(false)}>
            {L({ en: 'Cancel', hi: 'रद्द करें' })}
          </Button>
          <Button
            variant="primary"
            className="block"
            onClick={() => {
              updateProfile({ name, examId })
              setEditing(false)
            }}
          >
            {L({ en: 'Save changes', hi: 'बदलाव सहेजें' })}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
