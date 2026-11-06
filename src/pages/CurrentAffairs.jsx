import React, { useMemo, useState } from 'react'
import { CA_ITEMS, CA_QUIZ } from '../data/currentAffairs'
import { useL } from '../lib/i18n'
import { navigate } from '../lib/router'
import { Card, CardHead, Pill, Button, SegmentedTabs, EmptyState } from '../components/ui'
import { useToast as useT } from '../components/ui'

const KEYS = ['A', 'B', 'C', 'D']

export default function CurrentAffairs() {
  const L = useL()
  const toast = useT()
  const [tab, setTab] = useState('daily')
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [finished, setFinished] = useState(false)

  const dated = useMemo(() => CA_ITEMS, [])

  const startQuiz = () => {
    setQuiz(CA_QUIZ)
    setTab('quiz')
    setAnswers({})
    setFinished(false)
  }

  const submitQuiz = () => {
    setFinished(true)
    const correct = CA_QUIZ.filter((q) => answers[q.id] === q.a).length
    toast(`Scored ${correct}/${CA_QUIZ.length} in the CA quiz`, '📰')
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{L({ en: 'Current Affairs', hi: 'समसामयिक घटनाक्रम' })}</h1>
          <div className="page-sub">
            {L({
              en: 'Preview the current-affairs interface and its existing sample content.',
              hi: 'करेंट अफेयर्स इंटरफेस और मौजूदा नमूना सामग्री का प्रीव्यू देखें।',
            })}
          </div>
        </div>
        <Button variant="primary" onClick={startQuiz}>
          🧠 {L({ en: 'Take CA quiz', hi: 'सीए क्विज़ दें' })}
        </Button>
      </div>

      <div className="sample-content-notice">{L({ en: 'Interface preview: the existing items and quiz have not been verified as current news. Please check reliable sources before using them for preparation.', hi: 'इंटरफेस प्रीव्यू: मौजूदा सामग्री और क्विज़ का वर्तमान समाचार के रूप में सत्यापन नहीं हुआ है। तैयारी के लिए भरोसेमंद स्रोत देखें।' })}</div>

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
                      {L({ en: 'Sample', hi: 'नमूना' })}
                    </Pill>
                    <Pill>{L(item.tag)}</Pill>

                  </div>
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
              <CardHead icon="📅" title={L({ en: 'Sample topics', hi: 'नमूना विषय' })} />
              <div className="stack sm">
                {dated.slice(0, 7).map((d) => (
                  <div key={d.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <div className="tiny muted num" style={{ width: 52, paddingTop: 2 }}>
                      {L({ en: 'Sample', hi: 'नमूना' })}
                    </div>
                    <div className="small" style={{ flex: 1 }}>{L(d.title)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHead icon="🔖" title={L({ en: 'Your saved questions', hi: 'आपके सहेजे गए प्रश्न' })} />
              <div className="small muted" style={{ lineHeight: 1.7 }}>
                {L({
                  en: 'Questions bookmarked in practice sessions are kept on this device for revision.',
                  hi: 'अभ्यास सत्रों में बुकमार्क किए गए प्रश्न दोहराव के लिए इस डिवाइस पर सहेजे जाते हैं।',
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
              title={L({ en: 'Monthly magazine preview', hi: 'मासिक पत्रिका प्रीव्यू' })}
              sub={L({ en: 'A preview of the planned magazine layout', hi: 'प्रस्तावित पत्रिका लेआउट का प्रीव्यू' })}
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
              <Button variant="primary" disabled>
                📖 {L({ en: 'Open magazine', hi: 'पत्रिका खोलें' })}
              </Button>
              <Button disabled>⬇ {L({ en: 'Download PDF', hi: 'PDF डाउनलोड' })}</Button>
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
            title={L({ en: 'Sample Current Affairs Quiz', hi: 'नमूना करेंट अफेयर्स क्विज़' })}
            sub={L({ en: `${CA_QUIZ.length} sample questions · results are not saved`, hi: `${CA_QUIZ.length} नमूना प्रश्न · परिणाम सहेजे नहीं जाते` })}
          />
          {!quiz ? (
            <EmptyState
              icon="🧠"
              title="Ready for a quick CA quiz?"
              sub="Try the existing sample quiz."
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
                        <button type="button" key={oi} className={`option ${cls}`} onClick={() => !finished && setAnswers((a) => ({ ...a, [q.id]: oi }))} aria-pressed={sel === oi} disabled={finished}>
                          <span className="opt-key">{KEYS[oi]}</span>
                          <span style={{ flex: 1 }}>{L(o)}</span>
                        </button>
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
                    {L({ en: 'Review the explanations and verify the sample facts independently.', hi: 'समाधान देखें और नमूना तथ्यों की स्वतंत्र रूप से जाँच करें।' })}
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
