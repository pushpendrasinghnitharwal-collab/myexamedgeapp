import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback } from 'react'
import { QUESTIONS, buildPaper, mulberry32, hashString } from '../data/questions'
import { EXAMS, examById } from '../data/exams'
import { api, getToken, getApiUser, setSession } from './api'

const KEY = 'examedge.state.v1'

const initialState = {
  profile: null,
  auth: { token: getToken(), user: getApiUser() },
  attempts: [],
  bookmarks: [],
  notes: {},
  streak: { count: 0, last: null, days: [] },
  xp: 0,
  coins: 40,
  achievements: [],
  dailyGoal: 25,
  settings: { lang: 'en', theme: 'dark', sound: true, autoSubmit: true },
  seeded: false,
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.payload }
    case 'register':
      return { ...state, profile: { ...action.payload, joinedAt: Date.now(), plan: 'free' } }
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
        streak: { count: Math.max(count, state.streak.count), last: todayKey(), days },
        xp: state.xp + Math.round(a.score * 2 + a.correct * 3),
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
      return { ...initialState, settings: state.settings }
    default:
      return state
  }
}

const Ctx = createContext(null)

// Builds believable history so analytics screens are meaningful from day one.
function seedAttempts() {
  const out = []
  const plan = [
    { examId: 'ssc-cgl', mode: 'mock', q: 25, daysAgo: 6 },
    { examId: 'ssc-cgl', mode: 'practice', q: 20, daysAgo: 5 },
    { examId: 'ibps-po', mode: 'mock', q: 25, daysAgo: 4 },
    { examId: 'ibps-po', mode: 'practice', q: 20, daysAgo: 3 },
    { examId: 'ssc-cgl', mode: 'mock', q: 25, daysAgo: 1 },
  ]
  plan.forEach((p, idx) => {
    const exam = examById(p.examId)
    const paper = buildPaper(exam, { count: p.q, seed: 900 + idx })
    const rand = mulberry32(hashString(p.examId + idx))
    const perQuestion = []
    let correct = 0
    let timeSpent = 0
    paper.forEach((q) => {
      const ability = 0.45 + idx * 0.07 + rand() * 0.22
      const pickCorrect = rand() < ability
      const chosen = pickCorrect ? q.a : (q.a + 1 + Math.floor(rand() * 3)) % 4
      if (chosen === q.a) correct++
      const t = Math.round(25 + rand() * 55)
      timeSpent += t
      perQuestion.push({ qid: q.id, chosen, time: t })
    })
    const wrong = paper.length - correct
    const score = correct * exam.marksPerQ - wrong * exam.negative
    out.push({
      id: `seed-${idx}`,
      examId: p.examId,
      mode: p.mode,
      title: p.mode === 'mock' ? 'Full-Length Mock Test' : 'Topic Practice — Mixed',
      date: Date.now() - p.daysAgo * 86400000,
      score: Math.round(score * 10) / 10,
      maxScore: paper.length * exam.marksPerQ,
      correct,
      wrong,
      unattempted: 0,
      accuracy: correct / paper.length,
      timeSpent,
      perQuestion,
      totalQuestions: paper.length,
      seed: 900 + idx,
    })
  })
  return out
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        dispatch({ type: 'hydrate', payload: JSON.parse(raw) })
      } else {
        dispatch({ type: 'hydrate', payload: { ...initialState, seeded: true, attempts: seedAttempts(), streak: { count: 5, last: todayKey(), days: [] } } })
      }
    } catch (e) {
      dispatch({ type: 'hydrate', payload: initialState })
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch (e) {
      /* storage full or unavailable — ignore */
    }
  }, [state])

  const actions = useMemo(
    () => ({
      // Registers locally AND on the backend (email derived from phone/name).
      register: async (p) => {
        dispatch({ type: 'register', payload: p })
        try {
          const email = (p.phone && p.phone.trim()) ? `${p.phone.trim()}@examedge.in` : `${p.name.trim().toLowerCase().replace(/\s+/g, '.')}@examedge.in`
          const password = p.phone?.trim() || 'examedge123'
          const { token, user } = await api.register(p.name, email, password, p.examId)
          setSession(token, user)
          dispatch({ type: 'session', payload: user })
        } catch (e) {
          console.warn('Backend register failed, staying local:', e.message)
        }
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
      // Submits the attempt to the backend when logged in; always records locally too.
      submitAttempt: async (a) => {
        dispatch({ type: 'addAttempt', payload: a })
        const token = getToken()
        if (!token) return null
        try {
          const res = await api.submitAttempt({
            examId: a.examId,
            testId: a.testId || a.title || 'custom',
            mode: a.mode,
            timeTaken: a.timeSpent,
            answers: (a.perQuestion || []).map((pq) => ({ id: pq.qid, choice: pq.chosen })),
          })
          return res
        } catch (e) {
          console.warn('Backend submit failed, attempt kept locally:', e.message)
          return null
        }
      },
      updateProfile: (p) => dispatch({ type: 'updateProfile', payload: p }),
      updateSettings: (p) => dispatch({ type: 'updateSettings', payload: p }),
      addAttempt: (a) => dispatch({ type: 'addAttempt', payload: a }),
      toggleBookmark: (id) => dispatch({ type: 'toggleBookmark', payload: id }),
      saveNote: (id, text) => dispatch({ type: 'saveNote', payload: { id, text } }),
      claimAchievement: (id) => dispatch({ type: 'claimAchievement', payload: id }),
      setGoal: (n) => dispatch({ type: 'setGoal', payload: n }),
      reset: () => dispatch({ type: 'reset' }),
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
  const topicMap = {}
  const qmap = {}
  QUESTIONS.forEach((q) => {
    qmap[q.id] = q
  })
  let totalQ = 0
  let totalCorrect = 0
  let totalTime = 0
  let best = null
  let scoreSum = 0
  let scoreCount = 0

  attempts.forEach((a) => {
    totalQ += a.totalQuestions || a.perQuestion.length
    totalCorrect += a.correct
    totalTime += a.timeSpent
    scoreSum += a.score
    scoreCount++
    if (!best || a.score > best.score) best = a
    a.perQuestion.forEach((pq) => {
      const q = qmap[pq.qid]
      if (!q) return
      const t = topicMap[q.topic] || (topicMap[q.topic] = { attempted: 0, correct: 0, wrong: 0, time: 0 })
      t.attempted++
      t.time += pq.time
      if (pq.chosen === q.a) t.correct++
      else t.wrong++
    })
  })

  const topics = Object.entries(topicMap).map(([id, v]) => ({
    id,
    ...v,
    accuracy: v.attempted ? v.correct / v.attempted : 0,
    avgTime: v.attempted ? v.time / v.attempted : 0,
  }))
  topics.sort((a, b) => a.accuracy - b.accuracy)

  const byExam = {}
  attempts.forEach((a) => {
    const e = (byExam[a.examId] = byExam[a.examId] || { examId: a.examId, count: 0, score: 0, correct: 0, total: 0, time: 0 })
    e.count++
    e.score += a.score
    e.correct += a.correct
    e.total += a.totalQuestions || a.perQuestion.length
    e.time += a.timeSpent
  })

  return {
    attempts: attempts.length,
    totalQ,
    totalCorrect,
    totalTime,
    accuracy: totalQ ? totalCorrect / totalQ : 0,
    avgScore: scoreCount ? scoreSum / scoreCount : 0,
    best,
    topics,
    byExam: Object.values(byExam),
    strong: [...topics].reverse().slice(0, 5),
    weak: topics.filter((t) => t.accuracy < 0.6).slice(0, 5),
  }
}

export function useCurrentStreak() {
  const { state } = useStore()
  return state.streak.count || 0
}

export const ALL_EXAMS = EXAMS
