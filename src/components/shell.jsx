import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, BarChart3, BookMarked, BookOpen, Bookmark, ChevronRight, CircleHelp,
  ClipboardList, FileClock, Flame, GraduationCap, Languages, LayoutGrid, LayoutDashboard,
  LibraryBig, Moon, Search, Settings2, Sparkles, Sun, UserRound,
} from 'lucide-react'
import { useStore, useCurrentStreak } from '../lib/store'
import { navigate } from '../lib/router'
import { examById } from '../data/exams'
import { useL } from '../lib/i18n'

export function Brand({ compact = false }) {
  return (
    <button className="ee-brand" onClick={() => navigate('/')} aria-label={compact ? 'ExamEdge home' : undefined}>
      <span className="ee-brand-mark" aria-hidden="true">
        <img src="/icon.svg?v=2" alt="" />
      </span>
      {!compact && <span className="ee-brand-copy"><strong>Exam<span>Edge</span></strong><small>YOUR AMBITION, FORWARD</small></span>}
    </button>
  )
}

const groups = [
  { label: { en: 'WORKSPACE', hi: 'वर्कस्पेस' }, items: [
    { id: 'home', icon: LayoutDashboard, en: 'Dashboard', hi: 'डैशबोर्ड', path: '/' },
    { id: 'exams', icon: LayoutGrid, en: 'Explore exams', hi: 'परीक्षाएँ देखें', path: '/exams' },
    { id: 'exam', icon: ClipboardList, en: 'My target', hi: 'मेरा लक्ष्य', path: 'target' },
    { id: 'pyq', icon: FileClock, en: 'Previous year papers', hi: 'पिछले वर्ष के पेपर', path: '/pyq' },
  ] },
  { label: { en: 'LEARNING', hi: 'अध्ययन' }, items: [
    { id: 'current-affairs', icon: BookOpen, en: 'Current affairs', hi: 'करेंट अफेयर्स', path: '/current-affairs' },
    { id: 'materials', icon: LibraryBig, en: 'Study material', hi: 'अध्ययन सामग्री', path: '/materials' },
    { id: 'bookmarks', icon: Bookmark, en: 'Saved questions', hi: 'सहेजे प्रश्न', path: '/bookmarks' },
  ] },
  { label: { en: 'YOUR PROGRESS', hi: 'आपकी प्रगति' }, items: [
    { id: 'analytics', icon: BarChart3, en: 'My analytics', hi: 'मेरे आँकड़े', path: '/analytics' },
    { id: 'profile', icon: UserRound, en: 'My profile', hi: 'मेरी प्रोफ़ाइल', path: '/profile' },
    { id: 'settings', icon: Settings2, en: 'Settings', hi: 'सेटिंग्स', path: '/settings' },
  ] },
]

