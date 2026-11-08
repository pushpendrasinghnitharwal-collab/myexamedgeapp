import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback } from 'react'
import { EXAMS } from '../data/exams'
import { api, getToken, getApiUser, setSession } from './api'
import { completeWelcome, returnToSignIn, savedWelcomeStatus } from './welcome'
import { googleAuthConfig } from './googleAuthConfig'
import { clearQuestionTimes } from './cglTelemetry'
import { clearPlayerData } from './cglPlayerStore'
import { clearReviewTargets } from './cglReviewModel'
import { clearDestSessions } from './destStore'

const KEY = 'examedge.state.v1'

const initialState = {
  // If Google is not configured, a new visitor enters directly as before and
  // remains a returning visitor after sign-in is enabled in a later release.
  welcomeComplete: !googleAuthConfig(import.meta.env),
  requiresExplicitSignIn: false,
  profile: { name: 'Aspirant', examId: 'ssc-cgl', plan: 'free', isGuest: true },
  auth: { token: getToken(), user: getApiUser() },
  attempts: [],
  bookmarks: [],
  notes: {},
  streak: { count: 0, last: null, days: [] },
  xp: 0,
  coins: 40,
  achievements: [],
  dailyGoal: 25,
  settings: { lang: 'en', theme: 'light', sound: true, autoSubmit: true, cglStage: 'Tier_1', cglTiming: 'exam_hall_v1' },
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.payload }
    case 'register':
      return { ...state, profile: { ...action.payload, joinedAt: Date.now(), plan: 'free' }, dailyGoal: action.payload.goal || state.dailyGoal }
    case 'completeWelcome':
      return completeWelcome(state, action.payload)
    case 'session':
      return { ...state, auth: { token: getToken(), user: action.payload } }
    case 'logout':
      return { ...state, auth: { token: null, user: null } }
    case 'logoutToSignIn':
      return returnToSignIn(state)
    case 'updateProfile':
      return { ...state, profile: { ...state.profile, ...action.payload } }
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.payload } }
    case 'addAttempt': {
      const a = action.payload
      const days = state.streak.days.includes(todayKey())
        ? state.streak.days
        : [...state.streak.days, todayKey()].slice(-60)
      const yesterday = todayKey(new Date(Date.now() - 86400000))
      let count = state.streak.count
      if (state.streak.last !== todayKey() && state.streak.last !== yesterday) count = 1
      else if (state.streak.last === yesterday) count = state.streak.count + 1
      return {
        ...state,
        attempts: [a, ...state.attempts],
        streak: { count, last: todayKey(), days },
        xp: Math.max(0, state.xp + Math.round(a.score * 2 + a.correct * 3)),
        coins: state.coins + Math.round(a.correct * 0.6),
      }
    }
    case 'toggleBookmark': {
      const has = state.bookmarks.includes(action.payload)
      return {
        ...state,
        bookmarks: has ? state.bookmarks.filter((b) => b !== action.payload) : [...state.bookmarks, action.payload],
      }
    }
    case 'saveNote': {
      const { id, text } = action.payload
      const notes = { ...state.notes }
      if (text) notes[id] = text
      else delete notes[id]
      return { ...state, notes }
    }
    case 'claimAchievement':
      return state.achievements.includes(action.payload)
        ? state
        : { ...state, achievements: [...state.achievements, action.payload], coins: state.coins + 25 }
    case 'setGoal':
      return { ...state, dailyGoal: action.payload }
    case 'reset':
      return { ...initialState, auth: state.auth, settings: state.settings, welcomeComplete: state.welcomeComplete, requiresExplicitSignIn: state.requiresExplicitSignIn }
    default:
      return state
  }
}

const Ctx = createContext(null)

