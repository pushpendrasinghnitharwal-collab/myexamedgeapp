import React, { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { examById, TOPICS, SUBJECTS } from '../data/exams'
import { QUESTIONS } from '../data/questions'
import { Card, CardHead, Pill, Button, Metric, Bar, SegmentedTabs, useToast } from '../components/ui'
import { Ring, Donut, BarList } from '../components/charts'
import { shortDate, formatTime } from '../lib/utils'
import { buildLeaderboard, percentileOf } from '../lib/leaderboard'

export default function Results({ attemptId }) {
  const { state } = useStore()
  const L = useL()
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [filter, setFilter] = useState('all')

  const attempt = state.attempts.find((a) => a.id === attemptId)
  const exam = attempt ? examById(attempt.examId) : null

  const analysis = useMemo(() => {
    if (!attempt) return null
    const perQ = attempt.perQuestion.map((pq) => ({ ...pq, q: QUESTIONS.find((q) => q.id === pq.qid) })).filter((x) => x.q)
    const topics = {}
    const subjects = {}
    perQ.forEach((p) => {
      const topic = TOPICS[p.q.topic]
      const t = (topics[p.q.topic] = topics[p.q.topic] || { attempted: 0, correct: 0, time: 0 })
      t.attempted++
      t.time += p.time
      if (p.chosen === p.q.a) t.correct++
      const subj = topic?.subject || 'ga'
      const s = (subjects[subj] = subjects[subj] || { attempted: 0, correct: 0, time: 0 })
      s.attempted++
      s.time += p.time
      if (p.chosen === p.q.a) s.correct++
    })
    const topicList = Object.entries(topics).map(([id, v]) => ({
      id,
      name: TOPICS[id]?.name || id,
      subject: TOPICS[id]?.subject,
      ...v,
      accuracy: v.attempted ? v.correct / v.attempted : 0,
      avgTime: v.attempted ? v.time / v.attempted : 0,
    }))
    const subjectList = Object.entries(subjects).map(([id, v]) => ({
      id,
      name: SUBJECTS[id]?.name || id,
      short: SUBJECTS[id]?.short || id,
      icon: SUBJECTS[id]?.icon || '📘',
      ...v,
      accuracy: v.attempted ? v.correct / v.attempted : 0,
    }))
    const sorted = [...topicList].sort((a, b) => a.accuracy - b.accuracy)
    const lb = buildLeaderboard(attempt.examId)
    const pct = percentileOf(attempt.score, lb)
    const rank = lb.filter((r) => r.score >= attempt.score).length + 1
    const fastest = Math.min(...perQ.filter((p) => p.chosen >= 0).map((p) => p.time), 999)
    const slowest = Math.max(...perQ.map((p) => p.time), 0)
    return { perQ, topics: sorted, subjectList, pct, rank, fastest, slowest, lb }
  }, [attempt])

  if (!attempt || !exam) {
    return (
      <div className="empty">
        <div className="ico">📄</div>
        Result not found.
        <div style={{ marginTop: 14 }}>
          <Button onClick={() => navigate('/analytics')}>Back to analytics</Button>
        </div>
      </div>
    )
  }

  const scorePct = (attempt.score / Math.max(1, attempt.maxScore)) * 100
  const shown = analysis.perQ.filter((p) => {
    if (filter === 'all') return true
    if (filter === 'wrong') return p.chosen !== p.q.a
    if (filter === 'correct') return p.chosen === p.q.a
    return p.chosen < 0
  })

  const verdict =
    scorePct >= 75
      ? { en: 'Excellent — exam-ready performance!', hi: 'बहुत बढ़िया — परीक्षा के लिए पूरी तरह तैयार!' , tone: 'success', icon: '🏆' }
      : scorePct >= 50
      ? { en: 'Good — a little polish and you are there.', hi: 'अच्छा — थोड़ा और अभ्यास करें, आप वहीं पहुँच जाएँगे।', tone: 'brand', icon: '💪' }
      : { en: 'Needs work — analyse your weak topics below.', hi: 'मेहनत ज़रूरी — नीचे अपने कमज़ोर टॉपिक देखें।', tone: 'warn', icon: '📚' }

  return (
    <div className="stack" style={{ gap: 18 }}>
      {/* ── Score header ── */}
      <section className="hero">
        <div className="spread" style={{ flexWrap: 'wrap', gap: 24 }}>
          <div className="row" style={{ gap: 22, flexWrap: 'wrap' }}>
            <Ring value={scorePct} size={158} stroke={14} label={`${attempt.score}`} sub={`/ ${attempt.maxScore} ${L({ en: 'marks', hi: 'अंक' })}`} />
            <div style={{ minWidth: 200 }}>
              <div className="eyebrow">
                <span className="dot" /> {attempt.mode === 'mock' ? L({ en: 'Mock test result', hi: 'मॉक टेस्ट परिणाम' }) : L({ en: 'Practice result', hi: 'प्रैक्टिस परिणाम' })}
              </div>
              <h1 style={{ fontSize: 26 }}>{exam.name}</h1>
              <div className="tiny muted" style={{ marginBottom: 10 }}>
                {attempt.title} · {shortDate(attempt.date)}
              </div>
              <Pill tone={verdict.tone}>
                {verdict.icon} {L({ en: verdict.en, hi: verdict.hi })}
              </Pill>
            </div>
          </div>

          <div className="grid g2" style={{ gap: 10, minWidth: 320, flex: '1 1 320px' }}>
            <Metric value={`${Math.round(attempt.accuracy * 100)}%`} label={L({ en: 'Accuracy', hi: 'सटीकता' })} tone="var(--accent)" />
            <Metric value={`#${analysis.rank}`} label={L({ en: 'All-India rank', hi: 'ऑल-इंडिया रैंक' })} />
            <Metric value={attempt.correct + '/' + attempt.totalQuestions} label={L({ en: 'Correct / Total', hi: 'सही / कुल' })} tone="var(--success)" />
            <Metric value={formatTime(attempt.timeSpent)} label={L({ en: 'Time taken', hi: 'लगा समय' })} />
            <Metric value={attempt.unattempted} label={L({ en: 'Skipped', hi: 'छोड़े गए' })} tone="var(--warn)" />
            <Metric value={attempt.wrong} label={L({ en: 'Wrong', hi: 'गलत' })} tone="var(--danger)" />
          </div>
        </div>

        <div className="row wrap" style={{ gap: 10, marginTop: 20 }}>
          <Button variant="primary" onClick={() => navigate(`/test/${attempt.examId}/${attempt.testId}`)}>
            🔁 {L({ en: 'Re-attempt test', hi: 'फिर से टेस्ट दें' })}
          </Button>
          <Button onClick={() => navigate('/analytics')}>📊 {L({ en: 'Full analytics', hi: 'पूर्ण विश्लेषण' })}</Button>
          <Button variant="ghost" onClick={() => navigate('/leaderboard')}>🏆 {L({ en: 'See leaderboard', hi: 'लीडरबोर्ड देखें' })}</Button>
          <Button
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(`I scored ${attempt.score}/${attempt.maxScore} on ${exam.name} on EXAMEDGE!`)
              toast(L({ en: 'Result copied to clipboard', hi: 'परिणाम क्लिपबोर्ड पर कॉपी हुआ' }), '📋')
            }}
          >
            📤 {L({ en: 'Share result', hi: 'परिणाम साझा करें' })}
          </Button>
        </div>
      </section>

      <SegmentedTabs
        tabs={[
          { value: 'overview', label: L({ en: 'Overview', hi: 'अवलोकन' }) },
          { value: 'topics', label: L({ en: 'Topic analysis', hi: 'टॉपिक विश्लेषण' }) },
          { value: 'review', label: L({ en: 'Question review', hi: 'प्रश्न समीक्षा' }) },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid g-main">
          <div className="stack" style={{ gap: 18 }}>
            <Card>
              <CardHead
                title={L({ en: 'Subject-wise performance', hi: 'विषयवार प्रदर्शन' })}
                sub={L({ en: 'Accuracy across the paper blueprint', hi: 'पेपर ब्लूप्रिंट के अनुसार सटीकता' })}
              />
              <div className="stack sm">
                {analysis.subjectList.map((s) => (
                  <div key={s.id}>
                    <div className="spread" style={{ marginBottom: 5 }}>
                      <span className="small bold">
                        {s.icon} {L({ en: s.name, hi: SUBJECTS[s.id]?.hi || s.name })}
                      </span>
                      <span className="tiny muted num">
                        {s.correct}/{s.attempted} · {Math.round(s.accuracy * 100)}%
                      </span>
                    </div>
                    <Bar
                      value={s.accuracy}
                      tone={
                        s.accuracy >= 0.75
                          ? 'linear-gradient(90deg,#10b981,#34d399)'
                          : s.accuracy >= 0.5
                          ? 'linear-gradient(90deg,#6366f1,#22d3ee)'
                          : 'linear-gradient(90deg,#f43f5e,#fb7185)'
                      }
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHead
                title={L({ en: 'What to fix next', hi: 'आगे क्या सुधारें' })}
                sub={L({ en: 'Auto-generated from this paper', hi: 'इस पेपर से स्वतः निर्धारित' })}
              />
              <div className="stack sm">
                {analysis.topics.slice(0, 5).map((t) => (
                  <div key={t.id} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                    <div className="stat-ico" style={{ width: 32, height: 32, fontSize: 14, background: 'rgba(244,63,94,0.14)' }}>
                      ⚠
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="small bold">{t.name}</div>
                      <div className="tiny muted">
                        {L({ en: `Accuracy ${Math.round(t.accuracy * 100)}% · avg ${Math.round(t.avgTime)}s/question`, hi: `सटीकता ${Math.round(t.accuracy * 100)}% · औसत ${Math.round(t.avgTime)} सेकंड/प्रश्न` })}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/test/${attempt.examId}/${attempt.examId}-topic-${t.id}`)}>
                      {L({ en: 'Drill', hi: 'अभ्यास' })}
                    </Button>
                  </div>
                ))}
                {analysis.topics.length === 0 && <div className="tiny muted">Perfect run — nothing to fix. 🎉</div>}
              </div>
            </Card>
          </div>

          <div className="stack" style={{ gap: 18 }}>
            <Card>
              <CardHead title={L({ en: 'Answer mix', hi: 'उत्तर मिश्रण' })} />
              <div className="row" style={{ gap: 18, justifyContent: 'center' }}>
                <Donut
                  segments={[
                    { label: 'Correct', value: attempt.correct, color: '#10b981' },
                    { label: 'Wrong', value: attempt.wrong, color: '#f43f5e' },
                    { label: 'Skipped', value: attempt.unattempted, color: '#64748b' },
                  ]}
                  size={140}
                  centerLabel={`${Math.round(attempt.accuracy * 100)}%`}
                  centerSub={L({ en: 'accuracy', hi: 'सटीकता' })}
                />
                <div className="stack sm">
                  {[
                    ['✓', 'Correct', attempt.correct, 'var(--success)'],
                    ['✕', 'Wrong', attempt.wrong, 'var(--danger)'],
                    ['—', 'Skipped', attempt.unattempted, 'var(--muted)'],
                  ].map(([i, l, v, c]) => (
                    <div key={l} className="row" style={{ gap: 8 }}>
                      <span style={{ color: c, fontWeight: 800 }}>{i}</span>
                      <span className="small">{l}</span>
                      <span className="spacer" />
                      <span className="small bold num">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title={L({ en: 'Time analysis', hi: 'समय विश्लेषण' })} />
              <div className="stack sm">
                <div className="kv"><span className="k">{L({ en: 'Total time', hi: 'कुल समय' })}</span><span className="bold">{formatTime(attempt.timeSpent)}</span></div>
                <div className="kv"><span className="k">{L({ en: 'Avg per question', hi: 'प्रति प्रश्न औसत' })}</span><span className="bold">{Math.round(attempt.timeSpent / Math.max(1, attempt.totalQuestions))}s</span></div>
                <div className="kv"><span className="k">{L({ en: 'Fastest answer', hi: 'सबसे तेज़ उत्तर' })}</span><span className="bold">{analysis.fastest}s</span></div>
                <div className="kv"><span className="k">{L({ en: 'Slowest answer', hi: 'सबसे धीमा उत्तर' })}</span><span className="bold">{analysis.slowest}s</span></div>
                <div className="kv">
                  <span className="k">{L({ en: 'Percentile', hi: 'प्रतिशतक' })}</span>
                  <span className="bold" style={{ color: 'var(--accent)' }}>
                    Top {Math.round((1 - analysis.pct) * 100)}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'topics' && (
        <Card>
          <CardHead
            title={L({ en: 'Topic-wise breakdown', hi: 'टॉपिक-वार विश्लेषण' })}
            sub={L({ en: 'Sorted weakest first — this is your revision queue', hi: 'सबसे कमज़ोर पहले — यही आपकी दोहराव सूची है' })}
          />
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{L({ en: 'Topic', hi: 'टॉपिक' })}</th>
                  <th>{L({ en: 'Subject', hi: 'विषय' })}</th>
                  <th>{L({ en: 'Attempted', hi: 'प्रयासित' })}</th>
                  <th>{L({ en: 'Correct', hi: 'सही' })}</th>
                  <th>{L({ en: 'Accuracy', hi: 'सटीकता' })}</th>
                  <th>{L({ en: 'Avg time', hi: 'औसत समय' })}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {analysis.topics.map((t) => (
                  <tr key={t.id}>
                    <td className="bold">{t.name}</td>
                    <td className="muted small">{SUBJECTS[t.subject]?.short || '—'}</td>
                    <td className="num">{t.attempted}</td>
                    <td className="num">{t.correct}</td>
                    <td style={{ minWidth: 130 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <div style={{ width: 70 }}>
                          <Bar
                            value={t.accuracy}
                            thin
                            tone={
                              t.accuracy >= 0.75
                                ? 'linear-gradient(90deg,#10b981,#34d399)'
                                : t.accuracy >= 0.5
                                ? 'linear-gradient(90deg,#6366f1,#22d3ee)'
                                : 'linear-gradient(90deg,#f43f5e,#fb7185)'
                            }
                          />
                        </div>
                        <span className="tiny num">{Math.round(t.accuracy * 100)}%</span>
                      </div>
                    </td>
                    <td className="num muted small">{Math.round(t.avgTime)}s</td>
                    <td>
                      <Button size="sm" onClick={() => navigate(`/test/${attempt.examId}/${attempt.examId}-topic-${t.id}`)}>
                        {L({ en: 'Drill', hi: 'अभ्यास' })}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'review' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="chip-row">
            {[
              ['all', L({ en: `All (${analysis.perQ.length})`, hi: `सभी (${analysis.perQ.length})` })],
              ['wrong', L({ en: `Wrong (${attempt.wrong})`, hi: `गलत (${attempt.wrong})` })],
              ['correct', L({ en: `Correct (${attempt.correct})`, hi: `सही (${attempt.correct})` })],
              ['skipped', L({ en: `Skipped (${attempt.unattempted})`, hi: `छोड़े गए (${attempt.unattempted})` })],
            ].map(([v, l]) => (
              <button key={v} className={`chip ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>
                {l}
              </button>
            ))}
          </div>

          {shown.map((p, i) => {
            const isRight = p.chosen === p.q.a
            const skipped = p.chosen < 0
            return (
              <Card key={p.qid}>
                <div className="spread" style={{ marginBottom: 10 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Pill tone={skipped ? '' : isRight ? 'success' : 'danger'}>
                      {skipped ? '— Skipped' : isRight ? '✓ Correct' : '✕ Wrong'}
                    </Pill>
                    <Pill>{TOPICS[p.q.topic]?.name}</Pill>
                    <Pill>{p.time}s</Pill>
                  </div>
                  <span className="tiny muted">Q{i + 1}</span>
                </div>
                <div className="q-text" style={{ fontSize: 15 }}>
                  {L(p.q.q)}
                </div>
                <div>
                  {p.q.o.map((o, oi) => {
                    let cls = ''
                    if (oi === p.q.a) cls = 'correct'
                    else if (oi === p.chosen) cls = 'wrong'
                    return (
                      <div key={oi} className={`option ${cls}`} style={{ cursor: 'default' }}>
                        <div className="opt-key">{'ABCD'[oi]}</div>
                        <div style={{ flex: 1 }}>{L(o)}</div>
                        {oi === p.q.a && <span className="pill success">{L({ en: 'Correct', hi: 'सही' })}</span>}
                        {oi === p.chosen && oi !== p.q.a && <span className="pill danger">{L({ en: 'Your answer', hi: 'आपका उत्तर' })}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="explain" style={{ marginTop: 12 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    <span className="pill brand">💡 {L({ en: 'Solution', hi: 'समाधान' })}</span>
                  </div>
                  {L(p.q.exp)}
                </div>
              </Card>
            )
          })}
          {!shown.length && <div className="empty">Nothing in this filter.</div>}
        </div>
      )}
    </div>
  )
}
