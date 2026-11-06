import React, { useMemo } from 'react'
import { useStore, useAttemptStats } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { CATEGORIES, EXAMS, examById } from '../data/exams'
import { TEST_CATALOGUE } from '../lib/tests'
import { caForDate, CA_ITEMS } from '../data/currentAffairs'
import { Button, Card, CardHead, Pill, Bar, Stat, Sparkline } from '../components/ui'
import { Ring, Heatmap } from '../components/charts'
import { nextLiveSlot } from '../lib/leaderboard'
import { shortDate } from '../lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return { en: 'Good morning', hi: 'सुप्रभात' }
  if (h < 17) return { en: 'Good afternoon', hi: 'नमस्कार' }
  return { en: 'Good evening', hi: 'शुभ संध्या' }
}

export default function Home() {
  const { state } = useStore()
  const L = useL()
  const stats = useAttemptStats()
  const target = state.profile ? examById(state.profile.examId) : null
  const todayCA = caForDate()
  const slot = nextLiveSlot()

  const todaysTests = useMemo(() => {
    const list = []
    EXAMS.forEach((e) => {
      const drill = (TEST_CATALOGUE[e.id] || []).find((t) => t.type === 'drill')
      if (drill) list.push({ exam: e, test: drill })
    })
    return list
  }, [])

  const weakTopics = stats.weak.slice(0, 3)
  const recommended = useMemo(() => {
    const out = []
    const ids = weakTopics.map((w) => w.id)
    EXAMS.forEach((e) => {
      ;(TEST_CATALOGUE[e.id] || []).forEach((t) => {
        if (t.type === 'topic' && ids.includes(t.topic)) out.push({ exam: e, test: t })
      })
    })
    if (!out.length) {
      const e = target || EXAMS[0]
      const t = (TEST_CATALOGUE[e.id] || []).find((x) => x.type === 'full')
      if (t) out.push({ exam: e, test: t })
    }
    return out.slice(0, 3)
  }, [weakTopics, target])

  const activity = useMemo(() => {
    const days = new Array(105).fill(0)
    state.attempts.forEach((a) => {
      const idx = Math.floor((Date.now() - a.date) / 86400000)
      if (idx >= 0 && idx < 105) days[104 - idx] += a.totalQuestions || 0
    })
    return days
  }, [state.attempts])

  const scoreTrend = useMemo(
    () => [...state.attempts].reverse().map((a) => Math.round((a.score / Math.max(1, a.maxScore)) * 100)),
    [state.attempts]
  )

  const dailyDone = state.attempts.filter((a) => new Date(a.date).toDateString() === new Date().toDateString())
  const dailyQuestions = dailyDone.reduce((s, a) => s + (a.totalQuestions || 0), 0)
  const goalPct = Math.min(1, dailyQuestions / state.dailyGoal)

  const tasks = [
    { id: 'ca', label: { en: 'Read today’s Current Affairs capsule', hi: 'आज का करेंट अफेयर्स कैप्सूल पढ़ें' }, done: !!dailyDone.length || false, link: '/current-affairs', xp: 10 },
    { id: 'drill', label: { en: 'Complete a 10-question daily drill', hi: '10 प्रश्नों का डेली ड्रिल पूरा करें' }, done: dailyQuestions >= 10, link: '/exams', xp: 20 },
    { id: 'weak', label: { en: 'Revise your weakest topic', hi: 'अपना सबसे कमज़ोर टॉपिक दोहराएँ' }, done: dailyQuestions >= state.dailyGoal, link: '/analytics', xp: 30 },
  ]

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 18 }}>
          <div style={{ minWidth: 260, flex: '1 1 380px' }}>
            <div className="eyebrow">
              <span className="dot" />
              {target ? `${target.name} · ${target.tier}` : L({ en: 'Welcome to EXAMEDGE', hi: 'EXAMEDGE में आपका स्वागत है' })}
            </div>
            <h1>
              {L(greeting())}, {state.profile?.name?.split(' ')[0] || 'Aspirant'} 👋
            </h1>
            <p>
              {L({
                en: 'You are in the top 18% of all EXAMEDGE aspirants for your exam. Two focused sessions today will push you past 92%.',
                hi: 'आप अपनी परीक्षा के सभी EXAMEDGE अभ्यर्थियों में शीर्ष 18% में हैं। आज दो केंद्रित सत्र आपको 92% से आगे ले जाएँगे।',
              })}
            </p>
            <div className="row wrap" style={{ gap: 10 }}>
              <Button variant="primary" size="lg" onClick={() => navigate('/exams')}>
                🚀 {L({ en: 'Start a test', hi: 'टेस्ट शुरू करें' })}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate('/analytics')}>
                📊 {L({ en: 'My analytics', hi: 'मेरे आँकड़े' })}
              </Button>
            </div>
          </div>

          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <Ring value={goalPct * 100} size={142} stroke={13} label={`${dailyQuestions}/${state.dailyGoal}`} sub={L({ en: 'daily goal', hi: 'दैनिक लक्ष्य' })} />
            <div className="stack sm">
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 22 }}>🔥</span>
                <div>
                  <div className="bold" style={{ fontSize: 17 }}>{state.streak.count} {L({ en: 'day streak', hi: 'दिन की स्ट्रीक' })}</div>
                  <div className="tiny muted">{L({ en: 'Personal best: 12 days', hi: 'निजी सर्वश्रेष्ठ: 12 दिन' })}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 22 }}>⚡</span>
                <div>
                  <div className="bold" style={{ fontSize: 17 }}>{state.xp} XP</div>
                  <div className="tiny muted">{L({ en: `Level ${Math.floor(state.xp / 500) + 1} aspirant`, hi: `स्तर ${Math.floor(state.xp / 500) + 1}` })}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="grid g4">
        <Card>
          <Stat icon="📝" value={stats.attempts} label={L({ en: 'Tests attempted', hi: 'दिए गए टेस्ट' })} />
        </Card>
        <Card>
          <Stat icon="🎯" value={`${Math.round(stats.accuracy * 100)}%`} label={L({ en: 'Overall accuracy', hi: 'कुल सटीकता' })} />
        </Card>
        <Card>
          <Stat icon="⏱" value={`${Math.round(stats.totalTime / 60)}m`} label={L({ en: 'Time practised', hi: 'अभ्यास का समय' })} />
        </Card>
        <Card>
          <Stat icon="🏅" value={stats.best ? `${stats.best.score}/${stats.best.maxScore}` : '—'} label={L({ en: 'Best score', hi: 'सर्वश्रेष्ठ अंक' })} />
        </Card>
      </div>

      <div className="grid g-main">
        <div className="stack" style={{ gap: 18 }}>
          {/* Today's plan */}
          <Card>
            <CardHead
              icon="🎯"
              title={L({ en: 'Today’s plan', hi: 'आज का प्लान' })}
              sub={L({ en: 'Complete these to keep your streak alive', hi: 'स्ट्रीक जारी रखने के लिए ये पूरे करें' })}
              right={<Pill tone="brand">{dailyQuestions}/{state.dailyGoal} {L({ en: 'Q', hi: 'प्रश्न' })}</Pill>}
            />
            <div className="stack sm">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="list-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(t.link)}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      background: t.done ? 'var(--success)' : 'var(--surface-3)',
                      color: t.done ? '#04231a' : 'var(--muted)',
                      fontSize: 13,
                      fontWeight: 800,
                      flex: '0 0 auto',
                    }}
                  >
                    {t.done ? '✓' : '○'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small bold" style={{ opacity: t.done ? 0.6 : 1 }}>
                      {L(t.label)}
                    </div>
                  </div>
                  <Pill tone="gold">+{t.xp} XP</Pill>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Bar value={goalPct} />
            </div>
          </Card>

          {/* Recommended */}
          <Card>
            <CardHead
              icon="🧠"
              title={L({ en: 'Recommended for you', hi: 'आपके लिए सुझाए गए' })}
              sub={L({ en: 'Built from your weakest topics and recent mistakes', hi: 'आपके सबसे कमज़ोर टॉपिक और हाल की गलतियों से तैयार' })}
              right={<Button size="sm" variant="ghost" onClick={() => navigate('/exams')}>{L({ en: 'See all', hi: 'सभी देखें' })} →</Button>}
            />
            <div className="stack sm">
              {recommended.map(({ exam, test }) => (
                <div
                  key={test.id}
                  className="list-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/test/${exam.id}/${test.id}`)}
                >
                  <div className="exam-icon" style={{ fontSize: 18 }}>📝</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small bold">{L({ en: test.title, hi: test.title })}</div>
                    <div className="tiny muted">
                      {test.questions} {L({ en: 'Q', hi: 'प्रश्न' })} · {test.duration} min · {L({ en: 'Avg score', hi: 'औसत अंक' })} {test.avg}
                    </div>
                  </div>
                  <Pill tone={test.premium ? 'gold' : 'success'}>{test.premium ? '💎 PRO' : 'FREE'}</Pill>
                </div>
              ))}
            </div>
          </Card>

          {/* Categories */}
          <Card>
            <CardHead
              title={L({ en: 'Explore exam categories', hi: 'परीक्षा श्रेणियाँ देखें' })}
              sub={L({ en: '8 categories · 19 exams · updated for 2026 patterns', hi: '8 श्रेणियाँ · 19 परीक्षाएँ · 2026 पैटर्न के अनुसार' })}
            />
            <div className="grid g3" style={{ gap: 12 }}>
              {CATEGORIES.map((c) => {
                const count = EXAMS.filter((e) => e.category === c.id).length
                return (
                  <div
                    key={c.id}
                    className="card exam-card"
                    style={{ padding: 15, cursor: 'pointer' }}
                    onClick={() => navigate('/exams?c=' + c.id)}
                  >
                    <div className="row" style={{ gap: 11 }}>
                      <div className="exam-icon" style={{ background: `${c.color}22`, borderColor: `${c.color}55`, fontSize: 19 }}>
                        {c.icon}
                      </div>
                      <div>
                        <div className="bold small">{L({ en: c.name, hi: c.hi })}</div>
                        <div className="tiny muted">{count} {L({ en: 'exams', hi: 'परीक्षाएँ' })}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── Sidebar column ── */}
        <div className="stack" style={{ gap: 18 }}>
          {/* Live test */}
          <Card style={{ background: 'linear-gradient(160deg, rgba(244,63,94,0.16), var(--surface))', borderColor: 'rgba(244,63,94,0.3)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <span className="pill danger"><span className="dot" style={{ width: 6, height: 6, borderRadius: 99, background: 'currentColor' }} /> LIVE</span>
              <span className="tiny muted">{slot.label} IST</span>
            </div>
            <div className="card-title">{L({ en: 'All-India Live Mock', hi: 'ऑल-इंडिया लाइव मॉक' })}</div>
            <div className="card-sub" style={{ marginBottom: 12 }}>
              {L({
                en: '25 questions · 60 minutes · compete with 12,400 aspirants',
                hi: '25 प्रश्न · 60 मिनट · 12,400 अभ्यर्थियों से मुकाबला',
              })}
            </div>
            <div className="row" style={{ gap: 12, marginBottom: 12 }}>
              <div>
                <div className="tiny muted">{L({ en: 'Starts in', hi: 'शुरू होने में' })}</div>
                <div className="bold num" style={{ fontSize: 20 }}>
                  {String(Math.floor(slot.startsIn / 3600000)).padStart(2, '0')}h{' '}
                  {String(Math.floor((slot.startsIn % 3600000) / 60000)).padStart(2, '0')}m
                </div>
              </div>
              <div className="spacer" />
              <Button variant="primary" size="sm" onClick={() => navigate('/leaderboard')}>
                {L({ en: 'Notify me', hi: 'सूचना दें' })}
              </Button>
            </div>
          </Card>

          {/* Current affairs */}
          <Card>
            <CardHead
              icon="📰"
              title={L({ en: 'Current Affairs', hi: 'समसामयिक घटनाक्रम' })}
              right={<Pill tone="brand">{L({ en: 'Today', hi: 'आज' })}</Pill>}
            />
            <div className="small bold" style={{ marginBottom: 6 }}>{L(todayCA.title)}</div>
            <div className="tiny muted" style={{ lineHeight: 1.6 }}>{L(todayCA.body).slice(0, 150)}…</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {CA_ITEMS.slice(0, 3).map((c) => (
                <span key={c.id} className="pill">{L(c.tag)}</span>
              ))}
            </div>
            <Button variant="primary" size="sm" className="block" style={{ marginTop: 14 }} onClick={() => navigate('/current-affairs')}>
              {L({ en: 'Read full capsule', hi: 'पूरा कैप्सूल पढ़ें' })}
            </Button>
          </Card>

          {/* Score trend */}
          <Card>
            <CardHead title={L({ en: 'Score trend', hi: 'अंक का रुझान' })} sub={L({ en: 'Last 5 attempts', hi: 'पिछले 5 प्रयास' })} />
            {scoreTrend.length > 1 ? (
              <>
                <Sparkline points={scoreTrend} height={70} />
                <div className="spread tiny muted" style={{ marginTop: 6 }}>
                  <span>{scoreTrend[0]}%</span>
                  <span className="bold" style={{ color: 'var(--success)' }}>
                    +{scoreTrend[scoreTrend.length - 1] - scoreTrend[0]}% overall
                  </span>
                </div>
              </>
            ) : (
              <div className="tiny muted">Take more tests to unlock your trend.</div>
            )}
          </Card>

          {/* Activity */}
          <Card>
            <CardHead title={L({ en: 'Activity', hi: 'गतिविधि' })} sub={L({ en: 'Last 15 weeks', hi: 'पिछले 15 सप्ताह' })} />
            <Heatmap values={activity} />
            <div className="row tiny muted" style={{ marginTop: 10, gap: 6 }}>
              <span>{L({ en: 'Less', hi: 'कम' })}</span>
              {[0, 1, 2, 3, 4].map((l) => (
                <i key={l} data-l={l} style={{ width: 11, height: 11, borderRadius: 3, background: l === 0 ? 'var(--surface-3)' : undefined }} className={`h${l}`} />
              ))}
              <span>{L({ en: 'More', hi: 'अधिक' })}</span>
            </div>
          </Card>

          {/* Recent */}
          <Card>
            <CardHead
              title={L({ en: 'Recent attempts', hi: 'हाल के प्रयास' })}
              right={<Button size="sm" variant="ghost" onClick={() => navigate('/analytics')}>→</Button>}
            />
            {state.attempts.slice(0, 5).map((a) => {
              const e = examById(a.examId)
              return (
                <div key={a.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/result/${a.id}`)}>
                  <div className="avatar" style={{ background: 'var(--grad)', fontSize: 12 }}>
                    {e?.name.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small bold">{e?.name} · {a.mode === 'mock' ? 'Mock' : 'Practice'}</div>
                    <div className="tiny muted">{shortDate(a.date)} · {a.correct}/{a.totalQuestions} correct</div>
                  </div>
                  <div className="bold num small">{a.score}</div>
                </div>
              )
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}
