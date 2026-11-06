import React from 'react'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'

export function Brand({ compact }) {
  return (
    <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
      <div className="brand-mark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 7L12 3L20 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5V21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
          <path d="M8 10H16M8 14H16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
          <path d="M14 18L17 15L20 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <div>
          <div className="brand-name">EXAMEDGE</div>
          <div className="brand-tag">Ace your next exam</div>
        </div>
      )}
    </div>
  )
}

const NAV = [
  { group: 'Learn', items: [
    { id: 'home', icon: '🏠', label: 'Home', path: '/' },
    { id: 'exams', icon: '📚', label: 'Exams', path: '/exams' },
    { id: 'affairs', icon: '📰', label: 'Current Affairs', path: '/current-affairs' },
    { id: 'materials', icon: '📄', label: 'Study Material', path: '/materials' },
  ]},
  { group: 'Perform', items: [
    { id: 'analytics', icon: '📊', label: 'Analytics', path: '/analytics' },
    { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', path: '/leaderboard' },
    { id: 'challenges', icon: '⚔️', label: 'Challenges', path: '/challenges' },
    { id: 'bookmarks', icon: '🔖', label: 'Saved', path: '/bookmarks' },
  ]},
  { group: 'Account', items: [
    { id: 'pricing', icon: '💎', label: 'Premium', path: '/pricing' },
    { id: 'profile', icon: '👤', label: 'Profile', path: '/profile' },
  ]},
]

export function Sidebar({ route, streak }) {
  const { state } = useStore()
  const active = route.parts[0] || 'home'
  return (
    <aside className="sidebar">
      <Brand />
      {NAV.map((g) => (
        <div className="nav-group" key={g.group}>
          <div className="nav-label">{g.group}</div>
          {g.items.map((it) => (
            <div
              key={it.id}
              className={`nav-item ${active === it.id || (it.id === 'exams' && active === 'exam') ? 'active' : ''}`}
              onClick={() => navigate(it.path)}
            >
              <span className="ico">{it.icon}</span>
              <span>{it.label}</span>
              {it.id === 'bookmarks' && state.bookmarks.length > 0 && (
                <span className="nav-badge">{state.bookmarks.length}</span>
              )}
            </div>
          ))}
        </div>
      ))}
      <div className="spacer" />
      <div className="card" style={{ padding: 14, background: 'var(--grad-soft)' }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <div>
            <div className="bold" style={{ fontSize: 15 }}>
              {streak} day streak
            </div>
            <div className="tiny muted">Keep it alive — 5 more days to a badge</div>
          </div>
        </div>
        <div className="bar thin" style={{ marginTop: 10 }}>
          <i style={{ width: `${Math.min(100, (streak / 30) * 100)}%` }} />
        </div>
      </div>
    </aside>
  )
}

export function TopBar({ route, streak, xp }) {
  const { state, updateSettings } = useStore()
  const lang = state.settings.lang
  const [menu, setMenu] = React.useState(false)

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme)
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
  }, [state.settings.theme, lang])

  const titles = {
    home: 'Dashboard', exams: 'All Exams', exam: 'Exam', test: 'Test', result: 'Results',
    analytics: 'Analytics', leaderboard: 'Leaderboard', 'current-affairs': 'Current Affairs',
    materials: 'Study Material', material: 'Reader', challenges: 'Challenges', bookmarks: 'Saved Questions',
    pricing: 'Premium Plans', profile: 'Profile', settings: 'Settings',
  }
  const key = route.parts[0] || 'home'

  return (
    <header
      className="runner-bar"
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 26px' }}
    >
      <div className="mobile-brand" style={{ display: 'none' }}>
        <Brand compact />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="bold" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
          {titles[key] || 'EXAMEDGE'}
        </div>
        <div className="tiny muted nowrap">
          {streak}🔥 · {xp} XP · {state.coins} 🪙
        </div>
      </div>
      <div className="spacer" />
      <div className="row" style={{ gap: 8 }}>
        <button
          className="icon-btn"
          title={lang === 'en' ? 'हिंदी में पढ़ें' : 'Read in English'}
          onClick={() => updateSettings({ lang: lang === 'en' ? 'hi' : 'en' })}
          style={{ fontSize: 12, fontWeight: 800 }}
        >
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>
        <button
          className="icon-btn"
          title="Toggle theme"
          onClick={() => updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          {state.settings.theme === 'dark' ? '🌙' : '☀️'}
        </button>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} style={{ position: 'relative' }}>
          <span
            className="avatar"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--grad)',
              fontSize: 12,
            }}
          >
            {(state.profile?.name || 'E')[0].toUpperCase()}
          </span>
        </button>
      </div>
      {menu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setMenu(false)}
          />
          <div
            className="card"
            style={{
              position: 'absolute',
              right: 26,
              top: 58,
              width: 220,
              zIndex: 50,
              padding: 12,
            }}
          >
            <div className="bold small" style={{ padding: '6px 8px' }}>
              {state.profile?.name || 'Guest Learner'}
            </div>
            <div className="tiny muted" style={{ padding: '0 8px 8px' }}>
              {state.profile?.examId ? state.profile.examId.toUpperCase() : 'No target exam'}
            </div>
            <div className="sep" style={{ margin: '6px 0' }} />
            {[
              ['👤', 'Profile', '/profile'],
              ['🔖', 'Saved questions', '/bookmarks'],
              ['💎', 'Upgrade to Premium', '/pricing'],
              ['⚙️', 'Settings', '/settings'],
            ].map(([i, l, p]) => (
              <div
                key={p}
                className="nav-item"
                onClick={() => {
                  setMenu(false)
                  navigate(p)
                }}
              >
                <span className="ico">{i}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </header>
  )
}

export function BottomNav({ route }) {
  const active = route.parts[0] || 'home'
  const items = [
    { id: 'home', icon: '🏠', label: 'Home', path: '/' },
    { id: 'exams', icon: '📚', label: 'Exams', path: '/exams' },
    { id: 'analytics', icon: '📊', label: 'Stats', path: '/analytics' },
    { id: 'leaderboard', icon: '🏆', label: 'Ranks', path: '/leaderboard' },
    { id: 'profile', icon: '👤', label: 'Profile', path: '/profile' },
  ]
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <div
          key={it.id}
          className={`bn-item ${active === it.id ? 'active' : ''}`}
          onClick={() => navigate(it.path)}
        >
          <span className="ico">{it.icon}</span>
          <span>{it.label}</span>
        </div>
      ))}
    </nav>
  )
}
