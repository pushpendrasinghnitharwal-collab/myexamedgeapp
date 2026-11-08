import React, { useMemo } from 'react'
import { ArrowRight, BarChart3, Calculator, CheckCircle2, ClipboardList, Clock3, Coins, Flame, Lock, Moon, Sparkles, Target, Trophy } from 'lucide-react'
import { useStore, useAttemptStats, currentStreak } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { examById, SUBJECTS, TOPICS } from '../data/exams'
import { Card, CardHead, Pill, Button, Stat, Bar } from '../components/ui'
import { LineChart, Radar, BarList, Heatmap, Donut } from '../components/charts'
import { shortDate, formatTime } from '../lib/utils'

const BADGES = [
  { id: 'first-test', icon: Target, name: { en: 'First Steps', hi: 'पहला कदम' }, desc: { en: 'Complete your first test', hi: 'पहला टेस्ट पूरा करें' }, need: (s) => s.attempts >= 1 },
  { id: 'streak-7', icon: Flame, name: { en: '7-Day Streak', hi: '7-दिन स्ट्रीक' }, desc: { en: 'Practise 7 days in a row', hi: 'लगातार 7 दिन अभ्यास' }, need: (s, st) => currentStreak(st.streak) >= 7 },
  { id: 'tests-10', icon: Trophy, name: { en: 'Test Warrior', hi: 'टेस्ट योद्धा' }, desc: { en: 'Attempt 10 tests', hi: '10 टेस्ट दें' }, need: (s) => s.attempts >= 10 },
  { id: 'accuracy-80', icon: Target, name: { en: 'Sharpshooter', hi: 'निशानेबाज' }, desc: { en: 'Cross 80% overall accuracy', hi: '80% सटीकता पार करें' }, need: (s) => s.accuracy >= 0.8 },
  { id: 'quant-90', icon: Calculator, name: { en: 'Quant Ace', hi: 'क्वांट एस' }, desc: { en: '90%+ in any subject', hi: 'किसी भी विषय में 90%+' }, need: (s) => s.topics.some((t) => t.accuracy >= 0.9 && t.attempted >= 4) },
  { id: 'night-owl', icon: Moon, name: { en: 'Night Owl', hi: 'रात का जागरूक' }, desc: { en: 'Study after 11 PM', hi: 'रात 11 बजे के बाद पढ़ाई' }, need: (s, st) => st.attempts.some((attempt) => new Date(attempt.date).getHours() >= 23) },
]

