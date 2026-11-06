import React, { useMemo } from 'react'
import { useStore, useAttemptStats } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { examById, SUBJECTS, TOPICS } from '../data/exams'
import { Card, CardHead, Pill, Button, Stat, Metric, Bar, EmptyState } from '../components/ui'
import { LineChart, Radar, BarList, Heatmap, Donut } from '../components/charts'
import { shortDate, formatTime } from '../lib/utils'

const BADGES = [
  { id: 'first-test', icon: '🎯', name: { en: 'First Steps', hi: 'पहला कदम' }, desc: { en: 'Complete your first test', hi: 'पहला टेस्ट पूरा करें' }, need: (s) => s.attempts >= 1 },
  { id: 'streak-7', icon: '🔥', name: { en: '7-Day Streak', hi: '7-दिन स्ट्रीक' }, desc: { en: 'Practise 7 days in a row', hi: 'लगातार 7 दिन अभ्यास' }, need: (s, st) => st.streak.count >= 7 },
  { id: 'tests-10', icon: '🏆', name: { en: 'Test Warrior', hi: 'टेस्ट योद्धा' }, desc: { en: 'Attempt 10 tests', hi: '10 टेस्ट दें' }, need: (s) => s.attempts >= 10 },
  { id: 'accuracy-80', icon: '🎯', name: { en: 'Sharpshooter', hi: 'निशानेबाज' }, desc: { en: 'Cross 80% overall accuracy', hi: '80% सटीकता पार करें' }, need: (s) => s.accuracy >= 0.8 },
  { id: 'quant-90', icon: '🧮', name: { en: 'Quant Ace', hi: 'क्वांट एस' }, desc: { en: '90%+ in any subject', hi: 'किसी भी विषय में 90%+' }, need: (s) => s.topics.some((t) => t.accuracy >= 0.9 && t.attempted >= 4) },
  { id: 'night-owl', icon: '🦉', name: { en: 'Night Owl', hi: 'रात का जागरूक' }, desc: { en: 'Study after 11 PM', hi: 'रात 11 बजे के बाद पढ़ाई' }, need: () => true },
]

