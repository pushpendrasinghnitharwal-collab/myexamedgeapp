import React, { useEffect } from 'react'
import { useRoute } from './lib/router'
import { useStore } from './lib/store'
import { useGoogleAuth } from './lib/googleAuth'
import { canRestoreGoogle, shouldShowWelcome } from './lib/welcome'
import { Sidebar, TopBar, BottomNav } from './components/shell'
import { ToastProvider } from './components/ui'
import AppUpdateNotice from './components/AppUpdateNotice'

import Onboarding from './pages/Onboarding'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import Exams from './pages/Exams'
import PYQLibrary from './pages/PYQLibrary'
import ExamDetail from './pages/ExamDetail'
import TestRunner from './pages/TestRunner'
import Results from './pages/Results'
import Analytics from './pages/Analytics'
import Leaderboard from './pages/Leaderboard'
import CurrentAffairs from './pages/CurrentAffairs'
import Materials from './pages/Materials'
import MaterialReader from './pages/MaterialReader'
import Challenges from './pages/Challenges'
import Profile from './pages/Profile'
import Bookmarks from './pages/Bookmarks'
import Pricing from './pages/Pricing'
import Settings from './pages/Settings'

function Router({ route }) {
  const { state, completeWelcome } = useStore()
  const google = useGoogleAuth()
  const [path, query] = route.path.split('?')
  const parts = path.split('/').filter(Boolean)
  const key = parts[0] || 'home'
  const params = new URLSearchParams(query || '')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme)
    document.documentElement.lang = state.settings.lang === 'hi' ? 'hi' : 'en'
  }, [state.settings.theme, state.settings.lang])

  // A restored Google session need not see the first-visit screen again.
  useEffect(() => {
    if (canRestoreGoogle(state, google.user, google.signingOut)) completeWelcome(google.user)
  }, [state.welcomeComplete, state.requiresExplicitSignIn, google.user, google.signingOut, completeWelcome])

  // Existing saved profiles bypass this screen. If Google is not configured,
  // the current local experience remains available without interruption.
  if (shouldShowWelcome(google.configured, state.welcomeComplete)) return <Welcome />

  if (key === 'onboarding') return <Onboarding />

  // Full-bleed test runner (has its own sticky bar)
  if (key === 'test') {
    return (
      <div className="app">
        <main className="main">
          <TestRunner examId={parts[1]} testId={parts[2]} mode={params.get('mode') || 'mock'} />
        </main>
      </div>
    )
  }

  let page = null
  switch (key) {
    case 'home':
      page = <Home />
      break
    case 'exams':
      page = <Exams key={route.path} initialCategory={params.get('c') || 'all'} initialQuery={params.get('q') || ''} initialAvailability={params.get('availability') || 'all'} />
      break
    case 'exam':
      page = <ExamDetail examId={parts[1]} initialTab={params.get('tab') || 'overview'} />
      break
    case 'pyq':
      page = <PYQLibrary selectedExam={params.get('exam')} />
      break
    case 'result':
      page = <Results attemptId={parts[1]} />
      break
    case 'analytics':
      page = <Analytics />
      break
    case 'leaderboard':
      page = <Leaderboard />
      break
    case 'current-affairs':
      page = <CurrentAffairs />
      break
    case 'materials':
      page = <Materials />
      break
    case 'material':
      page = <MaterialReader materialId={parts[1]} />
      break
    case 'challenges':
      page = <Challenges />
      break
    case 'profile':
      page = <Profile />
      break
    case 'bookmarks':
      page = <Bookmarks />
      break
    case 'pricing':
      page = <Pricing />
      break
    case 'settings':
      page = <Settings />
      break
    default:
      page = <Home />
  }

  return (
    <div className="app">
      <Sidebar route={route} streak={state.streak.count} />
      <div className="main">
        <TopBar route={route} streak={state.streak.count} xp={state.xp} />
        <main className="content">{page}</main>
      </div>
      <BottomNav route={route} />
    </div>
  )
}

export default function App() {
  const route = useRoute()
  return (
    <ToastProvider>
      <Router route={route} />
      <AppUpdateNotice route={route.path} />
    </ToastProvider>
  )
}
