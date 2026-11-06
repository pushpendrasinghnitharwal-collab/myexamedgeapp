import React, { useEffect, useMemo, useState } from 'react'
import { EXAMS, examById } from '../data/exams'
import { api } from '../lib/api'
import { buildLeaderboard, rankUser, percentileOf, FRIENDS, nextLiveSlot } from '../lib/leaderboard'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, SegmentedTabs, Stat } from '../components/ui'
import { Donut } from '../components/charts'

const AVATAR_GRAD = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#22d3ee,#67e8f9)',
  'linear-gradient(135deg,#a855f7,#d946ef)',
  'linear-gradient(135deg,#ef4444,#f97316)',
  'linear-gradient(135deg,#0ea5e9,#38bdf8)',
  'linear-gradient(135deg,#14b8a6,#2dd4bf)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#eab308,#f97316)',
]

export default function Leaderboard() {
  const { state } = useStore()
  const L = useL()
  const [examId, setExamId] = useState(state.profile?.examId || 'ssc-cgl')
  const [scope, setScope] = useState('all')
  const [tab, setTab] = useState('overall')

  const board = useMemo(() => buildLeaderboard(examId), [examId])

  const me = useMemo(() => {
    const best = state.attempts.filter((a) => a.examId === examId).sort((a, b) => b.score - a.score)[0]
    if (!best) return null
    return {
      name: state.profile?.name || 'You',
      examId,
      score: best.score,
      accuracy: Math.round(best.accuracy * 100),
      time: best.timeSpent,
      streak: state.streak.count,
      tests: state.attempts.filter((a) => a.examId === examId).length,
      plan: state.profile?.plan,
      avatar: 0,
    }
  }, [state, examId])

  const { rows, userRank } = useMemo(() => rankUser(board, me), [board, me])
  const exam = examById(examId)
  const slot = nextLiveSlot()
  const pct = me ? percentileOf(me.score, board) : 0

  const top3 = rows.slice(0, 3)

  // Real users from the EXAMEDGE backend (PostgreSQL)
  const [serverBoard, setServerBoard] = useState(null)
  useEffect(() => {
    api.leaderboard(examId).then((d) => setServerBoard(d.leaderboard)).catch(() => setServerBoard([]))
  }, [examId])

  return (
    <div className="stack" style={{ gap: 18 }}>
      {serverBoard && serverBoard.length > 0 && (
        <Card style={{ padding: 16 }}>
          <CardHead
            title={L({ en: '🌐 Live server board — real accounts', hi: '🌐 लाइव server board — असली accounts' })}
            sub={L({ en: 'Synced from the EXAMEDGE PostgreSQL backend', hi: 'EXAMEDGE PostgreSQL backend से sync' })}
          />
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {serverBoard.slice(0, 5).map((u) => (
              <div key={u.id} className="row" style={{ gap: 10, justifyContent: 'space-between' }}>
                <span className="bold">#{u.rank} {u.name}</span>
                <span className="muted small">{u.attempts} tests · {u.avgAccuracy}% avg · best {u.bestScore}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'All-India Leaderboard', hi: 'ऑल-इंडिया लीडरबोर्ड' })}</div>
          <div className="page-sub">
            {L({
              en: 'Live ranks from every EXAMEDGE aspirant on your exam.',
              hi: 'आपकी परीक्षा के सभी EXAMEDGE अभ्यर्थियों के लाइव रैंक।',
            })}
          </div>
        </div>
        <SegmentedTabs
          tabs={[
            { value: 'overall', label: L({ en: 'Overall', hi: 'कुल' }) },
            { value: 'friends', label: L({ en: 'Friends', hi: 'दोस्त' }) },
            { value: 'weekly', label: L({ en: 'Weekly', hi: 'साप्ताहिक' }) },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Exam selector */}
      <div className="chip-row">
        {EXAMS.map((e) => (
          <button key={e.id} className={`chip ${examId === e.id ? 'on' : ''}`} onClick={() => setExamId(e.id)}>
            {e.name}
          </button>
        ))}
      </div>

      <div className="grid g-main">
        <div className="stack" style={{ gap: 18 }}>
          {tab === 'friends' ? (
            <Card>
              <CardHead title={L({ en: 'Friends leaderboard', hi: 'दोस्तों की लीडरबोर्ड' })} sub={L({ en: 'Compare your weekly scores', hi: 'अपने साप्ताहिक अंक की तुलना करें' })} />
              <div className="list">
                {FRIENDS.map((f, i) => (
                  <div key={f.id} className="list-row">
                    <div className="rank-badge">{i + 1}</div>
                    <div className="avatar" style={{ background: AVATAR_GRAD[f.avatar % 12], fontSize: 13 }}>
                      {f.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small bold">{f.name}</div>
                      <div className="tiny muted">🔥 {f.streak} day streak</div>
                    </div>
                    <div className="right">
                      <div className="bold num">{f.score}</div>
                      <div className="tiny muted">{f.status === 'online' ? '🟢 online' : f.status === 'away' ? '🟡 away' : '⚪ offline'}</div>
                    </div>
                  </div>
                ))}
                {me && (
                  <div className="list-row me-row" style={{ margin: '0 -12px', padding: '13px 12px' }}>
                    <div className="rank-badge">{userRank}</div>
                    <div className="avatar" style={{ background: 'var(--grad)', fontSize: 13 }}>
                      {(me.name || 'Y')[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small bold">{me.name} ({L({ en: 'you', hi: 'आप' })})</div>
                      <div className="tiny muted">🔥 {me.streak} day streak</div>
                    </div>
                    <div className="bold num">{me.score}</div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <CardHead
                title={`${exam?.name} ${L({ en: 'rankings', hi: 'रैंकिंग' })}`}
                sub={L({ en: `${rows.length.toLocaleString('en-IN')} aspirants · updates live`, hi: `${rows.length.toLocaleString('en-IN')} अभ्यर्थी · लाइव अपडेट` })}
                right={<Pill tone="brand">{scope === 'all' ? L({ en: 'All', hi: 'सभी' }) : scope === 'city' ? L({ en: 'My city', hi: 'मेरा शहर' }) : L({ en: 'My exam', hi: 'मेरी परीक्षा' })}</Pill>}
              />

              {/* podium */}
              <div className="row" style={{ gap: 12, justifyContent: 'center', alignItems: 'flex-end', marginBottom: 18 }}>
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((r, i) => {
                  const place = [2, 1, 3][i]
                  const h = place === 1 ? 92 : place === 2 ? 68 : 54
                  return (
                    <div key={r.id} className="center" style={{ flex: 1, maxWidth: 150 }}>
                      <div className="avatar" style={{ background: AVATAR_GRAD[r.avatar % 12], margin: '0 auto 7px', width: 44, height: 44 }}>
                        {r.name[0]}
                      </div>
                      <div className="small bold nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div className="tiny muted">{r.city}</div>
                      <div className="bold num" style={{ fontSize: 17, marginTop: 3 }}>{r.score}</div>
                      <div
                        style={{
                          marginTop: 8,
                          height: h,
                          borderRadius: '12px 12px 0 0',
                          background: `linear-gradient(180deg, ${place === 1 ? '#fbbf24' : place === 2 ? '#cbd5e1' : '#d97706'}, transparent)`,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 19,
                          fontWeight: 800,
                        }}
                      >
                        {place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{L({ en: 'Rank', hi: 'रैंक' })}</th>
                      <th>{L({ en: 'Aspirant', hi: 'अभ्यर्थी' })}</th>
                      <th>{L({ en: 'Score', hi: 'अंक' })}</th>
                      <th>{L({ en: 'Accuracy', hi: 'सटीकता' })}</th>
                      <th>{L({ en: 'Streak', hi: 'स्ट्रीक' })}</th>
                      <th>{L({ en: 'Tests', hi: 'टेस्ट' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 60).map((r) => (
                      <tr key={r.id} className={r.isMe ? 'me-row' : ''}>
                        <td>
                          <div className={`rank-badge ${r.rank <= 3 ? 'rank-' + r.rank : ''}`}>{r.rank}</div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 9 }}>
                            <div className="avatar" style={{ background: AVATAR_GRAD[r.avatar % 12], width: 30, height: 30, fontSize: 11, borderRadius: 9 }}>
                              {r.name[0]}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="small bold nowrap">{r.name}{r.isMe ? ' (You)' : ''}</div>
                              <div className="tiny muted">{r.city}</div>
                            </div>
                          </div>
                        </td>
                        <td className="bold num">{r.score}</td>
                        <td className="num muted small">{r.accuracy}%</td>
                        <td className="num muted small">🔥 {r.streak}</td>
                        <td className="num muted small">{r.tests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card>
            <CardHead title={L({ en: 'Your standing', hi: 'आपकी स्थिति' })} />
            {me ? (
              <>
                <div className="row" style={{ gap: 18, justifyContent: 'center' }}>
                  <Donut
                    segments={[
                      { label: 'Top', value: pct * 100, color: '#6366f1' },
                      { label: 'Rest', value: (1 - pct) * 100, color: '#1a2442' },
                    ]}
                    size={140}
                    centerLabel={`#${userRank}`}
                    centerSub={L({ en: 'all-India', hi: 'ऑल-इंडिया' })}
                  />
                  <div className="stack sm" style={{ minWidth: 130 }}>
                    <div className="kv"><span className="k">{L({ en: 'Your score', hi: 'आपका अंक' })}</span><span className="bold">{me.score}</span></div>
                    <div className="kv"><span className="k">{L({ en: 'Percentile', hi: 'प्रतिशतक' })}</span><span className="bold">Top {Math.round((1 - pct) * 100)}%</span></div>
                    <div className="kv"><span className="k">{L({ en: 'Tests taken', hi: 'दिए टेस्ट' })}</span><span className="bold">{me.tests}</span></div>
                    <div className="kv"><span className="k">{L({ en: 'Streak', hi: 'स्ट्रीक' })}</span><span className="bold">🔥 {me.streak}</span></div>
                  </div>
                </div>
                <Button variant="primary" className="block" style={{ marginTop: 14 }} onClick={() => navigate(`/exam/${examId}`)}>
                  {L({ en: 'Improve your rank', hi: 'अपनी रैंक सुधारें' })}
                </Button>
              </>
            ) : (
              <div className="empty" style={{ padding: '24px 10px' }}>
                <div className="ico">🏁</div>
                <div className="small">Take a test in {exam?.name} to appear on the board.</div>
                <Button size="sm" style={{ marginTop: 12 }} onClick={() => navigate(`/exam/${examId}`)}>
                  Start a test
                </Button>
              </div>
            )}
          </Card>

          <Card style={{ background: 'linear-gradient(160deg, rgba(244,63,94,0.15), var(--surface))', borderColor: 'rgba(244,63,94,0.28)' }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <span className="pill danger">● LIVE</span>
              <span className="tiny muted">{slot.label} IST</span>
            </div>
            <div className="card-title">{L({ en: 'Live All-India Test', hi: 'लाइव ऑल-इंडिया टेस्ट' })}</div>
            <div className="card-sub" style={{ marginBottom: 12 }}>
              {L({
                en: 'Compete live at the scheduled slot. Toppers get a Premium badge and a leaderboard spotlight.',
                hi: 'तय समय पर लाइव मुकाबला करें। टॉपरर्स को प्रीमियम बैज और लीडरबोर्ड में खास स्थान मिलता है।',
              })}
            </div>
            <div className="kv"><span className="k">{L({ en: 'Starts in', hi: 'शुरू होने में' })}</span><span className="bold">{Math.floor(slot.startsIn / 3600000)}h {Math.floor((slot.startsIn % 3600000) / 60000)}m</span></div>
            <div className="kv"><span className="k">{L({ en: 'Registered', hi: 'पंजीकृत' })}</span><span className="bold">12,438</span></div>
            <Button variant="primary" className="block" style={{ marginTop: 12 }} onClick={() => navigate(`/exam/${examId}`)}>
              {L({ en: 'Register now', hi: 'अभी पंजीकरण करें' })}
            </Button>
          </Card>

          <Card>
            <CardHead title={L({ en: 'Weekly champions', hi: 'साप्ताहिक चैंपियन' })} />
            <div className="list">
              {board.slice(0, 5).map((r) => (
                <div key={r.id} className="list-row">
                  <div className="rank-badge">{r.rank}</div>
                  <div className="avatar" style={{ background: AVATAR_GRAD[r.avatar % 12], width: 32, height: 32, fontSize: 12, borderRadius: 9 }}>
                    {r.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small bold nowrap">{r.name}</div>
                    <div className="tiny muted">{r.city}</div>
                  </div>
                  <div className="bold num small">{r.score}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