export default function Analytics() {
  const { state, claimAchievement } = useStore()
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
      bySub[s] = bySub[s] || { attempted: 0, correct: 0 }
      bySub[s].attempted += t.attempted
      bySub[s].correct += t.correct
    })
    return Object.entries(bySub)
      .map(([id, v]) => ({
        label: SUBJECTS[id]?.short || id,
        value: v.correct / Math.max(1, v.attempted),
        raw: v.correct / Math.max(1, v.attempted),
      }))
      .slice(0, 7)
  }, [stats.topics])

  const activity = useMemo(() => {
    const days = new Array(105).fill(0)
    state.attempts.forEach((a) => {
      const idx = Math.floor((Date.now() - a.date) / 86400000)
      if (idx >= 0 && idx < 105) days[104 - idx] += (a.correct || 0) + (a.wrong || 0)
    })
    return days
  }, [state.attempts])

  const perExam = stats.byExam
  const best = stats.best

  if (!state.attempts.length) {
    return (
      <div className="analytics-empty-page page-shell">
        <section className="analytics-empty-hero">
          <div className="analytics-empty-copy">
            <div className="section-kicker"><span className="kicker-dot" /> {L({ en: 'YOUR PROGRESS', hi: 'आपकी प्रगति' })}</div>
            <h1>{L({ en: 'Every journey starts with a first step.', hi: 'हर यात्रा की शुरुआत एक कदम से होती है।' })}</h1>
            <p>{L({ en: 'Complete your first practice set and your progress will begin to take shape here.', hi: 'अपना पहला अभ्यास सेट पूरा करें और आपकी प्रगति यहाँ दिखाई देने लगेगी।' })}</p>
            <button className="exam-primary" onClick={() => navigate('/exams')}>{L({ en: 'Explore exams', hi: 'परीक्षाएँ देखें' })}<ArrowRight size={16} /></button>
          </div>
          <div className="analytics-empty-art" aria-hidden="true"><span><BarChart3 size={46} strokeWidth={1.5} /></span><i><Sparkles size={20} /></i></div>
        </section>
        <div className="analytics-empty-heading"><div className="section-kicker">{L({ en: 'A CLEARER PICTURE', hi: 'एक साफ़ तस्वीर' })}</div><h2>{L({ en: 'Your effort, in focus', hi: 'आपकी मेहनत, एक नज़र में' })}</h2><p>{L({ en: 'These insights use only the practice you complete on this device.', hi: 'ये आँकड़े इसी डिवाइस पर पूरे किए गए अभ्यास से बनते हैं।' })}</p></div>
        <div className="analytics-empty-grid">
          <div className="analytics-insight insight-indigo"><span><ClipboardList size={21} /></span><h3>{L({ en: 'Your test history', hi: 'आपका टेस्ट इतिहास' })}</h3><p>{L({ en: 'Review your completed sets and see trends after two tests.', hi: 'पूरे किए सेट देखें और दो टेस्ट के बाद रुझान जानें।' })}</p></div>
          <div className="analytics-insight insight-teal"><span><CheckCircle2 size={21} /></span><h3>{L({ en: 'Accuracy at a glance', hi: 'सटीकता एक नज़र में' })}</h3><p>{L({ en: 'See how many questions you answered correctly.', hi: 'देखें कि आपने कितने प्रश्न सही किए।' })}</p></div>
          <div className="analytics-insight insight-peach"><span><Target size={21} /></span><h3>{L({ en: 'Find your focus', hi: 'अपना ध्यान चुनें' })}</h3><p>{L({ en: 'Discover the topics you may want to revisit.', hi: 'उन टॉपिक को पहचानें जिन्हें आप दोहराना चाहें।' })}</p></div>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-page page-shell stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{L({ en: 'Your performance', hi: 'आपका प्रदर्शन' })}</h1>
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
        <Card><Stat icon={<ClipboardList size={20} aria-hidden="true" />} value={stats.attempts} label={L({ en: 'Tests taken', hi: 'कुल टेस्ट' })} /></Card>
        <Card><Stat icon={<CheckCircle2 size={20} aria-hidden="true" />} value={stats.totalCorrect} label={L({ en: 'Correct answers', hi: 'सही उत्तर' })} /></Card>
        <Card><Stat icon={<Target size={20} aria-hidden="true" />} value={`${Math.round(stats.accuracy * 100)}%`} label={L({ en: 'Accuracy', hi: 'सटीकता' })} /></Card>
        <Card><Stat icon={<Clock3 size={20} aria-hidden="true" />} value={`${Math.round(stats.totalTime / 3600)}h ${Math.round((stats.totalTime % 3600) / 60)}m`} label={L({ en: 'Time invested', hi: 'कुल समय' })} /></Card>
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
              <div className="tiny muted">{L({ en: 'Take at least two tests to see the trend.', hi: 'रुझान देखने के लिए कम से कम दो टेस्ट दें।' })}</div>
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
                <div className="tiny muted">{L({ en: 'Attempt more subjects to see the radar map.', hi: 'रडार मैप देखने के लिए और विषयों का अभ्यास करें।' })}</div>
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
            <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={L({ en: 'Per-exam breakdown', hi: 'परीक्षा-वार विश्लेषण' })}>
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
                              <Bar value={e.correct / Math.max(1, e.answered)} thin />
                            </div>
                            <span className="tiny num">{Math.round((e.correct / Math.max(1, e.answered)) * 100)}%</span>
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
                const BadgeIcon = b.icon
                return (
                  <div key={b.id} className="row" style={{ gap: 11 }}>
                    <div
                      className="stat-ico"
                      style={{ width: 36, height: 36, opacity: earned ? 1 : 0.7, color: earned ? '#fff' : 'var(--text-2)', background: earned ? 'var(--grad)' : 'var(--surface-3)' }}
                    >
                      <BadgeIcon size={18} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small bold">{L(b.name)}</div>
                      <div className="tiny muted">{L(b.desc)}</div>
                    </div>
                    {earned ? (
                      claimed ? (
                        <Pill tone="success">✓</Pill>
                      ) : (
                        <button className="pill gold" onClick={() => claimAchievement(b.id)} aria-label={L({ en: `Claim ${L(b.name)} reward: 25 coins`, hi: `${L(b.name)} का पुरस्कार लें: 25 कॉइन` })}>+25 <Coins size={13} aria-hidden="true" /></button>
                      )
                    ) : (
                      <Pill><Lock size={13} aria-hidden="true" />{L({ en: 'Locked', hi: 'लॉक' })}</Pill>
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