export function Sidebar({ route }) {
  const { state } = useStore()
  const L = useL()
  const active = route.path.split('?')[0].split('/').filter(Boolean)[0] || 'home'
  const target = examById(state.profile?.examId) || examById('ssc-cgl')

  return (
    <aside className="sidebar ee-sidebar" aria-label="Main navigation">
      <Brand />
      <div className="ee-nav-scroll">
        {groups.map((group) => (
          <div className="ee-nav-group" key={group.label.en}>
            <div className="ee-nav-label">{L(group.label)}</div>
            {group.items.map((item) => {
              const Icon = item.icon
              const selected = active === item.id || (item.id === 'materials' && active === 'material')
              return (
                <button
                  key={item.id}
                  className={`ee-nav-item ${selected ? 'active' : ''}`}
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => navigate(item.path === 'target' ? `/exam/${target.id}` : item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{L(item)}</span>
                  {item.id === 'bookmarks' && state.bookmarks.length > 0 && <span className="ee-nav-count">{state.bookmarks.length}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="ee-sidebar-target">
        <div className="ee-target-icon"><GraduationCap size={18} /></div>
        <div className="ee-target-copy">
          <span>{L({ en: 'YOUR TARGET', hi: 'आपका लक्ष्य' })}</span>
          <strong>{target.name}</strong>
        </div>
        <button aria-label="Change target exam" onClick={() => navigate('/profile')}><ChevronRight size={17} /></button>
      </div>
      <div className="ee-sidebar-foot"><Sparkles size={13} /> {L({ en: 'Made for your ambition', hi: 'आपके सपनों के लिए' })}</div>
    </aside>
  )
}

export function TopBar({ route }) {
  const { state, updateSettings } = useStore()
  const L = useL()
  const [search, setSearch] = useState('')
  const searchRef = useRef(null)
  const lang = state.settings.lang
  const streak = useCurrentStreak()
  const key = route.path.split('?')[0].split('/').filter(Boolean)[0] || 'home'
  const titles = {
    home: ['Dashboard', 'डैशबोर्ड'], exams: ['Explore exams', 'परीक्षाएँ देखें'], exam: ['Exam details', 'परीक्षा विवरण'],
    pyq: ['Previous year papers', 'पिछले वर्ष के पेपर'], result: ['Your result', 'आपका परिणाम'],
    analytics: ['My analytics', 'मेरे आँकड़े'], leaderboard: ['Leaderboard', 'लीडरबोर्ड'],
    'current-affairs': ['Current affairs', 'करेंट अफेयर्स'], materials: ['Study material', 'अध्ययन सामग्री'],
    material: ['Study material', 'अध्ययन सामग्री'], challenges: ['Challenges', 'चुनौतियाँ'],
    bookmarks: ['Saved questions', 'सहेजे प्रश्न'], pricing: ['Premium', 'प्रीमियम'],
    profile: ['My profile', 'मेरी प्रोफ़ाइल'], settings: ['Settings', 'सेटिंग्स'],
  }
  const title = titles[key] || ['Dashboard', 'डैशबोर्ड']

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme)
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
  }, [state.settings.theme, lang])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submitSearch(event) {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/exams?q=${encodeURIComponent(query)}` : '/exams')
    searchRef.current?.blur()
  }

  return (
    <header className="ee-topbar">
      <div className="ee-mobile-brand"><Brand compact /></div>
      <div className="ee-breadcrumb"><span>{L({ en: 'Workspace', hi: 'वर्कस्पेस' })}</span><ChevronRight size={14} /><strong>{lang === 'hi' ? title[1] : title[0]}</strong></div>
      <div className="ee-topbar-spacer" />
      <button className="ee-streak" onClick={() => navigate('/analytics')} aria-label={L({ en: `${streak} ${streak === 1 ? 'day' : 'days'} streak. View progress`, hi: `${streak} दिन स्ट्रीक। प्रगति देखें` })}>
        <Flame size={16} /><span>{L({ en: `${streak} ${streak === 1 ? 'day' : 'days'}`, hi: `${streak} दिन` })}</span>{' '}<small>{L({ en: 'streak', hi: 'स्ट्रीक' })}</small>
      </button>
      <form className="ee-search" role="search" onSubmit={submitSearch}>
        <Search size={17} />
        <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L({ en: 'Search for your exam...', hi: 'अपनी परीक्षा खोजें...' })} aria-label="Search exams" />
        <kbd>⌘ K</kbd>
      </form>
      <button className="ee-top-icon ee-mobile-search" aria-label="Search exams" onClick={() => navigate('/exams')}><Search size={19} /></button>
      <button className="ee-language" onClick={() => updateSettings({ lang: lang === 'en' ? 'hi' : 'en' })} title={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'} aria-label={lang === 'en' ? 'EN: Switch to Hindi' : 'हिं: Switch to English'}>
        <Languages size={17} /><span>{lang === 'en' ? 'EN' : 'हिं'}</span>
      </button>
      <button className="ee-top-icon" title="Toggle theme" aria-label="Toggle theme" onClick={() => updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })}>
        {state.settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="ee-top-divider" />
      <button className="ee-user" onClick={() => navigate('/profile')} title={L({ en: 'My profile', hi: 'मेरी प्रोफ़ाइल' })}>
        <span className="ee-avatar" aria-hidden="true">{(state.profile?.name || 'A')[0].toUpperCase()}</span>
        <span className="ee-user-name"><strong>{state.profile?.name || 'Aspirant'}</strong><small>{L({ en: 'My profile', hi: 'मेरी प्रोफ़ाइल' })}</small></span>
        <ChevronRight size={15} className="ee-user-chevron" />
      </button>
    </header>
  )
}

export function BottomNav({ route }) {
  const active = route.path.split('?')[0].split('/').filter(Boolean)[0] || 'home'
  const L = useL()
  const items = [
    { id: 'home', icon: LayoutDashboard, label: { en: 'Home', hi: 'होम' }, path: '/' },
    { id: 'exams', icon: LayoutGrid, label: { en: 'Exams', hi: 'परीक्षाएँ' }, path: '/exams' },
    { id: 'pyq', icon: FileClock, label: { en: 'PYQs', hi: 'PYQs' }, path: '/pyq' },
    { id: 'analytics', icon: BarChart3, label: { en: 'Progress', hi: 'प्रगति' }, path: '/analytics' },
    { id: 'profile', icon: UserRound, label: { en: 'Profile', hi: 'प्रोफ़ाइल' }, path: '/profile' },
  ]
  return (
    <nav className="bottom-nav ee-bottom-nav" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon
        const selected = active === item.id || (item.id === 'exams' && active === 'exam')
        return <button key={item.id} className={`ee-bottom-item ${selected ? 'active' : ''}`} onClick={() => navigate(item.path)} aria-current={selected ? 'page' : undefined}><Icon size={20} strokeWidth={1.8} /><span>{L(item.label)}</span></button>
      })}
    </nav>
  )
}