// Restore a learner's own progress. New visitors start with a clean, local profile;
// the interface never invents test history to fill the dashboard.
function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialState
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return initialState
    return {
      ...initialState,
      ...saved,
      welcomeComplete: savedWelcomeStatus(saved),
      profile: saved.profile || initialState.profile,
      // The dedicated session keys are authoritative; an old state snapshot
      // must not resurrect a signed-out or different backend account.
      auth: { token: getToken(), user: getApiUser() },
      settings: { ...initialState.settings, ...saved.settings },
      streak: { ...initialState.streak, ...saved.streak },
    }
  } catch {
    return initialState
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch (e) {
      /* storage full or unavailable — ignore */
    }
  }, [state])

  const actions = useMemo(
    () => ({
      // Onboarding creates a local profile. Never generate credentials on the learner's behalf.
      register: async (p) => {
        dispatch({ type: 'register', payload: p })
      },
      completeWelcome: (user) => dispatch({ type: 'completeWelcome', payload: user }),
      registerBackend: async (name, email, password) => {
        const { token, user } = await api.register(name, email, password, 'ssc-cgl')
        setSession(token, user)
        dispatch({ type: 'session', payload: user })
        return user
      },
      login: async (email, password) => {
        const { token, user } = await api.login(email, password)
        setSession(token, user)
        dispatch({ type: 'session', payload: user })
        return user
      },
      logout: () => {
        setSession(null, null)
        dispatch({ type: 'logout' })
      },
      // Sign out on this device without clearing attempts, notes or settings.
      logoutToSignIn: () => {
        setSession(null, null)
        dispatch({ type: 'logoutToSignIn' })
      },
      updateProfile: (p) => dispatch({ type: 'updateProfile', payload: p }),
      updateSettings: (p) => dispatch({ type: 'updateSettings', payload: p }),
      addAttempt: (a) => dispatch({ type: 'addAttempt', payload: a }),
      toggleBookmark: (id) => dispatch({ type: 'toggleBookmark', payload: id }),
      saveNote: (id, text) => dispatch({ type: 'saveNote', payload: { id, text } }),
      claimAchievement: (id) => dispatch({ type: 'claimAchievement', payload: id }),
      setGoal: (n) => dispatch({ type: 'setGoal', payload: n }),
      reset: () => { clearQuestionTimes(); clearPlayerData(); clearReviewTargets(); clearDestSessions(); dispatch({ type: 'reset' }) },
    }),
    []
  )

  const value = useMemo(() => ({ state, ...actions }), [state, actions])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used inside StoreProvider')
  return v
}

// ── Derived helpers ─────────────────────────────────────────────
export function useAttemptStats() {
  const { state } = useStore()
  return useMemo(() => computeStats(state.attempts), [state.attempts])
}

export function computeStats(attempts) {
  let totalQ = 0
  let totalCorrect = 0
  let totalAnswered = 0
  let totalTime = 0
  let best = null
  let scoreSum = 0
  let scoreCount = 0

  attempts.forEach((a) => {
    totalQ += a.totalQuestions || a.perQuestion?.length || 0
    totalCorrect += a.correct
    totalAnswered += (a.correct || 0) + (a.wrong || 0)
    totalTime += a.timeSpent
    scoreSum += a.score
    scoreCount++
    if (!best || a.score > best.score) best = a
  })

  // Old question records were removed, so historical topic-level analysis
  // cannot be reconstructed from stored IDs alone.
  const topics = []

  const byExam = {}
  attempts.forEach((a) => {
    const e = (byExam[a.examId] = byExam[a.examId] || { examId: a.examId, count: 0, score: 0, correct: 0, total: 0, answered: 0, time: 0 })
    e.count++
    e.score += a.score
    e.correct += a.correct
    e.answered += (a.correct || 0) + (a.wrong || 0)
    e.total += a.totalQuestions || a.perQuestion?.length || 0
    e.time += a.timeSpent
  })

  return {
    attempts: attempts.length,
    totalQ,
    totalCorrect,
    totalTime,
    accuracy: totalAnswered ? totalCorrect / totalAnswered : 0,
    avgScore: scoreCount ? scoreSum / scoreCount : 0,
    best,
    topics,
    byExam: Object.values(byExam),
    strong: [...topics].reverse().slice(0, 5),
    weak: topics.filter((t) => t.accuracy < 0.6).slice(0, 5),
  }
}

export function currentStreak(streak, date = new Date()) {
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  return streak?.last === todayKey(date) || streak?.last === todayKey(yesterday) ? (streak.count || 0) : 0
}

export function useCurrentStreak() {
  const { state } = useStore()
  return currentStreak(state.streak)
}

export const ALL_EXAMS = EXAMS
