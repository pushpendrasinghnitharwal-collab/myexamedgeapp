import React, { useState } from 'react'
import { EXAMS, CATEGORIES } from '../data/exams'
import { useStore } from '../lib/store'
import { useL } from '../lib/i18n'
import { Button, Card, Pill } from '../components/ui'

export default function Onboarding() {
  const L = useL()
  const { register } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [examId, setExamId] = useState('ssc-cgl')
  const [goal, setGoal] = useState(25)

  const canNext = step === 0 || (step === 1 && name.trim().length > 1)

  const finish = () => {
    register({ name: name.trim(), phone: phone.trim(), examId, goal, avatar: 0 })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '28px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 760 }}>
        <div className="center" style={{ marginBottom: 22 }}>
          <div className="brand" style={{ justifyContent: 'center' }}>
            <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M4 7L12 3L20 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 5V21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
                <path d="M8 10H16M8 14H16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
                <path d="M14 18L17 15L20 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="brand-name" style={{ fontSize: 26 }}>EXAMEDGE</div>
              <div className="brand-tag">Ace your next exam</div>
            </div>
          </div>
        </div>

        <Card style={{ padding: 26 }}>
          {/* stepper */}
          <div className="row" style={{ gap: 8, marginBottom: 22 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ flex: 1 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 99,
                    background: i <= step ? 'var(--grad)' : 'var(--surface-3)',
                    transition: 'background .3s',
                  }}
                />
                <div className="tiny muted" style={{ marginTop: 6, textAlign: 'center' }}>
                  {['Welcome', 'Your goal', 'Daily plan'][i]}
                </div>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div>
              <h1 style={{ fontSize: 26, marginBottom: 8 }}>
                {L({ en: 'India’s exam prep, minus the fee', hi: 'भारत की परीक्षा तैयारी, बिना फीस के' })}
              </h1>
              <p className="small muted" style={{ marginTop: 0 }}>
                {L({
                  en: 'Full-length mocks in the exact official pattern, instant solutions in English and Hindi, topic-level analytics, live all-India rankings and daily current affairs.',
                  hi: 'आधिकारिक पैटर्न में फुल मॉक, अंग्रेज़ी और हिंदी में तुरंत समाधान, टॉपिक-स्तरीय विश्लेषण, लाइव ऑल-इंडिया रैंकिंग और दैनिक करेंट अफेयर्स।',
                })}
              </p>
              <div className="grid g3" style={{ gap: 12, margin: '20px 0' }}>
                {[
                  ['📝', '19 exams', 'SSC, Banking, Railways, UPSC, State PSC, Teaching, Defence'],
                  ['📊', 'Deep analytics', 'Topic accuracy, time per question, strength heatmaps'],
                  ['🏆', 'Live ranks', 'All-India leaderboards that update in real time'],
                ].map(([i, t, d]) => (
                  <div key={t} className="card" style={{ padding: 15, background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: 22 }}>{i}</div>
                    <div className="small bold" style={{ marginTop: 6 }}>{t}</div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>{d}</div>
                  </div>
                ))}
              </div>
              <div className="row wrap" style={{ gap: 10 }}>
                <Pill tone="success">✓ No credit card needed</Pill>
                <Pill tone="brand">✓ Bilingual</Pill>
                <Pill>✓ Installable app</Pill>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 style={{ fontSize: 24, marginBottom: 6 }}>
                {L({ en: 'Tell us about you', hi: 'अपने बारे में बताएँ' })}
              </h1>
              <p className="small muted" style={{ marginTop: 0 }}>
                {L({ en: 'This personalises your dashboard, tests and study plan.', hi: 'इससे आपका डैशबोर्ड, टेस्ट और स्टडी प्लान बेहतर होता है।' })}
              </p>
              <div className="field">
                <label>{L({ en: 'Full name', hi: 'पूरा नाम' })}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={L({ en: 'e.g. Rahul Sharma', hi: 'जैसे राहुल शर्मा' })} />
              </div>
              <div className="field">
                <label>{L({ en: 'Mobile number (optional)', hi: 'मोबाइल नंबर (वैकल्पिक)' })}</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="field">
                <label>{L({ en: 'Target exam', hi: 'लक्ष्य परीक्षा' })}</label>
                <select className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <optgroup key={c.id} label={`${c.icon} ${c.name}`}>
                      {EXAMS.filter((e) => e.category === c.id).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} — {e.subtitle}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 style={{ fontSize: 24, marginBottom: 6 }}>
                {L({ en: 'Set your daily target', hi: 'अपना दैनिक लक्ष्य तय करें' })}
              </h1>
              <p className="small muted" style={{ marginTop: 0 }}>
                {L({
                  en: 'Small and consistent beats long and rare. Pick a number you can hit every single day.',
                  hi: 'थोड़ा और नियमित बेहतर है — बहुत और कभी-कभी नहीं। ऐसी संख्या चुनें जो आप रोज़ पूरी कर सकें।',
                })}
              </p>
              <div className="row wrap" style={{ gap: 10, margin: '18px 0' }}>
                {[10, 20, 25, 40, 60, 100].map((n) => (
                  <button
                    key={n}
                    className={`chip ${goal === n ? 'on' : ''}`}
                    style={{ padding: '12px 18px', fontSize: 14 }}
                    onClick={() => setGoal(n)}
                  >
                    {n} {L({ en: 'questions', hi: 'प्रश्न' })}
                  </button>
                ))}
              </div>
              <div className="card" style={{ padding: 16, background: 'var(--surface-2)' }}>
                <div className="small bold">
                  {L({ en: 'Your plan', hi: 'आपका प्लान' })}
                </div>
                <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                  {L({ en: 'Every day:', hi: 'हर दिन:' })} <b>{goal} questions</b> · {L({ en: 'Daily current affairs capsule + quiz', hi: 'दैनिक करेंट अफेयर्स कैप्सूल + क्विज़' })} ·{' '}
                  {L({ en: 'Weekly full-length mock', hi: 'साप्ताहिक फुल मॉक' })}
                  <br />
                  {L({ en: 'Expected syllabus coverage:', hi: 'अपेक्षित पाठ्यक्रम कवरेज:' })}{' '}
                  <b>~{goal * 45} {L({ en: 'days', hi: 'दिन' })}</b>
                </div>
              </div>
            </div>
          )}

          <div className="sep" />
          <div className="row" style={{ gap: 10 }}>
            {step > 0 && (
              <Button onClick={() => setStep((s) => s - 1)}>← {L({ en: 'Back', hi: 'पीछे' })}</Button>
            )}
            <div className="spacer" />
            {step < 2 ? (
              <Button variant="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                {L({ en: 'Continue', hi: 'आगे बढ़ें' })} →
              </Button>
            ) : (
              <Button variant="primary" onClick={finish}>
                {L({ en: 'Start preparing', hi: 'तैयारी शुरू करें' })} 🚀
              </Button>
            )}
          </div>
        </Card>

        <p className="center tiny muted" style={{ marginTop: 16 }}>
          {L({
            en: 'Your data stays on this device. You can clear it any time from Settings.',
            hi: 'आपका डेटा इसी डिवाइस पर रहता है। आप इसे कभी भी सेटिंग्स से हटा सकते हैं।',
          })}
        </p>
      </div>
    </div>
  )
}
