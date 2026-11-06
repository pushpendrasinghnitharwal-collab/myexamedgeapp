// EXAMEDGE API client — talks to the Express + PostgreSQL backend via the Vite proxy (/api).
// Falls back gracefully when the backend is unreachable (offline / demo mode).

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

async function req(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  health: () => req('/api/health'),
  register: (name, email, password, targetExam) =>
    req('/api/auth/register', { method: 'POST', body: { name, email, password, targetExam } }),
  login: (email, password) => req('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => req('/api/me', { auth: true }),
  updateMe: (patch) => req('/api/me', { method: 'PATCH', body: patch, auth: true }),
  exams: () => req('/api/exams'),
  paper: (examId, { count = 25, seed = 1, topic = null } = {}) =>
    req(`/api/paper?examId=${encodeURIComponent(examId)}&count=${count}&seed=${seed}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`),
  submitAttempt: (payload) => req('/api/attempts', { method: 'POST', body: payload, auth: true }),
  myAttempts: (examId = null) => req(`/api/attempts${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`, { auth: true }),
  leaderboard: (examId = null) => req(`/api/leaderboard${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`),
  stats: () => req('/api/stats', { auth: true }),
}

export const isLoggedIn = () => !!getToken()
