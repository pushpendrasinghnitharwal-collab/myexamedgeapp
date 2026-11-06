import React, { useMemo, useState } from 'react'
import { examById, CATEGORIES, SUBJECTS } from '../data/exams'
import { TEST_CATALOGUE, TEST_TYPE_LABEL } from '../lib/tests'
import { navigate } from '../lib/router'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, SegmentedTabs, Bar } from '../components/ui'

export default function ExamDetail({ examId }) {
  const L = useL()
  const exam = examById(examId)
  const [tab, setTab] = useState('all')
  const [mode, setMode] = useState('mock')

  const tests = useMemo(() => TEST_CATALOGUE[examId] || [], [examId])

  const filtered = useMemo(() => {
    if (tab === 'all') return tests
    return tests.filter((t) => t.type === tab)
  }, [tests, tab])

  if (!exam) return <div className="empty">Exam not found</div>
  const cat = CATEGORIES.find((c) => c.id === exam.category)

  const tabs = [
    { value: 'all', label: `All (${tests.length})` },
    { value: 'full', label: L({ en: 'Full Mocks', hi: 'फुल मॉक' }) },
    { value: 'sectional', label: L({ en: 'Sectional', hi: 'सेक्शनल' }) },
    { value: 'topic', label: L({ en: 'Topic Drills', hi: 'टॉपिक ड्रिल' }) },
    { value: 'live', label: L({ en: 'Live', hi: 'लाइव' }) },
  ]

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="hero">
        <div className="spread" style={{ flexWrap: 'wrap', gap: 18 }}>
          <div style={{ flex: '1 1 320px' }}>
            <div className="eyebrow">
              <span className="dot" /> {cat.icon} {L({ en: cat.name, hi: cat.hi })} · {exam.tier}
            </div>
            <h1>{exam.name}</h1>
            <p>{L({ en: exam.subtitle, hi: exam.subtitle })}</p>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="pill">⏱ {exam.duration} {L({ en: 'minutes', hi: 'मिनट' })}</span>
              <span className="pill">📝 {exam.questions} {L({ en: 'questions', hi: 'प्रश्न' })}</span>
              <span className="pill">🎯 {exam.marks} {L({ en: 'marks', hi: 'अंक' })}</span>
              <span className="pill">➖ {exam.negative} {L({ en: 'negative', hi: 'नेगेटिव' })}</span>
              <span className="pill success">📈 {exam.popularity}% {L({ en: 'popularity', hi: 'लोकप्रियता' })}</span>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <Button variant="primary" onClick={() => navigate(`/test/${exam.id}/${tests.find((t) => t.type === 'full')?.id}`)}>
              ▶ {L({ en: 'Start mock test', hi: 'मॉक टेस्ट शुरू करें' })}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/leaderboard')}>
              🏆 {L({ en: 'Rankings', hi: 'रैंकिंग' })}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid g-main">
        <Card>
          <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="spread" style={{ marginBottom: 14 }}>
            <div className="small bold">
              {L({ en: 'Test mode', hi: 'टेस्ट मोड' })}
              <span className="tiny muted" style={{ fontWeight: 400 }}>
                {' '}
                — {L({ en: 'Mock = strict timer, no going back. Practice = instant feedback.', hi: 'मॉक = सख्त टाइमर, वापस नहीं। प्रैक्टिस = तुरंत फीडबैक।' })}
              </span>
            </div>
            <div className="seg">
              <button className={mode === 'mock' ? 'on' : ''} onClick={() => setMode('mock')}>
                {L({ en: 'Mock', hi: 'मॉक' })}
              </button>
              <button className={mode === 'practice' ? 'on' : ''} onClick={() => setMode('practice')}>
                {L({ en: 'Practice', hi: 'प्रैक्टिस' })}
              </button>
            </div>
          </div>

          <div className="stack sm">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="list-row"
                style={{ cursor: 'pointer', borderRadius: 12, padding: '13px 12px', border: '1px solid var(--line)' }}
                onClick={() => navigate(`/test/${exam.id}/${t.id}?mode=${mode}`)}
              >
                <div
                  className="exam-icon"
                  style={{
                    fontSize: 17,
                    background: t.type === 'live' ? 'rgba(244,63,94,0.16)' : 'var(--surface-2)',
                    borderColor: t.type === 'live' ? 'rgba(244,63,94,0.4)' : undefined,
                  }}
                >
                  {t.type === 'full' ? '📋' : t.type === 'sectional' ? '🧩' : t.type === 'topic' ? '🎯' : t.type === 'live' ? '🔴' : '⚡'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="small bold">{L({ en: t.title, hi: t.hi })}</span>
                    {t.tag === 'LIVE' && <span className="pill danger">LIVE</span>}
                    {t.premium && <span className="pill gold">PRO</span>}
                  </div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>
                    {L({ en: t.desc, hi: t.hiDesc })}
                  </div>
                  <div className="row wrap tiny muted" style={{ gap: 10, marginTop: 6 }}>
                    <span>📝 {t.questions} Q</span>
                    <span>⏱ {t.duration} min</span>
                    <span>👥 {(t.attempts / 1000).toFixed(1)}k {L({ en: 'attempts', hi: 'प्रयास' })}</span>
                    <span>📊 {L({ en: 'avg', hi: 'औसत' })} {t.avg}</span>
                    <span>⭐ {t.rating}</span>
                  </div>
                </div>
                <Button size="sm" variant={t.premium ? 'default' : 'primary'}>
                  {L({ en: 'Start', hi: 'शुरू' })}
                </Button>
              </div>
            ))}
            {!filtered.length && <div className="empty">No tests in this category yet.</div>}
          </div>
        </Card>

        <div className="stack" style={{ gap: 18 }}>
          <Card>
            <CardHead title={L({ en: 'Paper blueprint', hi: 'पेपर ब्लूप्रिंट' })} sub={L({ en: 'Subject distribution & marking', hi: 'विषय वितरण एवं अंकन' })} />
            <div className="stack sm">
              {exam.subjects.map((s) => (
                <div key={s}>
                  <div className="spread" style={{ marginBottom: 4 }}>
                    <span className="small bold">{SUBJECTS[s]?.icon} {L({ en: SUBJECTS[s]?.name || s, hi: SUBJECTS[s]?.hi || s })}</span>
                    <span className="tiny muted num">{Math.round(100 / exam.subjects.length)}%</span>
                  </div>
                  <Bar value={1 / exam.subjects.length} thin />
                </div>
              ))}
            </div>
            <div className="sep" />
            <div className="kv"><span className="k">Negative marking</span><span className="bold">− {exam.negative} {L({ en: 'per wrong answer', hi: 'प्रति गलत उत्तर' })}</span></div>
            <div className="kv"><span className="k">Total duration</span><span className="bold">{exam.duration} min</span></div>
            <div className="kv"><span className="k">Total questions</span><span className="bold">{exam.questions}</span></div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'How EXAMEDGE helps', hi: 'EXAMEDGE कैसे मदद करता है' })} />
            <div className="stack sm">
              {[
                ['🧭', { en: 'Blueprint-accurate papers', hi: 'ब्लूप्रिंट के अनुसार सटीक पेपर' }, { en: 'Every mock mirrors the real paper pattern and marking scheme.', hi: 'हर मॉक असली पेपर पैटर्न और अंकन योजना के अनुसार है।' }],
                ['🧪', { en: 'Instant solutions', hi: 'तुरंत समाधान' }, { en: 'Step-by-step solutions in English and Hindi after every question.', hi: 'हर प्रश्न के बाद अंग्रेज़ी और हिंदी में चरण-दर-चरण समाधान।' }],
                ['📊', { en: 'Topic-level analytics', hi: 'टॉपिक-स्तरीय विश्लेषण' }, { en: 'Know exactly which chapter is costing you marks.', hi: 'जानें कि कौनसा अध्याय आपके अंक खा रहा है।' }],
                ['🏆', { en: 'All-India ranks', hi: 'ऑल-इंडिया रैंक' }, { en: 'Know exactly where you stand among lakhs of peers.', hi: 'जानें कि आप लाखों में कहाँ खड़े हैं।' }],
              ].map(([i, t, d]) => (
                <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <div className="stat-ico" style={{ width: 34, height: 34, fontSize: 15 }}>{i}</div>
                  <div>
                    <div className="small bold">{L(t)}</div>
                    <div className="tiny muted">{L(d)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
