import React, { useMemo, useState } from 'react'
import { CA_ITEMS, CA_QUIZ, daysAgo } from '../data/currentAffairs'
import { useL } from '../lib/i18n'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { Card, CardHead, Pill, Button, SegmentedTabs, EmptyState } from '../components/ui'
import { useToast as useT } from '../components/ui'

const KEYS = ['A', 'B', 'C', 'D']

export default function CurrentAffairs() {
  const L = useL()
  const { state, submitAttempt } = useStore()
  const toast = useT()
  const [tab, setTab] = useState('daily')
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [finished, setFinished] = useState(false)

  const dated = useMemo(
    () =>
      CA_ITEMS.map((item, i) => ({
        ...item,
        date: daysAgo(i === 0 ? 0 : i),
      })),
    []
  )

  const startQuiz = () => {
    setQuiz(CA_QUIZ)
    setAnswers({})
    setFinished(false)
  }

  const submitQuiz = () => {
    setFinished(true)
    const correct = CA_QUIZ.filter((q) => answers[q.id] === q.a).length
    addAttempt({
      id: `ca-${Date.now()}`,
      examId: 'ssc-cgl',
      testId: 'ca-daily',
      title: 'Current Affairs Daily Quiz',
      mode: 'practice',
      date: Date.now(),
      score: correct,
      maxScore: CA_QUIZ.length,
      correct,
      wrong: CA_QUIZ.length - correct,
      unattempted: CA_QUIZ.filter((q) => answers[q.id] === undefined).length,
      accuracy: correct / CA_QUIZ.length,
      timeSpent: 90,
      perQuestion: CA_QUIZ.map((q) => ({ qid: q.id, chosen: answers[q.id] ?? -1, time: 18 })),
      totalQuestions: CA_QUIZ.length,
    })
    toast(`Scored ${correct}/${CA_QUIZ.length} in the CA quiz`, '📰')
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Current Affairs', hi: 'समसामयिक घटनाक्रम' })}</div>
          <div className="page-sub">
            {L({
              en: 'Daily 6-minute capsules, a monthly magazine and a free quiz — all exam-filtered.',
              hi: 'रोज़ 6 मिनट के कैप्सूल, मासिक पत्रिका और एक निःशुल्क क्विज़ — सभी परीक्षा-फ़िल्टर के साथ।',
            })}
          </div>
        </div>
        <Button variant="primary" onClick={startQuiz}>
          🧠 {L({ en: 'Take CA quiz', hi: 'सीए क्विज़ दें' })}
          {state.streak.count > 0 && <span className="pill brand">+10 XP</span>}
        </Button>
      </div>

      <SegmentedTabs
        tabs={[
          { value: 'daily', label: L({ en: 'Daily capsules', hi: 'दैनिक कैप्सूल' }) },
          { value: 'magazine', label: L({ en: 'Monthly magazine', hi: 'मासिक पत्रिका' }) },
          { value: 'quiz', label: L({ en: 'Quiz', hi: 'क्विज़' }) },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'daily' && (
        <div className="grid g-main">
          <div className="stack" style={{ gap: 16 }}>
            {dated.map((item, i) => (
              <Card key={item.id}>
                <div className="spread" style={{ marginBottom: 10 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Pill tone={i === 0 ? 'brand' : ''}>
                      {i === 0 ? L({ en: 'Today', hi: 'आज' }) : item.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Pill>
                    <Pill>{L(item.tag)}</Pill>
                    <Pill tone="success">{L({ en: 'Exam-relevant', hi: 'परीक्षा-संबंधी' })}</Pill>
                  </div>
                  <span className="tiny muted">{L({ en: '6 min read', hi: '6 मिनट पढ़ें' })}</span>
                </div>
                <div className="bold" style={{ fontSize: 16.5, lineHeight: 1.45, marginBottom: 9 }}>{L(item.title)}</div>
                <p className="small muted" style={{ margin: '0 0 12px', lineHeight: 1.7 }}>{L(item.body)}</p>
                <div className="explain" style={{ padding: '12px 14px' }}>
                  <b>{L({ en: 'Why it matters: ', hi: 'यह क्यों मायने रखता है: ' })}</b>
                  {item.impact}
                </div>
              </Card>
            ))}
          </div>

          <div className="stack" style={{ gap: 18 }}>
            <Card>
              <CardHead icon="📅" title={L({ en: '7-day recap', hi: '7-दिन का सारांश' })} />
              <div className="stack sm">
                {dated.slice(0, 7).map((d) => (
                  <div key={d.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <div className="tiny muted num" style={{ width: 52, paddingTop: 2 }}>
                      {d.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="small" style={{ flex: 1 }}>{L(d.title)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHead icon="🔖" title={L({ en: 'Save for revision', hi: 'दोहराव के लिए सहेजें' })} />
              <div className="small muted" style={{ lineHeight: 1.7 }}>
                {L({
                  en: 'Tap the bookmark on any capsule to build a personal revision list. We keep it on your device.',
                  hi: 'किसी भी कैप्सूल पर बुकमार्क दबाकर अपनी दोहराव सूची बनाएँ। यह आपके डिवाइस पर रहता है।',
                })}
              </div>
              <Button size="sm" className="block" style={{ marginTop: 12 }} onClick={() => navigate('/bookmarks')}>
                {L({ en: 'Open saved items', hi: 'सहेजे गए खोलें' })}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {tab === 'magazine' && (
        <div className="grid g-main">
          <Card>
            <CardHead
              icon="📰"
              title={L({ en: 'EXAMEDGE Monthly — November 2026', hi: 'EXAMEDGE मासिक — नवंबर 2026' })}
              sub={L({ en: '64 pages · 8 sections · 30 MCQs with answer key', hi: '64 पृष्ठ · 8 अनुभाग · उत्तर-कुंजी के साथ 30 MCQ' })}
            />
            <div className="grid g2" style={{ gap: 12 }}>
              {[
                ['🇮🇳', 'National', 'नैशनल', '6 key decisions explained in exam-ready language'],
                ['🌍', 'International', 'इंटरनेशनल', 'BRICS expansion, Quad critical minerals, summit calendar'],
                ['📈', 'Economy', 'इकॉनॉमी', 'MPC decision decoded, forex reserves, budget 2027 expectations'],
                ['🧪', 'Science & Tech', 'विज्ञान', 'ISRO missions, AI policy, nuclear developments'],
                ['🏛️', 'Polity', 'पॉलिटी', 'Constitutional amendments, bills, governance reforms'],
                ['🗺️', 'Environment', 'एनवायरनमेंट', 'COP outcomes, biodiversity hotspots, national parks'],
              ].map(([i, en, hi, d]) => (
                <div key={en} className="card" style={{ padding: 14, background: 'var(--surface-2)' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{i}</span>
                    <div>
                      <div className="small bold">{L({ en, hi })}</div>
                      <div className="tiny muted">{d}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
              <Button variant="primary" onClick={() => toast('Magazine opened in reader', '📰')}>
                📖 {L({ en: 'Open magazine', hi: 'पत्रिका खोलें' })}
              </Button>
              <Button onClick={() => toast('PDF download started', '⬇')}>⬇ {L({ en: 'Download PDF', hi: 'PDF डाउनलोड' })}</Button>
            </div>
          </Card>

          <Card>
            <CardHead title={L({ en: 'What’s inside', hi: 'इसमें क्या है' })} />
            <div className="stack sm">
              {[
                ['📌', 'One-liner facts', '40 quick revision points'],
                ['🗞️', 'Analysis', 'Why each event matters for your exam'],
                ['🧠', 'Memory hooks', 'Mnemonics and timelines'],
                ['📝', 'Practice set', '30 MCQs with detailed solutions'],
                ['📊', 'Data corner', 'Infographics and comparative tables'],
              ].map(([i, t, d]) => (
                <div key={t} className="row" style={{ gap: 11 }}>
                  <span style={{ fontSize: 17 }}>{i}</span>
                  <div>
                    <div className="small bold">{L({ en: t, hi: t })}</div>
                    <div className="tiny muted">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'quiz' && (
        <Card>
          <CardHead
            icon="🧠"
            title={L({ en: 'Current Affairs Daily Quiz', hi: 'सीए डेली क्विज़' })}
            sub={L({ en: '5 questions · 2 minutes · instant explanations', hi: '5 प्रश्न · 2 मिनट · तुरंत व्याख्या' })}
          />
          {!quiz ? (
            <EmptyState
              icon="🧠"
              title="Ready for a quick CA quiz?"
              sub="Test today's capsule and earn XP."
              action={<Button variant="primary" onClick={startQuiz}>Start quiz</Button>}
            />
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              {CA_QUIZ.map((q, qi) => {
                const sel = answers[q.id]
                return (
                  <div key={q.id}>
                    <div className="row" style={{ gap: 9, marginBottom: 10 }}>
                      <Pill tone="brand">Q{qi + 1}</Pill>
                    </div>
                    <div className="q-text" style={{ fontSize: 15 }}>{L(q.q)}</div>
                    {q.o.map((o, oi) => {
                      let cls = ''
                      if (finished) {
                        if (oi === q.a) cls = 'correct'
                        else if (sel === oi) cls = 'wrong'
                      } else if (sel === oi) cls = 'sel'
                      return (
                        <div key={oi} className={`option ${cls}`} onClick={() => !finished && setAnswers((a) => ({ ...a, [q.id]: oi }))}>
                          <div className="opt-key">{KEYS[oi]}</div>
                          <div style={{ flex: 1 }}>{L(o)}</div>
                        </div>
                      )
                    })}
                    {finished && (
                      <div className="explain" style={{ marginTop: 10 }}>
                        <b>{L({ en: 'Solution: ', hi: 'समाधान: ' })}</b>
                        {L(q.exp)}
                      </div>
                    )}
                    <div className="sep" />
                  </div>
                )
              })}
              {!finished ? (
                <Button variant="primary" className="block" onClick={submitQuiz}>
                  {L({ en: 'Submit quiz', hi: 'क्विज़ सबमिट करें' })}
                </Button>
              ) : (
                <div className="explain center" style={{ padding: 20 }}>
                  <div className="bold" style={{ fontSize: 18, color: 'var(--accent)' }}>
                    {L({
                      en: `You scored ${CA_QUIZ.filter((q) => answers[q.id] === q.a).length} / ${CA_QUIZ.length}`,
                      hi: `आपका स्कोर ${CA_QUIZ.filter((q) => answers[q.id] === q.a).length} / ${CA_QUIZ.length}`,
                    })}
                  </div>
                  <div className="small muted" style={{ marginTop: 6 }}>
                    {L({ en: 'Keep reading today’s capsule to hit 5/5 tomorrow.', hi: 'कल 5/5 करने के लिए आज का कैप्सूल पढ़ते रहें।' })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* CA quiz modal-ish inline */}
      {quiz && tab !== 'quiz' && finished && (
        <div className="card" style={{ borderColor: 'rgba(99,102,241,0.4)' }}>
          <div className="spread">
            <div className="small bold">📰 {L({ en: 'CA quiz completed', hi: 'सीए क्विज़ पूरा हुआ' })}</div>
            <Pill tone="success">
              {CA_QUIZ.filter((q) => answers[q.id] === q.a).length}/{CA_QUIZ.length}
            </Pill>
          </div>
        </div>
      )}
    </div>
  )
}
