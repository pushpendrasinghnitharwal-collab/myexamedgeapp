import React, { useState } from 'react'
import { BarChart3, BookOpen, Calculator, CheckCircle2, Clock3, ClipboardList, Coins, Diamond, FileClock, Flame, GraduationCap, Newspaper, Pencil, Settings2, Target, Trophy } from 'lucide-react'
import { useStore, useAttemptStats, useCurrentStreak } from '../lib/store'
import { api, isLoggedIn } from '../lib/api'
import { EXAMS, examById, CATEGORIES } from '../data/exams'
import { practiceSetCount } from '../lib/examCatalog'
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
      setMsg({ ok: true, text: `Signed in as ${u.name} — future attempts are sent when the backend is available` })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally { setBusy(false) }
  }

  return (
    <Card style={{ padding: 18 }}>
      <CardHead title={L({ en: 'Account', hi: 'खाता' })} sub={L({ en: 'Sign in to send future attempts to an available backend', hi: 'नए प्रयास उपलब्ध बैकएंड पर भेजने के लिए साइन इन करें' })} />
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
            {L({ en: 'Your progress is saved on this device. Sign in with an existing account to use the connected backend.', hi: 'आपकी प्रगति इस डिवाइस पर सहेजी जाती है। मौजूदा खाते से साइन इन कर सकते हैं।' })}
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
  const streak = useCurrentStreak()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.profile?.name || '')
  const [examId, setExamId] = useState(state.profile?.examId || 'ssc-cgl')

  const p = state.profile
  const level = Math.floor(state.xp / 500) + 1
  const levelProgress = (state.xp % 500) / 500
  const target = examById(p?.examId)

  const BADGES = [
    [Target, { en: 'First Steps', hi: 'पहला कदम' }, 'first-test'],
    [Flame, { en: '7-Day Streak', hi: '7-दिन स्ट्रीक' }, 'streak-7'],
    [Trophy, { en: 'Test Warrior', hi: 'टेस्ट योद्धा' }, 'tests-10'],
    [Diamond, { en: 'Sharpshooter', hi: 'निशानेबाज' }, 'accuracy-80'],
    [Calculator, { en: 'Quant Ace', hi: 'क्वांट एस' }, 'quant-90'],
  ]

  return (
    <div className="profile-page page-shell stack" style={{ gap: 18 }}>
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
                <Pill tone="brand"><Target size={13} aria-hidden="true" /> {target?.name || L({ en: 'No target exam', hi: 'कोई लक्ष्य परीक्षा नहीं' })}</Pill>
                <Pill tone={p?.plan === 'pro' ? 'gold' : ''}>{p?.plan === 'pro' ? <><Diamond size={13} aria-hidden="true" /> Premium</> : L({ en: 'Free plan', hi: 'निःशुल्क योजना' })}</Pill>
                <Pill><Flame size={13} aria-hidden="true" /> {L({ en: `${streak} ${streak === 1 ? 'day' : 'days'} streak`, hi: `${streak} दिन स्ट्रीक` })}</Pill>
                <Pill><Coins size={13} aria-hidden="true" /> {state.coins} {L({ en: 'coins', hi: 'कॉइन' })}</Pill>
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
                <Pencil size={14} aria-hidden="true" /> {L({ en: 'Edit profile', hi: 'प्रोफ़ाइल संपादित करें' })}
              </Button>
              <Button size="sm" onClick={() => navigate('/settings')}>
                <Settings2 size={14} aria-hidden="true" /> {L({ en: 'Settings', hi: 'सेटिंग्स' })}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid g4">
        <Card><Stat icon={<ClipboardList size={20} aria-hidden="true" />} value={stats.attempts} label={L({ en: 'Tests taken', hi: 'टेस्ट' })} /></Card>
        <Card><Stat icon={<CheckCircle2 size={20} aria-hidden="true" />} value={stats.totalCorrect} label={L({ en: 'Correct', hi: 'सही' })} /></Card>
        <Card><Stat icon={<Target size={20} aria-hidden="true" />} value={`${Math.round(stats.accuracy * 100)}%`} label={L({ en: 'Accuracy', hi: 'सटीकता' })} /></Card>
        <Card><Stat icon={<Clock3 size={20} aria-hidden="true" />} value={`${Math.round(stats.totalTime / 3600)}h`} label={L({ en: 'Hours practised', hi: 'अभ्यास घंटे' })} /></Card>
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
              {BADGES.map(([Icon, name, id]) => {
                const earned = state.achievements.includes(id)
                return (
                  <div
                    key={id}
                    className="card center"
                    style={{ padding: 18, background: earned ? 'var(--grad-soft)' : 'var(--surface-2)', borderColor: earned ? 'rgba(99,102,241,0.4)' : 'var(--line)' }}
                  >
                    <div className={`profile-badge-icon ${earned ? 'earned' : ''}`} aria-hidden="true"><Icon size={24} /></div>
                    <div className="small bold" style={{ marginTop: 6 }}>{L(name)}</div>
                    <div className="tiny muted">{earned ? L({ en: 'Unlocked', hi: 'अनलॉक' }) : L({ en: 'Locked', hi: 'लॉक' })}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'Test history', hi: 'टेस्ट इतिहास' })} />
            <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={L({ en: 'Test history', hi: 'टेस्ट इतिहास' })}>
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
                    <GraduationCap size={21} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="bold">{target.name}</div>
                    <div className="tiny muted">
                      {practiceSetCount(target.id) ? `${practiceSetCount(target.id)} ${L({ en: 'practice sets available', hi: 'अभ्यास सेट उपलब्ध' })}` : L({ en: 'Practice not added yet', hi: 'अभ्यास अभी नहीं जोड़ा गया' })}
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
                [BarChart3, L({ en: 'Full analytics', hi: 'पूर्ण विश्लेषण' }), '/analytics'],
                [FileClock, L({ en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर' }), '/pyq'],
                [Newspaper, L({ en: 'Current affairs', hi: 'समसामयिक घटनाक्रम' }), '/current-affairs'],
                [BookOpen, L({ en: 'Study material', hi: 'अध्ययन सामग्री' }), '/materials'],
              ].map(([Icon, label, path]) => (
                <button key={path} className="nav-item profile-shortcut" onClick={() => navigate(path)}>
                  <span className="ico"><Icon size={17} aria-hidden="true" /></span>
                  <span>{label}</span>
                </button>
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
              <span className="k">{L({ en: 'Platform', hi: 'प्लेटफ़ॉर्म' })}</span>
              <span className="bold">{L({ en: 'Web app', hi: 'वेब ऐप' })}</span>
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
          <label htmlFor="profile-name">{L({ en: 'Your name', hi: 'आपका नाम' })}</label>
          <input id="profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="profile-target">{L({ en: 'Target exam', hi: 'लक्ष्य परीक्षा' })}</label>
          <select id="profile-target" className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
            {CATEGORIES.map((category) => <optgroup key={category.id} label={L({ en: category.name, hi: category.hi })}>
              {EXAMS.filter((exam) => exam.category === category.id).map((exam) => <option key={exam.id} value={exam.id}>{exam.name}{!practiceSetCount(exam.id) ? ` — ${L({ en: 'info only', hi: 'केवल जानकारी' })}` : ''}</option>)}
            </optgroup>)}
          </select>
          <div className="tiny muted" style={{ marginTop: 6 }}>{practiceSetCount(examId) ? L({ en: 'Practice is available for this goal.', hi: 'इस लक्ष्य के लिए अभ्यास उपलब्ध है।' }) : L({ en: 'Practice for this exam has not been added yet.', hi: 'इस परीक्षा के लिए अभ्यास अभी नहीं जोड़ा गया है।' })}</div>
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
