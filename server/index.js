import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { query, initSchema, pool } from './db.js'
import { cglHealth, createCglRouter } from './cgl-api.js'
import { validateRegistration } from './auth-validation.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || '0.0.0.0'
const JWT_SECRET = process.env.JWT_SECRET
const TOKEN_TTL = process.env.TOKEN_TTL || '30d'

// ── helpers ──────────────────────────────────────────────
const sign = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL })

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  targetExam: u.target_exam,
  lang: u.lang,
  plan: u.plan,
  xp: u.xp,
  coins: u.coins,
  streak: u.streak_count,
  streakLast: u.streak_last,
  joinedAt: u.created_at,
})

function auth(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Health reports the schema state without exposing connection details. Migration is
// explicit; server boot never drops learner data or silently resets the bank.
app.get('/api/health', async (_req, res) => {
  try {
    const result = await cglHealth(query)
    res.status(result.ok ? 200 : 503).json({ ...result, time: new Date().toISOString() })
  } catch (error) {
    console.error('Health check failed:', error.message)
    res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' })
  }
})
app.use('/api/cgl', createCglRouter({ pool, query, auth }))

// ── auth ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  if (!JWT_SECRET) return res.status(503).json({ error: 'Practice sign-in is not configured' })
  const { name, email, password, targetExam, error } = validateRegistration(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, target_exam) VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name, email, hash, targetExam]
    )
    const u = rows[0]
    res.status(201).json({ token: sign(u), user: publicUser(u) })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' })
    console.error('Registration failed:', e.message)
    res.status(500).json({ error: 'Registration is unavailable' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  if (!JWT_SECRET) return res.status(503).json({ error: 'Practice sign-in is not configured' })
  const { email, password } = req.body || {}
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [String(email || '').trim().toLowerCase()])
    const u = rows[0]
    if (!u || !(await bcrypt.compare(typeof password === 'string' ? password : '', u.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' })
    res.json({ token: sign(u), user: publicUser(u) })
  } catch (error) {
    console.error('Sign-in failed:', error.message)
    res.status(503).json({ error: 'Practice sign-in is unavailable' })
  }
})

app.get('/api/me', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.userId])
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json({ user: publicUser(rows[0]) })
})

app.patch('/api/me', auth, async (req, res) => {
  const { name, targetExam, lang } = req.body || {}
  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($2, name),
       target_exam = COALESCE($3, target_exam),
       lang = COALESCE($4, lang)
     WHERE id = $1 RETURNING *`,
    [req.userId, name ?? null, targetExam ?? null, lang ?? null]
  )
  res.json({ user: publicUser(rows[0]) })
})

// ── exams catalogue ──────────────────────────────────────
app.get('/api/exams', async (_req, res) => {
  const { rows } = await query('SELECT data FROM exams ORDER BY id')
  res.json({ exams: rows.map((r) => r.data) })
})

// Retired legacy paper/grade APIs must not read the dropped question schema or
// silently apply the old non-SSC scoring rules. Historical attempt reads remain.
app.get('/api/paper', (_req, res) => res.status(410).json({
  error: 'The legacy question bank has been retired. Use /api/cgl/mock-tests.', code: 'LEGACY_BANK_RETIRED',
}))
app.post('/api/attempts', auth, (_req, res) => res.status(410).json({
  error: 'Legacy submission is retired. Use /api/cgl/attempts for a published SSC CGL mock.', code: 'LEGACY_BANK_RETIRED',
}))

app.get('/api/attempts', auth, async (req, res) => {
  const examId = req.query.examId ? String(req.query.examId) : null
  const sql = examId
    ? 'SELECT * FROM attempts WHERE user_id = $1 AND exam_id = $2 ORDER BY created_at DESC LIMIT 100'
    : 'SELECT * FROM attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100'
  const { rows } = await query(sql, examId ? [req.userId, examId] : [req.userId])
  res.json({
    attempts: rows.map((a) => ({
      id: a.id, examId: a.exam_id, testId: a.test_id, mode: a.mode,
      total: a.total, correct: a.correct, wrong: a.wrong, skipped: a.skipped,
      score: Number(a.score), maxScore: Number(a.max_score), accuracy: Number(a.accuracy),
      timeTaken: a.time_taken, createdAt: a.created_at,
    })),
  })
})

// ── leaderboard ──────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  const examId = req.query.examId ? String(req.query.examId) : null
  const sql = examId
    ? `SELECT u.id, u.name, u.target_exam, u.xp,
              COUNT(a.id)::int AS attempts,
              ROUND(AVG(a.accuracy)::numeric, 1) AS avg_accuracy,
              ROUND(MAX(a.score)::numeric, 1) AS best_score
       FROM users u LEFT JOIN attempts a ON a.user_id = u.id AND a.exam_id = $1
       GROUP BY u.id ORDER BY avg_accuracy DESC NULLS LAST, best_score DESC NULLS LAST LIMIT 50`
    : `SELECT u.id, u.name, u.target_exam, u.xp,
              COUNT(a.id)::int AS attempts,
              ROUND(AVG(a.accuracy)::numeric, 1) AS avg_accuracy,
              ROUND(MAX(a.score)::numeric, 1) AS best_score
       FROM users u LEFT JOIN attempts a ON a.user_id = u.id
       GROUP BY u.id ORDER BY avg_accuracy DESC NULLS LAST, best_score DESC NULLS LAST LIMIT 50`
  const { rows } = await query(sql, examId ? [examId] : [])
  res.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1, id: r.id, name: r.name, targetExam: r.target_exam, xp: r.xp,
      attempts: r.attempts, avgAccuracy: r.avg_accuracy === null ? null : Number(r.avg_accuracy),
      bestScore: r.best_score === null ? null : Number(r.best_score),
    })),
  })
})

// ── my analytics ─────────────────────────────────────────
app.get('/api/stats', auth, async (req, res) => {
  const { rows } = await query(
    `SELECT exam_id, COUNT(*)::int AS attempts, ROUND(AVG(accuracy)::numeric,1) AS avg_acc,
            ROUND(AVG(score)::numeric,1) AS avg_score, SUM(correct)::int AS total_correct
     FROM attempts WHERE user_id = $1 GROUP BY exam_id ORDER BY attempts DESC`,
    [req.userId]
  )
  const { rows: byTopic } = await query(
    `SELECT a.answers FROM attempts a WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
    [req.userId]
  )
  const topicStats = {}
  for (const r of byTopic) {
    for (const g of r.answers || []) {
      if (!g.topic) continue
      topicStats[g.topic] = topicStats[g.topic] || { total: 0, correct: 0 }
      topicStats[g.topic].total++
      if (g.ok) topicStats[g.topic].correct++
    }
  }
  const topics = Object.entries(topicStats)
    .map(([topic, s]) => ({ topic, accuracy: Math.round((s.correct / s.total) * 1000) / 10, total: s.total }))
    .sort((a, b) => a.accuracy - b.accuracy)
  res.json({
    perExam: rows.map((r) => ({ examId: r.exam_id, attempts: r.attempts, avgAccuracy: Number(r.avg_acc), avgScore: Number(r.avg_score), totalCorrect: r.total_correct })),
    weakTopics: topics.slice(0, 8),
    strongTopics: topics.slice(-8).reverse(),
  })
})

// ── boot ─────────────────────────────────────────────────
await initSchema()
app.listen(PORT, HOST, () => {
  console.log(`EXAMEDGE API listening on http://${HOST}:${PORT}`)
})

process.on('SIGTERM', async () => {
  await pool.end()
  process.exit(0)
})
