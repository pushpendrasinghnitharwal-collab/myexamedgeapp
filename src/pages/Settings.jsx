import React from 'react'
import { useStore } from '../lib/store'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, Segmented, useToast, Modal } from '../components/ui'

export default function Settings() {
  const { state, updateSettings, setGoal, reset } = useStore()
  const L = useL()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Settings', hi: 'सेटिंग्स' })}</div>
          <div className="page-sub">
            {L({
              en: 'Everything is stored locally on your device — your data stays yours.',
              hi: 'सब कुछ आपके डिवाइस पर स locally सेव है — आपका डेटा आपका ही रहता है।',
            })}
          </div>
        </div>
      </div>

      <div className="grid g2">
        <Card>
          <CardHead icon="🌐" title={L({ en: 'Language', hi: 'भाषा' })} sub={L({ en: 'Choose the language for the app and content', hi: 'ऐप और सामग्री की भाषा चुनें' })} />
          <Segmented
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिंदी' },
            ]}
            value={state.settings.lang}
            onChange={(v) => updateSettings({ lang: v })}
          />
          <div className="sep" />
          <div className="tiny muted">
            {L({
              en: 'Question papers, solutions, notes and the magazine all have both versions.',
              hi: 'प्रश्नपत्र, समाधान, नोट्स और पत्रिका — दोनों भाषाओं में उपलब्ध।',
            })}
          </div>
        </Card>

        <Card>
          <CardHead icon="🎨" title={L({ en: 'Appearance', hi: 'रूप-रंग' })} sub={L({ en: 'Dark mode is easier on the eyes at night', hi: 'रात में डार्क मोड आँखों के लिए बेहतर है' })} />
          <Segmented
            options={[
              { value: 'dark', label: '🌙 Dark' },
              { value: 'light', label: '☀️ Light' },
            ]}
            value={state.settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
          />
          <div className="sep" />
          <div className="spread">
            <div>
              <div className="small bold">{L({ en: 'Sound effects', hi: 'ध्वनि प्रभाव' })}</div>
              <div className="tiny muted">{L({ en: 'Tick sound while answering', hi: 'उत्तर देते समय टिक ध्वनि' })}</div>
            </div>
            <Segmented
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              value={state.settings.sound ? 'on' : 'off'}
              onChange={(v) => updateSettings({ sound: v === 'on' })}
            />
          </div>
        </Card>

        <Card>
          <CardHead icon="🎯" title={L({ en: 'Daily goal', hi: 'दैनिक लक्ष्य' })} sub={L({ en: 'Questions to attempt every day', hi: 'हर दिन प्रयास करने योग्य प्रश्न' })} />
          <div className="row wrap" style={{ gap: 8 }}>
            {[10, 20, 25, 40, 60, 100].map((n) => (
              <button key={n} className={`chip ${state.dailyGoal === n ? 'on' : ''}`} onClick={() => setGoal(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="sep" />
          <div className="tiny muted">
            {L({
              en: 'At your current pace you will finish your target exam syllabus in about',
              hi: 'आपकी मौजूदा गति से आप अपनी लक्ष्य परीक्षा का पाठ्यक्रम लगभग इसमें पूरा करेंगे',
            })}{' '}
            <span className="bold">{state.dailyGoal * 45} {L({ en: 'days', hi: 'दिन' })}</span>
          </div>
        </Card>

        <Card>
          <CardHead icon="📲" title={L({ en: 'App installation', hi: 'ऐप इंस्टॉल' })} sub={L({ en: 'EXAMEDGE runs as a Progressive Web App', hi: 'EXAMEDGE एक प्रोग्रेसिव वेब ऐप के रूप में चलता है' })} />
          <div className="stack sm">
            <div className="kv">
              <span className="k">{L({ en: 'Status', hi: 'स्थिति' })}</span>
              <span className="bold">{L({ en: 'Ready to install', hi: 'इंस्टॉल के लिए तैयार' })}</span>
            </div>
            <div className="kv">
              <span className="k">{L({ en: 'Works offline', hi: 'ऑफ़लाइन काम करता है' })}</span>
              <span className="bold">✓</span>
            </div>
            <div className="kv">
              <span className="k">{L({ en: 'Size', hi: 'आकार' })}</span>
              <span className="bold">&lt; 3 MB</span>
            </div>
          </div>
          <Button
            className="block"
            style={{ marginTop: 12 }}
            onClick={() => {
              const evt = new Event('beforeinstallprompt')
              window.dispatchEvent(evt)
              toast(L({ en: 'Use your browser menu → "Add to Home screen"', hi: 'अपने ब्राउज़र मेन्यू → "होम स्क्रीन में जोड़ें" चुनें' }), '📲')
            }}
          >
            📲 {L({ en: 'Install EXAMEDGE', hi: 'EXAMEDGE इंस्टॉल करें' })}
          </Button>
        </Card>

        <Card>
          <CardHead icon="🔒" title={L({ en: 'Privacy & data', hi: 'गोपनीयता एवं डेटा' })} />
          <div className="stack sm">
            <div className="kv"><span className="k">{L({ en: 'Attempts stored', hi: 'सहेजे गए प्रयास' })}</span><span className="bold">{state.attempts.length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Saved questions', hi: 'सहेजे गए प्रश्न' })}</span><span className="bold">{state.bookmarks.length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Notes', hi: 'नोट्स' })}</span><span className="bold">{Object.keys(state.notes).length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Server sync', hi: 'सर्वर सिंक' })}</span><span className="bold">{L({ en: 'Not enabled', hi: 'सक्षम नहीं' })}</span></div>
          </div>
          <div className="sep" />
          <Button variant="danger" className="block" onClick={() => setConfirmReset(true)}>
            🗑 {L({ en: 'Reset all data', hi: 'सारा डेटा रीसेट करें' })}
          </Button>
        </Card>

        <Card>
          <CardHead icon="ℹ️" title={L({ en: 'About EXAMEDGE', hi: 'EXAMEDGE के बारे में' })} />
          <div className="stack sm">
            <div className="kv"><span className="k">{L({ en: 'Version', hi: 'संस्करण' })}</span><span className="bold">1.0.0</span></div>
            <div className="kv"><span className="k">{L({ en: 'Exams covered', hi: 'शामिल परीक्षाएँ' })}</span><span className="bold">19</span></div>
            <div className="kv"><span className="k">{L({ en: 'Question bank', hi: 'प्रश्न बैंक' })}</span><span className="bold">60+ curated</span></div>
            <div className="kv"><span className="k">{L({ en: 'Languages', hi: 'भाषाएँ' })}</span><span className="bold">English · हिंदी</span></div>
          </div>
          <div className="sep" />
          <div className="row wrap" style={{ gap: 8 }}>
            <Pill tone="brand">v1.0.0</Pill>
            <Pill tone="success">PWA</Pill>
            <Pill>Offline-ready</Pill>
          </div>
        </Card>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title={L({ en: 'Reset all data?', hi: 'सारा डेटा रीसेट करें?' })}>
        <p className="small muted" style={{ marginTop: 0 }}>
          {L({
            en: 'This deletes every attempt, bookmark and note stored on this device. It cannot be undone.',
            hi: 'इससे इस डिवाइस पर सहेजा गया हर प्रयास, बुकमार्क और नोट मिट जाएगा। यह वापस नहीं होगा।',
          })}
        </p>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Button className="block" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="block"
            onClick={() => {
              reset()
              setConfirmReset(false)
              toast('All local data cleared', '🗑')
            }}
          >
            Reset
          </Button>
        </div>
      </Modal>
    </div>
  )
}
