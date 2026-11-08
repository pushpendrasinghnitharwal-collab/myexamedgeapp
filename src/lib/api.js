// EXAMEDGE API client — talks to the Express + PostgreSQL backend via the Vite proxy (/api).
// Falls back gracefully when the backend is unreachable (offline / demo mode).

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'examedge.token.v1'
const USER_KEY = 'examedge.apiuser.v1'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const getApiUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}
export const setSession = (token, user) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch { /* ignore */ }
}

async function req(path, { method = 'GET', body, auth = false, signal, keepalive = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    keepalive,
  })
  const type = res.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    const error = new Error('The practice API is not connected or returned an unexpected response.')
    error.status = res.status; error.code = 'API_UNAVAILABLE'; throw error
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = data.code
    err.details = data.details
    throw err
  }
  return data
}

function cglFilters(stage, subject) {
  const params = new URLSearchParams()
  if (stage) params.set('stage', stage)
  if (subject) params.set('subject', subject)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function queryParams(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  return query.size ? `?${query}` : ''
}

export const api = {
  health: () => req('/api/health'),
  register: (name, email, password, targetExam) =>
    req('/api/auth/register', { method: 'POST', body: { name, email, password, targetExam } }),
  login: (email, password) => req('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => req('/api/me', { auth: true }),
  updateMe: (patch) => req('/api/me', { method: 'PATCH', body: patch, auth: true }),
  exams: () => req('/api/exams'),
  // The legacy paper and submission endpoints are retired. The new CGL API is
  // separate from Google sign-in and requires a backend JWT for attempts.
  cglHealth: () => req('/api/cgl/health'),
  cglSyllabus: () => req('/api/cgl/syllabus'),
  cglBlueprints: (stage = null) => req(`/api/cgl/blueprints${cglFilters(stage)}`),
  cglBlueprint: (key) => req(`/api/cgl/blueprints/${encodeURIComponent(key)}`),
  cglSubjects: (stage = null, subject = null) => req(`/api/cgl/subjects${cglFilters(stage, subject)}`),
  cglSubject: (subject, stage = null) => req(`/api/cgl/subjects/${encodeURIComponent(subject)}${cglFilters(stage)}`),
  cglWeightages: (stage, subject = null) => req(`/api/cgl/weightages${cglFilters(stage, subject)}`),
  cglMocks: () => req('/api/cgl/mock-tests'),
  cglMock: (id) => req(`/api/cgl/mock-tests/${encodeURIComponent(id)}`),
  submitCglAttempt: (payload) => req('/api/cgl/attempts', { method: 'POST', body: payload, auth: true }),
  cglAttempts: () => req('/api/cgl/attempts', { auth: true }),
  cglAttempt: (id) => req(`/api/cgl/attempts/${encodeURIComponent(id)}`, { auth: true }),
  masterFormats: () => req('/api/cgl/master/formats'),
  masterSummary: () => req('/api/cgl/master/summary', { auth: true }),
  masterMocks: (params = {}) => req(`/api/cgl/master/mocks${queryParams(params)}`, { auth: true }),
  masterAttempts: (params = {}) => req(`/api/cgl/attempts/master${queryParams(params)}`, { auth: true }),
  masterMock: (id) => req(`/api/cgl/master/mocks/${encodeURIComponent(id)}`, { auth: true }),
  prepareMaster: (body) => req('/api/cgl/master/mocks', { method: 'POST', body, auth: true }),
  launchMaster: (id) => req(`/api/cgl/master/mocks/${encodeURIComponent(id)}/launch`, { method: 'POST', auth: true }),
  activeMaster: (id, { signal } = {}) => req(`/api/cgl/master/mocks/${encodeURIComponent(id)}/active`, { auth: true, signal }),
  saveMaster: (id, answers) => req(`/api/cgl/master/mocks/${encodeURIComponent(id)}/responses`, { method: 'PUT', body: { answers }, auth: true, keepalive: true }),
  advanceMaster: (id, section) => req(`/api/cgl/master/mocks/${encodeURIComponent(id)}/advance`, { method: 'POST', body: { section }, auth: true }),
  submitMaster: (id, answers = []) => req(`/api/cgl/attempts/master/${encodeURIComponent(id)}/submit`, { method: 'POST', body: { answers }, auth: true }),
  reviewMaster: (id) => req(`/api/cgl/attempts/master/${encodeURIComponent(id)}`, { auth: true }),
  askMentor: (id, body, { signal } = {}) => req(`/api/cgl/attempts/master/${encodeURIComponent(id)}/mentor`, { method: 'POST', body, auth: true, signal }),
  simulateMaster: (id, shifts) => req(`/api/cgl/attempts/master/${encodeURIComponent(id)}/simulate`, { method: 'POST', body: { shifts }, auth: true }),
  cancelMaster: (id) => req(`/api/cgl/master/mocks/${encodeURIComponent(id)}/cancel`, { method: 'POST', auth: true }),
  pyqPapers: (params = {}) => req(`/api/cgl/pyq/papers${queryParams(params)}`),
  pyqChapters: (params = {}) => req(`/api/cgl/pyq/chapters${queryParams(params)}`),
  caCoverage: (stage) => req(`/api/cgl/current-affairs/coverage${queryParams({ stage })}`),
  caCapsule: () => req('/api/cgl/current-affairs/capsule'),
  caMock: (id) => req(`/api/cgl/current-affairs/mocks/${encodeURIComponent(id)}`),
  submitCaMock: (id, answers) => req(`/api/cgl/current-affairs/mocks/${encodeURIComponent(id)}/attempts`, { method: 'POST', body: { answers }, auth: true }),
  myAttempts: (examId = null) => req(`/api/attempts${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`, { auth: true }),
  leaderboard: (examId = null) => req(`/api/leaderboard${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`),
  stats: () => req('/api/stats', { auth: true }),
}

export const isLoggedIn = () => !!getToken()
