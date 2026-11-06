import React, { useState } from 'react'
import { useStore } from '../lib/store'
import { useL } from '../lib/i18n'
import { Card, CardHead, Pill, Button, useToast, Modal } from '../components/ui'

const PLANS = [
  {
    id: 'free',
    name: { en: 'Free', hi: 'निःशुल्क' },
    price: '₹0',
    period: { en: 'forever', hi: 'हमेशा के लिए' },
    tone: '',
    features: [
      { en: '10 full-length mocks every month', hi: 'हर महीने 10 फुल मॉक' },
      { en: 'All sectional & topic drills', hi: 'सभी सेक्शनल और टॉपिक ड्रिल' },
      { en: 'Daily current affairs capsule + quiz', hi: 'दैनिक करेंट अफेयर्स कैप्सूल + क्विज़' },
      { en: 'Basic score, accuracy & rank', hi: 'बेसिक स्कोर, सटीकता और रैंक' },
      { en: 'Free study material library', hi: 'निःशुल्क अध्ययन सामग्री' },
      { en: 'Bilingual (English + Hindi)', hi: 'द्विभाषी (अंग्रेज़ी + हिंदी)' },
    ],
    cta: { en: 'Current plan', hi: 'वर्तमान योजना' },
  },
  {
    id: 'pro',
    name: { en: 'Premium', hi: 'प्रीमियम' },
    price: '₹299',
    period: { en: 'per month', hi: 'प्रति माह' },
    tone: 'gold',
    popular: true,
    features: [
      { en: 'Unlimited full-length & sectional mocks', hi: 'असीमित फुल मॉक और सेक्शनल' },
      { en: 'All-India live tests with real-time ranks', hi: 'लाइव रैंक के साथ ऑल-इंडिया लाइव टेस्ट' },
      { en: 'Deep analytics: topic, time, difficulty heatmaps', hi: 'गहरा विश्लेषण: टॉपिक, समय, कठिनाई हीटमैप' },
      { en: 'Premium notes, formula sheets & PYQ bundles', hi: 'प्रीमियम नोट्स, सूत्र पत्रक और PYQ बंडल' },
      { en: 'Monthly magazine with 30+ MCQs', hi: '30+ MCQs के साथ मासिक पत्रिका' },
      { en: 'Ad-free + priority support', hi: 'विज्ञापन-मुक्त + प्राथमिकता सहायता' },
      { en: 'Offline test downloads', hi: 'ऑफ़लाइन टेस्ट डाउनलोड' },
    ],
    cta: { en: 'Upgrade to Premium', hi: 'प्रीमियम अपग्रेड करें' },
  },
  {
    id: 'ultimate',
    name: { en: 'Ultimate', hi: 'अल्टीमेट' },
    price: '₹799',
    period: { en: 'for 3 months', hi: '3 महीने के लिए' },
    tone: 'brand',
    features: [
      { en: 'Everything in Premium', hi: 'प्रीमियम की सभी सुविधाएँ' },
      { en: 'Personal mentor feedback on 5 tests/month', hi: 'हर महीने 5 टेस्ट पर मेंटर फीडबैक' },
      { en: 'Exclusive all-India mega mock series', hi: 'विशेष ऑल-इंडिया मेगा मॉक सीरीज़' },
      { en: 'Custom study plan built for you', hi: 'आपके लिए कस्टम स्टडी प्लान' },
      { en: 'Interview & Mains answer guidance', hi: 'इंटरव्यू और मेन्स उत्तर मार्गदर्शन' },
      { en: 'Early access to new exams', hi: 'नई परीक्षाओं तक अर्ली एक्सेस' },
      { en: '30% off everything', hi: 'सब पर 30% छूट' },
    ],
    cta: { en: 'Go Ultimate', hi: 'अल्टीमेट लें' },
  },
]

const FAQ = [
  {
    q: { en: 'Is the free plan really free?', hi: 'क्या निःशुल्क योजना वाकई निःशुल्क है?' },
    a: { en: 'Yes — no card needed. You get 10 full mocks every month, every sectional and topic drill, daily current affairs and the free material library.', hi: 'हाँ — कार्ड की ज़रूरत नहीं। आपको हर महीने 10 फुल मॉक, सभी सेक्शनल और टॉपिक ड्रिल, दैनिक करेंट अफेयर्स और निःशुल्क सामग्री मिलती है।' },
  },
  {
    q: { en: 'How are the exams different from Testbook or Oliveboard?', hi: 'परीक्षाएँ टेस्टबुक या ऑलिवबोर्ड से कैसे अलग हैं?' },
    a: { en: 'EXAMEDGE is bilingual end-to-end, has an offline-capable PWA that installs on any Android phone without an app store, and gives free access to topic-level analytics — the thing premium platforms usually hide.', hi: 'EXAMEDGE पूरी तरह द्विभाषी है, एक ऑफ़लाइन-सक्षम PWA है जो किसी भी एंड्रॉइड फ़ोन पर बिना ऐप स्टोर के इंस्टॉल होता है, और टॉपिक-स्तरीय विश्लेषण मुफ़्त देता है — जो प्रीमियम प्लेटफ़ॉर्म आमतौर पर छिपाते हैं।' },
  },
  {
    q: { en: 'Do you offer refunds?', hi: 'क्या आप रिफ़ंड देते हैं?' },
    a: { en: 'Yes, 7-day no-questions-asked refund on annual plans and 30 days on the Ultimate plan.', hi: 'हाँ, वार्षिक योजना पर 7-दिन की बिना सवाल रिफ़ंड और अल्टीमेट योजना पर 30 दिन।' },
  },
  {
    q: { en: 'How accurate are the mock papers?', hi: 'मॉक पेपर कितने सटीक हैं?' },
    a: { en: 'Every paper follows the official latest pattern, marking scheme and negative marking. Previous-year papers are tagged by year and shift so you can verify.', hi: 'हर पेपर नवीनतम आधिकारिक पैटर्न, अंकन योजना और नेगेटिव मार्किंग पर आधारित है। पिछले वर्षों के पेपर वर्ष और शिफ्ट के अनुसार टैग किए गए हैं।' },
  },
]

