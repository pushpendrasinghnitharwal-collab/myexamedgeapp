import React, { useState } from 'react'
import { Info, Languages, Moon, Palette, ShieldCheck, Smartphone, Sun, Target, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { EXAMS } from '../data/exams'
import { QUESTIONS } from '../data/questions'
import { practiceExamCount } from '../lib/examCatalog'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, Segmented, useToast, Modal } from '../components/ui'

export default function Settings() {
  const { state, updateSettings, setGoal, reset } = useStore()
  const L = useL()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="settings-page page-shell stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{L({ en: 'Settings', hi: 'सेटिंग्स' })}</h1>
          <div className="page-sub">
            {L({
              en: 'Older local history stays on this device. Practice-account sessions are stored by the connected backend; player answers, review flags and timing may also be cached locally for recovery.',
              hi: 'पुराना स्थानीय इतिहास इस डिवाइस पर रहता है। अभ्यास खाते के सत्र जुड़े बैकएंड में सहेजे जाते हैं।',
            })}
          </div>
        </div>
      </div>

      <div className="grid g2">
        <Card>
          <CardHead icon={<Languages size={20} aria-hidden="true" />} title={L({ en: 'Language', hi: 'भाषा' })} sub={L({ en: 'Choose the question and legacy-page language', hi: 'प्रश्न और पुराने पृष्ठों की भाषा चुनें' })} />
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
              en: 'Some command-center text is in English. Questions use your chosen language when a translation is available.',
              hi: 'कमांड सेंटर का कुछ पाठ अंग्रेज़ी में है। अनुवाद उपलब्ध होने पर प्रश्न चुनी हुई भाषा में दिखते हैं।',
            })}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Palette size={20} aria-hidden="true" />} title={L({ en: 'Appearance', hi: 'रूप-रंग' })} sub={L({ en: 'Choose a theme for your workspace', hi: 'अपने कार्यक्षेत्र की थीम चुनें' })} />
          <Segmented
            options={[
              { value: 'dark', label: <><Moon size={15} aria-hidden="true" /> {L({ en: 'Dark', hi: 'डार्क' })}</> },
              { value: 'light', label: <><Sun size={15} aria-hidden="true" /> {L({ en: 'Light', hi: 'लाइट' })}</> },
            ]}
            value={state.settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
          />

        </Card>

        <Card>
          <CardHead icon={<Target size={20} aria-hidden="true" />} title={L({ en: 'Daily goal', hi: 'दैनिक लक्ष्य' })} sub={L({ en: 'Questions to attempt every day', hi: 'हर दिन प्रयास करने योग्य प्रश्न' })} />
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
              en: 'You can adjust your daily goal whenever your routine changes.',
              hi: 'आप अपनी दिनचर्या के अनुसार दैनिक लक्ष्य कभी भी बदल सकते हैं।',
            })}{' '}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Smartphone size={20} aria-hidden="true" />} title={L({ en: 'App installation', hi: 'ऐप इंस्टॉल' })} sub={L({ en: 'EXAMEDGE runs as a Progressive Web App', hi: 'EXAMEDGE एक प्रोग्रेसिव वेब ऐप के रूप में चलता है' })} />
          <div className="stack sm">
            <div className="kv">
              <span className="k">{L({ en: 'Status', hi: 'स्थिति' })}</span>
              <span className="bold">{L({ en: 'Ready to install', hi: 'इंस्टॉल के लिए तैयार' })}</span>
            </div>
            <div className="kv">
              <span className="k">{L({ en: 'Offline access', hi: 'ऑफ़लाइन एक्सेस' })}</span>
              <span className="bold">{L({ en: 'Previously cached pages', hi: 'पहले कैश किए पृष्ठ' })}</span>
            </div>
          </div>
          <Button
            className="block"
            style={{ marginTop: 12 }}
            onClick={() => {
              toast(L({ en: 'Use your browser menu → "Add to Home screen"', hi: 'अपने ब्राउज़र मेन्यू → "होम स्क्रीन में जोड़ें" चुनें' }), '📲')
            }}
          >
            <Smartphone size={15} aria-hidden="true" /> {L({ en: 'Installation instructions', hi: 'इंस्टॉल करने के निर्देश' })}
          </Button>
        </Card>

        <Card>
          <CardHead icon={<ShieldCheck size={20} aria-hidden="true" />} title={L({ en: 'Privacy & data', hi: 'गोपनीयता एवं डेटा' })} />
          <div className="stack sm">
            <div className="kv"><span className="k">{L({ en: 'Attempts stored', hi: 'सहेजे गए प्रयास' })}</span><span className="bold">{state.attempts.length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Saved questions', hi: 'सहेजे गए प्रश्न' })}</span><span className="bold">{state.bookmarks.length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Notes', hi: 'नोट्स' })}</span><span className="bold">{Object.keys(state.notes).length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Backend attempts', hi: 'बैकएंड प्रयास' })}</span><span className="bold">{state.auth?.token ? L({ en: 'Stored in practice account', hi: 'अभ्यास खाते में सहेजे गए' }) : L({ en: 'Local only', hi: 'केवल इस डिवाइस पर' })}</span></div>
          </div>
          <div className="sep" />
          <Button variant="danger" className="block" onClick={() => setConfirmReset(true)}>
            <Trash2 size={15} aria-hidden="true" /> {L({ en: 'Reset device data', hi: 'डिवाइस डेटा रीसेट करें' })}
          </Button>
        </Card>

        <Card>
          <CardHead icon={<Info size={20} aria-hidden="true" />} title={L({ en: 'About EXAMEDGE', hi: 'EXAMEDGE के बारे में' })} />
          <div className="stack sm">
            <div className="kv"><span className="k">{L({ en: 'Version', hi: 'संस्करण' })}</span><span className="bold">1.0.0</span></div>
            <div className="kv"><span className="k">{L({ en: 'Exams listed', hi: 'सूचीबद्ध परीक्षाएँ' })}</span><span className="bold">{EXAMS.length}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Exams with practice', hi: 'अभ्यास वाली परीक्षाएँ' })}</span><span className="bold">{practiceExamCount}</span></div>
            <div className="kv"><span className="k">{L({ en: 'Question bank', hi: 'प्रश्न बैंक' })}</span><span className="bold">{QUESTIONS.length} {L({ en: 'available locally', hi: 'स्थानीय रूप से उपलब्ध' })}</span></div>
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

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title={L({ en: 'Reset device data?', hi: 'डिवाइस डेटा रीसेट करें?' })}>
        <p className="small muted" style={{ marginTop: 0 }}>
          {L({
            en: 'This deletes local attempts, bookmarks, notes, question timing, personal review targets, this tab’s DEST recovery and unsynced player progress on this device. It cannot be undone. Synced backend practice history and Google accounts are not deleted.',
            hi: 'इससे इस डिवाइस पर सहेजा गया हर प्रयास, बुकमार्क और नोट मिट जाएगा। यह वापस नहीं होगा। इससे Google साइन आउट नहीं होगा और Google खाता नहीं हटेगा।',
          })}
        </p>
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Button className="block" onClick={() => setConfirmReset(false)}>
            {L({ en: 'Cancel', hi: 'रद्द करें' })}
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
            {L({ en: 'Reset', hi: 'रीसेट करें' })}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