export default function Analytics() {
  const { state } = useStore()
  const L = useL()
  const stats = useAttemptStats()

  const series = useMemo(() => {
    const sorted = [...state.attempts].sort((a, b) => a.date - b.date)
    return {
      labels: sorted.map((a) => shortDate(a.date).split(' ')[0]),
      score: sorted.map((a) => Math.round((a.score / Math.max(1, a.maxScore)) * 100)),
      accuracy: sorted.map((a) => Math.round(a.accuracy * 100)),
      time: sorted.map((a) => Math.round(a.timeSpent / 60)),
    }
  }, [state.attempts])

  const subjectRadar = useMemo(() => {
    const bySub = {}
    stats.topics.forEach((t) => {
      const s = t.subject
      if (!s) return
      bySub[s] = bySub[s] || { sum: 0, n: 0, correct: 0 }
      bySub[s].sum += t.accuracy
      bySub[s].n++
      bySub[s].correct += t.correct
    })
    return Object.entries(bySub)
      .map(([id, v]) => ({
        label: SUBJECTS[id]?.short || id,
        value: Math.max(0.05, Math.min(1, v.correct / Math.max(1, v.sum * v.n))),
        raw: v.correct / Math.max(1, v.n),
      }))
      .slice(0, 7)
  }, [stats.topics])

  const activity = useMemo(() => {
    const days = new Array(105).fill(0)
    state.attempts.forEach((a) => {
      const idx = Math.floor((Date.now() - a.date) / 86400000)
      if (idx >= 0 && idx < 105) days[104 - idx] += a.totalQuestions || 0
    })
    return days
  }, [state.attempts])

  const perExam = stats.byExam
  const best = stats.best

  if (!state.attempts.length) {
    return (
      <Card>
        <EmptyState
          icon="📊"
          title="No analytics yet"
          sub="Take your first test and EXAMEDGE will build your performance graph."
          action={<Button variant="primary" onClick={() => navigate('/exams')}>Browse tests</Button>}
        />
      </Card>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Your performance', hi: 'आपका प्रदर्शन' })}</div>
          <div className="page-sub">
            {L({
              en: 'Every question you solve makes this page sharper. Here is your complete prep intelligence.',
              hi: 'आपके द्वारा हल किया गया हर प्रश्न इस पेज को बेहतर बनाता है। यह आपकी पूरी प्रीपरेशन इंटेलिजेंस है।',
            })}
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate('/exams')}>
          {L({ en: 'Take a test', hi: 'टेस्ट दें' })}
        </Button>
      </div>

      <div className="grid g4">
        <Card><Stat icon="📝" value={stats.attempts} label={L({ en: 'Tests taken', hi: 'कुल टेस्ट' })} /></Card>
        <Card><Stat icon="✅" value={stats.totalCorrect} label={L({ en: 'Correct answers', hi: 'सही उत्तर' })} /></Card>
        <Card><Stat icon="🎯" value={`${Math.round(stats.accuracy * 100)}%`} label={L({ en: 'Accuracy', hi: 'सटीकता' })} /></Card>
        <Card><Stat icon="⏱" value={`${Math.round(stats.totalTime / 3600)}h ${Math.round((stats.totalTime % 3600) / 60)}m`} label={L({ en: 'Time invested', hi: 'कुल समय' })} /></Card>
      </div>

      <div className="grid g-main">
        <div className="stack" style={{ gap: 18 }}>
          <Card>
            <CardHead
              title={L({ en: 'Progress over time', hi: 'समय के साथ प्रगति' })}
              sub={L({ en: 'Score %, accuracy % and minutes studied per test', hi: 'प्रत्येक टेस्ट में स्कोर %, सटीकता % और मिनट' })}
            />
            {series.labels.length > 1 ? (
              <LineChart
                labels={series.labels}
                series={[
                  { name: 'Score %', values: series.score },
                  { name: 'Accuracy %', values: series.accuracy },
                ]}
              />
            ) : (
              <div className="tiny muted">Take at least two tests to see the trend.</div>
            )}
          </Card>

          <Card>
            <CardHead
              title={L({ en: 'Subject strength map', hi: 'विषय शक्ति मानचित्र' })}
              sub={L({ en: 'Your accuracy in every subject attempted', hi: 'हर विषय में आपकी सटीकता' })}
            />
            <div style={{ display: 'grid', placeItems: 'center' }}>
              {subjectRadar.length >= 3 ? (
                <Radar data={subjectRadar} />
              ) : (
                <div className="tiny muted">Attempt more subjects to unlock the radar map.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead
              title={L({ en: 'Topic mastery', hi: 'टॉपिक मास्टरी' })}
              sub={L({ en: 'Weakest first — your revision queue', hi: 'सबसे कमज़ोर पहले — आपकी दोहराव सूची' })}
              right={<Pill tone="brand">{stats.topics.length} {L({ en: 'topics', hi: 'टॉपिक' })}</Pill>}
            />
            <BarList
              items={stats.topics.slice(0, 10).map((t) => ({
                label: TOPICS[t.id]?.name || t.id,
                value: t.accuracy,
                display: `${Math.round(t.accuracy * 100)}% · ${t.correct}/${t.attempted}`,
                color:
                  t.accuracy >= 0.75
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : t.accuracy >= 0.5
                    ? 'linear-gradient(90deg,#6366f1,#22d3ee)'
                    : 'linear-gradient(90deg,#f43f5e,#fb7185)',
              }))}
            />
          </Card>

          <Card>
            <CardHead title={L({ en: 'Per-exam breakdown', hi: 'परीक्षा-वार विश्लेषण' })} />
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{L({ en: 'Exam', hi: 'परीक्षा' })}</th>
                    <th>{L({ en: 'Tests', hi: 'टेस्ट' })}</th>
                    <th>{L({ en: 'Avg score', hi: 'औसत अंक' })}</th>
                    <th>{L({ en: 'Accuracy', hi: 'सटीकता' })}</th>
                    <th>{L({ en: 'Time', hi: 'समय' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {perExam.map((e) => {
                    const exam = examById(e.examId)
                    return (
                      <tr key={e.examId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/exam/${e.examId}`)}>
                        <td className="bold">{exam?.name || e.examId}</td>
                        <td className="num">{e.count}</td>
                        <td className="num">{Math.round((e.score / Math.max(1, e.count)) * 10) / 10}</td>
                        <td style={{ minWidth: 130 }}>
                          <div className="row" style={{ gap: 8 }}>
                            <div style={{ width: 70 }}>
                              <Bar value={e.correct / Math.max(1, e.total)} thin />
                            </div>
                            <span className="tiny num">{Math.round((e.correct / Math.max(1, e.total)) * 100)}%</span>
                          </div>
                        </td>
                        <td className="num muted small">{formatTime(e.time)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card>
            <CardHead title={L({ en: 'Personal best', hi: 'निजी सर्वश्रेष्ठ' })} />
            {best && (
              <>
                <Donut
                  segments={[
                    { label: 'Correct', value: best.correct, color: '#10b981' },
                    { label: 'Wrong', value: best.wrong, color: '#f43f5e' },
                    { label: 'Skipped', value: best.unattempted, color: '#64748b' },
                  ]}
                  size={140}
                  centerLabel={`${best.score}`}
                  centerSub={L({ en: 'best score', hi: 'सर्वश्रेष्ठ अंक' })}
                />
                <div className="sep" />
                <div className="kv"><span className="k">{L({ en: 'Exam', hi: 'परीक्षा' })}</span><span className="bold">{examById(best.examId)?.name}</span></div>
                <div className="kv"><span className="k">{L({ en: 'Date', hi: 'तारीख' })}</span><span className="bold">{shortDate(best.date)}</span></div>
                <div className="kv"><span className="k">{L({ en: 'Accuracy', hi: 'सटीकता' })}</span><span className="bold">{Math.round(best.accuracy * 100)}%</span></div>
                <Button size="sm" className="block" style={{ marginTop: 12 }} onClick={() => navigate(`/result/${best.id}`)}>
                  {L({ en: 'View full result', hi: 'पूरा परिणाम देखें' })}
                </Button>
              </>
            )}
          </Card>

          <Card>
            <CardHead title={L({ en: 'Activity — 15 weeks', hi: 'गतिविधि — 15 सप्ताह' })} />
            <Heatmap values={activity} />
            <div className="row tiny muted" style={{ marginTop: 10, gap: 6 }}>
              <span>{L({ en: 'Less', hi: 'कम' })}</span>
              {[1, 2, 3, 4].map((l) => (
                <i key={l} data-l={l} style={{ width: 11, height: 11, borderRadius: 3 }} />
              ))}
              <span>{L({ en: 'More', hi: 'अधिक' })}</span>
            </div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'Achievements', hi: 'उपलब्धियाँ' })} sub={L({ en: 'Tap to claim your reward', hi: 'पुरस्कार लेने के लिए टैप करें' })} />
            <div className="stack sm">
              {BADGES.map((b) => {
                const earned = b.need(stats, state)
                const claimed = state.achievements.includes(b.id)
                return (
                  <div key={b.id} className="row" style={{ gap: 11, opacity: earned ? 1 : 0.55 }}>
                    <div
                      className="stat-ico"
                      style={{ width: 36, height: 36, fontSize: 16, background: earned ? 'var(--grad)' : 'var(--surface-3)' }}
                    >
                      {b.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small bold">{L(b.name)}</div>
                      <div className="tiny muted">{L(b.desc)}</div>
                    </div>
                    {earned ? (
                      claimed ? (
                        <Pill tone="success">✓</Pill>
                      ) : (
                        <Pill tone="gold">+25 🪙</Pill>
                      )
                    ) : (
                      <Pill>🔒</Pill>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