export default function Pricing() {
  const L = useL()
  const toast = useToast()
  const { state, updateProfile } = useStore()
  const [faq, setFaq] = useState(null)
  const [checkout, setCheckout] = useState(null)
  const isPro = state.profile?.plan === 'pro'

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{L({ en: 'Upgrade your preparation', hi: 'अपनी तैयारी को अपग्रेड करें' })}</div>
          <div className="page-sub">
            {L({
              en: 'Less than a single coaching class. Cancel anytime.',
              hi: 'एक कोचिंग क्लास से भी कम। कभी भी रद्द करें।',
            })}
          </div>
        </div>
        <Pill tone="success">💚 7-day refund guarantee</Pill>
      </div>

      <div className="grid g3">
        {PLANS.map((pl) => (
          <Card
            key={pl.id}
            style={{
              borderColor: pl.popular ? 'rgba(245,158,11,0.5)' : 'var(--line)',
              boxShadow: pl.popular ? '0 20px 50px rgba(245,158,11,0.18)' : undefined,
            }}
          >
            {pl.popular && (
              <div style={{ position: 'absolute', top: 14, right: -1 }}>
                <span className="pill gold">MOST POPULAR</span>
              </div>
            )}
            <div className="bold" style={{ fontSize: 17 }}>{L(pl.name)}</div>
            <div className="row" style={{ gap: 7, alignItems: 'baseline', marginTop: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em' }}>{pl.price}</span>
              <span className="tiny muted">{L(pl.period)}</span>
            </div>
            <div className="sep" />
            <div className="stack sm">
              {pl.features.map((f, i) => (
                <div key={i} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: 13 }}>✓</span>
                  <span className="small" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{L(f)}</span>
                </div>
              ))}
            </div>
            <div className="sep" />
            <Button
              variant={pl.popular ? 'primary' : 'default'}
              className="block"
              disabled={pl.id === 'free' && isPro}
              onClick={() => (pl.id === 'free' ? toast('You are already on the best free plan') : setCheckout(pl))}
            >
              {isPro && pl.id === 'pro' ? '✓ Current plan' : L(pl.cta)}
            </Button>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title={L({ en: 'Frequently asked questions', hi: 'अक्सर पूछे जाने वाले प्रश्न' })} />
        <div className="stack sm">
          {FAQ.map((f, i) => (
            <div key={i} className="accordion" style={{ marginBottom: 0 }}>
              <div className="acc-head" onClick={() => setFaq(faq === i ? null : i)}>
                <span>{L(f.q)}</span>
                <span className="muted">{faq === i ? '−' : '+'}</span>
              </div>
              {faq === i && (
                <div className="acc-body small muted" style={{ lineHeight: 1.7 }}>
                  {L(f.a)}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title={L({ en: 'Education discount', hi: 'शिक्षा छूट' })} sub={L({ en: 'Students, teachers and job-seekers pay less', hi: 'छात्र, शिक्षक और रोज़गार चाहने वाले कम दाम पर' })} />
        <div className="row wrap" style={{ gap: 10 }}>
          <Button onClick={() => toast('Discount code EDU50 sent to your email', '🎁')}>🎁 Get EDU50 code</Button>
          <Button variant="ghost" onClick={() => toast('Referral link copied — earn 1 month per friend', '👥')}>
            👥 Refer a friend, get 1 month free
          </Button>
        </div>
      </Card>

      <Modal open={!!checkout} onClose={() => setCheckout(null)} title={L({ en: 'Confirm upgrade', hi: 'अपग्रेड की पुष्टि करें' })}>
        {checkout && (
          <>
            <div className="row" style={{ gap: 12, marginBottom: 16 }}>
              <div className="exam-icon" style={{ background: 'var(--grad)' }}>
                💎
              </div>
              <div>
                <div className="bold">{L(checkout.name)} plan</div>
                <div className="tiny muted">
                  {checkout.price} {L(checkout.period)}
                </div>
              </div>
            </div>
            <div className="stack sm" style={{ marginBottom: 16 }}>
              {[
                ['Order ID', 'EXM-' + Math.random().toString(36).slice(2, 8).toUpperCase()],
                ['Payment mode', 'UPI / Card / Netbanking'],
                ['Invoice', 'Sent to your registered email'],
              ].map(([k, v]) => (
                <div key={k} className="kv">
                  <span className="k">{k}</span>
                  <span className="bold">{v}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Button className="block" onClick={() => setCheckout(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="block"
                onClick={() => {
                  updateProfile({ plan: 'pro' })
                  setCheckout(null)
                  toast('Premium unlocked — welcome aboard!', '💎')
                }}
              >
                Pay {checkout.price}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
