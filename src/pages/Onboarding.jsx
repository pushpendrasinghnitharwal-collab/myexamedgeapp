import React, { useState } from 'react'
import { EXAMS, CATEGORIES } from '../data/exams'
import { useStore } from '../lib/store'
import { useL } from '../lib/i18n'
import { Button, Card, Pill } from '../components/ui'
import { hasPractice, practiceExamCount } from '../lib/examCatalog'
import { navigate } from '../lib/router'

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
    navigate('/')
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
              <img src="/icon.svg?v=2" width="52" height="52" alt="" style={{ borderRadius: 16 }} />
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
                  {[L({ en: 'Welcome', hi: 'स्वागत' }), L({ en: 'Your goal', hi: 'आपका लक्ष्य' }), L({ en: 'Daily plan', hi: 'दैनिक योजना' })][i]}
                </div>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div>
              <h1 style={{ fontSize: 26, marginBottom: 8 }}>
                {L({ en: 'A better place to begin', hi: 'तैयारी की बेहतर शुरुआत' })}
              </h1>
              <p className="small muted" style={{ marginTop: 0 }}>
                {L({
                  en: 'Discover exam goals, try existing practice sets and follow your own progress. Some exam pages contain information only.',
                  hi: 'परीक्षाएँ खोजें, मौजूदा अभ्यास सेट करें और अपनी प्रगति देखें। कुछ परीक्षाओं में अभी केवल जानकारी है।',
                })}
              </p>
              <div className="grid g3" style={{ gap: 12, margin: '20px 0' }}>
                {[
                  ['📝', L({ en: `${EXAMS.length} exams listed`, hi: `${EXAMS.length} परीक्षाएँ सूचीबद्ध` }), L({ en: `${practiceExamCount} currently have practice`, hi: `${practiceExamCount} में अभी अभ्यास है` })],
                  ['📊', L({ en: 'Your progress', hi: 'आपकी प्रगति' }), L({ en: 'Review your own attempts and accuracy', hi: 'अपने प्रयास और सटीकता देखें' })],
                  ['📚', L({ en: 'Study tools', hi: 'अध्ययन साधन' }), L({ en: 'Sample notes, bookmarks and practice', hi: 'नमूना नोट्स, बुकमार्क और अभ्यास' })],
                ].map(([i, t, d]) => (
                  <div key={t} className="card" style={{ padding: 15, background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: 22 }}>{i}</div>
                    <div className="small bold" style={{ marginTop: 6 }}>{t}</div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>{d}</div>
                  </div>
                ))}
              </div>
              <div className="row wrap" style={{ gap: 10 }}>
                <Pill tone="success">✓ {L({ en: 'Progress on this device', hi: 'प्रगति इस डिवाइस पर' })}</Pill>
                <Pill tone="brand">✓ English & हिंदी</Pill>
                <Pill>✓ {L({ en: 'Installable app', hi: 'इंस्टॉल होने वाला ऐप' })}</Pill>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 style={{ fontSize: 24, marginBottom: 6 }}>
                {L({ en: 'Tell us about you', hi: 'अपने बारे में बताएँ' })}
              </h1>
              <p className="small muted" style={{ marginTop: 0 }}>
                {L({ en: 'This sets your target and personalises your dashboard.', hi: 'इससे आपका लक्ष्य तय होता है और डैशबोर्ड आपके अनुसार बनता है।' })}
              </p>
              <div className="field">
                <label htmlFor="onboarding-name">{L({ en: 'Full name', hi: 'पूरा नाम' })}</label>
                <input id="onboarding-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={L({ en: 'e.g. Rahul Sharma', hi: 'जैसे राहुल शर्मा' })} />
              </div>
              <div className="field">
                <label htmlFor="onboarding-phone">{L({ en: 'Mobile number (optional)', hi: 'मोबाइल नंबर (वैकल्पिक)' })}</label>
                <input id="onboarding-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="field">
                <label htmlFor="onboarding-target">{L({ en: 'Target exam', hi: 'लक्ष्य परीक्षा' })}</label>
                <select id="onboarding-target" className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <optgroup key={c.id} label={`${c.icon} ${L({ en: c.name, hi: c.hi })}`}>
                      {EXAMS.filter((e) => e.category === c.id).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}{!hasPractice(e.id) ? ` — ${L({ en: 'info only', hi: 'केवल जानकारी' })}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="tiny muted" style={{ marginTop: 6 }}>{hasPractice(examId) ? L({ en: 'Practice is available for this goal.', hi: 'इस लक्ष्य के लिए अभ्यास उपलब्ध है।' }) : L({ en: 'Practice for this exam has not been added yet.', hi: 'इस परीक्षा के लिए अभ्यास अभी नहीं जोड़ा गया है।' })}</div>
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
                    aria-pressed={goal === n}
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
                  {L({ en: 'Aim for', hi: 'लक्ष्य रखें:' })} <b>{goal} {L({ en: 'questions a day', hi: 'प्रश्न प्रतिदिन' })}</b>. {L({ en: 'Your dashboard counts answers from submitted practice sessions. You can change this goal in Settings.', hi: 'डैशबोर्ड सबमिट किए अभ्यासों के उत्तर गिनता है। आप यह लक्ष्य सेटिंग्स में बदल सकते हैं।' })}
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
