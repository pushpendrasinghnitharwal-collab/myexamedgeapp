import React from 'react'
import { ArrowRight, BookOpen, ChartNoAxesCombined, Languages, Sparkles } from 'lucide-react'
import { GoogleSignInButton } from '../components/GoogleSignIn'
import { useStore } from '../lib/store'
import { useGoogleAuth } from '../lib/googleAuth'
import { useL } from '../lib/i18n'

export default function Welcome() {
  const { state, updateSettings, completeWelcome } = useStore()
  const { continueAsGuest } = useGoogleAuth()
  const L = useL()
  const hindi = state.settings.lang === 'hi'

  return (
    <main className="welcome-screen">
      <header className="welcome-header">
        <div className="welcome-brand">
          <img src="/icon.svg?v=2" width="46" height="46" alt="" />
          <div><strong>EXAM<span>EDGE</span></strong><small>{L({ en: 'YOUR LEARNING SPACE', hi: 'आपकी अध्ययन की जगह' })}</small></div>
        </div>
        <button type="button" className="welcome-language" onClick={() => updateSettings({ lang: hindi ? 'en' : 'hi' })} aria-label={hindi ? 'Switch to English' : 'हिंदी में बदलें'}>
          <Languages size={17} aria-hidden="true" /> <span lang={hindi ? 'en' : 'hi'}>{hindi ? 'English' : 'हिंदी'}</span>
        </button>
      </header>

      <div className="welcome-layout">
        <section className="welcome-story" aria-labelledby="welcome-story-title">
          <div className="welcome-kicker"><Sparkles size={14} aria-hidden="true" /> {L({ en: 'A FRESH START, JUST FOR YOU', hi: 'आपकी तैयारी की नई शुरुआत' })}</div>
          <h1 id="welcome-story-title">{L({ en: 'Big dreams start', hi: 'बड़े सपनों की शुरुआत' })}<br /><span>{L({ en: 'with small steps.', hi: 'छोटे कदमों से।' })}</span></h1>
          <p>{L({ en: 'A thoughtful space to practise, build your routine and see how far you have come.', hi: 'अभ्यास करें, अपनी दिनचर्या बनाएँ और अपनी प्रगति देखें।' })}</p>
          <div className="welcome-art" role="presentation" />
          <div className="welcome-features">
            <div><span><BookOpen size={18} aria-hidden="true" /></span><p><strong>{L({ en: 'Practise your way', hi: 'अपने तरीके से अभ्यास' })}</strong><small>{L({ en: 'Explore available practice sets', hi: 'उपलब्ध अभ्यास सेट खोजें' })}</small></p></div>
            <div><span><ChartNoAxesCombined size={18} aria-hidden="true" /></span><p><strong>{L({ en: 'See your progress', hi: 'अपनी प्रगति देखें' })}</strong><small>{L({ en: 'Every little step counts', hi: 'हर छोटा कदम मायने रखता है' })}</small></p></div>
          </div>
        </section>

        <section className="welcome-card" aria-labelledby="welcome-card-title">
          <div className="welcome-card-icon"><Sparkles size={20} aria-hidden="true" /></div>
          <div className="welcome-card-kicker">{L({ en: 'WELCOME TO EXAMEDGE', hi: 'EXAMEDGE में आपका स्वागत है' })}</div>
          <h2 id="welcome-card-title">{L({ en: 'Let’s get started.', hi: 'चलिए शुरुआत करें।' })}</h2>
          <p className="welcome-card-intro">{L({ en: 'Sign in with your Google account, or explore as a guest.', hi: 'Google खाते से साइन इन करें या अतिथि के रूप में ऐप देखें।' })}</p>
          <GoogleSignInButton onSuccess={completeWelcome} />
          <div className="welcome-divider"><span>{L({ en: 'OR', hi: 'या' })}</span></div>
          <button type="button" className="welcome-guest" onClick={() => { continueAsGuest(); completeWelcome() }}>
            {L({ en: 'Continue as guest', hi: 'अतिथि के रूप में आगे बढ़ें' })} <ArrowRight size={17} aria-hidden="true" />
          </button>
          <div className="welcome-privacy">
            <strong>{L({ en: 'Your progress stays on this device.', hi: 'आपकी प्रगति इसी डिवाइस पर रहती है।' })}</strong>
            <span>{L({ en: 'Google sign-in does not sync your practice to other devices. Google shares your name and email for sign-in.', hi: 'Google साइन इन से अभ्यास दूसरे डिवाइस पर सिंक नहीं होता। साइन इन के लिए Google आपका नाम और ईमेल साझा करता है।' })}</span>
          </div>
        </section>
      </div>
      <footer className="welcome-footer">EXAMEDGE <span>✦</span> {L({ en: 'MADE FOR THE JOURNEY', hi: 'आपकी तैयारी का साथी' })}</footer>
    </main>
  )
}
