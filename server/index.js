import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { query, initSchema, pool } from './db.js'

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

// deterministic PRNG (same algorithm as the frontend)
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function shuffleWith(list, rand) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── health ───────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM questions')
    res.json({ ok: true, questions: rows[0].c, time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── auth ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, targetExam } = req.body || {}
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' })
  const hash = await bcrypt.hash(password, 10)
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, target_exam) VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), hash, targetExam || null]
    )
    const u = rows[0]
    res.status(201).json({ token: sign(u), user: publicUser(u) })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [String(email || '').trim().toLowerCase()])
  const u = rows[0]
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' })
  res.json({ token: sign(u), user: publicUser(u) })
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

// ── paper generation (server-side, same blueprint as frontend) ──
app.get('/api/paper', async (req, res) => {
  const examId = String(req.query.examId || '')
  const count = Math.min(100, Math.max(5, parseInt(req.query.count || '25', 10)))
  const seed = parseInt(req.query.seed || '1', 10)
  const topic = req.query.topic ? String(req.query.topic) : null

  const { rows: examRows } = await query('SELECT data FROM exams WHERE id = $1', [examId])
  if (!examRows[0]) return res.status(404).json({ error: 'Exam not found' })
  const exam = examRows[0].data

  let sql = `SELECT id, topic, subject, diff, q_en, q_hi, o_en, o_hi FROM questions WHERE exams ? $1`
  const params = [examId]
  if (topic) {
    sql += ' AND topic = $2'
    params.push(topic)
  }
  const { rows } = await query(sql, params)

  const rand = mulberry32(hashString(examId + ':' + seed))
  const bySubject = {}
  rows.forEach((q) => (bySubject[q.subject] = bySubject[q.subject] || []).push(q))
  const subjectOrder = (exam.subjects || []).filter((s) => bySubject[s]?.length)
  const extra = Object.keys(bySubject).filter((s) => !(exam.subjects || []).includes(s))
  const pools = [...subjectOrder, ...extra].map((s) => shuffleWith(bySubject[s], rand))

  const picked = []
  let guard = 0
  while (picked.length < count && guard < count * 40) {
    guard++
    let progressed = false
    for (const pool of pools) {
      if (picked.length >= count) break
      if (pool.length) {
        picked.push(pool.pop())
        progressed = true
      }
    }
    if (!progressed) break
  }
  const paper = shuffleWith(picked, rand).map((q) => ({
    id: q.id,
    topic: q.topic,
    subject: q.subject,
    diff: q.diff,
    q: { en: q.q_en, hi: q.q_hi },
    o: q.o_en.map((en, i) => ({ en, hi: q.o_hi[i] })),
  }))
  res.json({ examId, seed, count: paper.length, questions: paper })
})

// ── submit attempt ───────────────────────────────────────
app.post('/api/attempts', auth, async (req, res) => {
  const { examId, testId, mode, answers, timeTaken } = req.body || {}
  if (!examId || !Array.isArray(answers)) return res.status(400).json({ error: 'examId and answers[] required' })

  const ids = answers.map((a) => a.id)
  const { rows } = await query(
    `SELECT id, a, exp_en, exp_hi, topic, subject FROM questions WHERE id = ANY($1)`,
    [ids]
  )
  const byId = Object.fromEntries(rows.map((q) => [q.id, q]))

  let correct = 0, wrong = 0, skipped = 0, score = 0
  const maxScore = answers.length * 4
  const graded = answers.map((a) => {
    const q = byId[a.id]
    if (!q) return { id: a.id, ok: false, correctAnswer: null }
    if (a.choice == null || a.choice === '') skipped++
    else if (a.choice === q.a) { correct++; score += 4 }
    else { wrong++; score -= 1 }
    return {
      id: a.id,
      choice: a.choice ?? null,
      ok: a.choice === q.a,
      correctAnswer: q.a,
      topic: q.topic,
      subject: q.subject,
      exp: { en: q.exp_en, hi: q.exp_hi },
    }
  })
  const total = answers.length
  const accuracy = total ? Math.round((correct / total) * 1000) / 10 : 0

  const { rows: ins } = await query(
    `INSERT INTO attempts (user_id, exam_id, test_id, mode, total, correct, wrong, skipped, score, max_score, accuracy, time_taken, answers)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [req.userId, examId, testId || 'custom', mode || 'mock', total, correct, wrong, skipped, score, maxScore, accuracy, timeTaken || 0, JSON.stringify(graded)]
  )
  const att = ins[0]

  // update user xp / coins / streak
  const today = new Date().toISOString().slice(0, 10)
  await query(
    `UPDATE users SET
       xp = xp + $2,
       coins = coins + $3,
       streak_count = CASE
         WHEN streak_last = ($4::date - interval '1 day') THEN streak_count + 1
         WHEN streak_last = $4::date THEN streak_count
         ELSE 1 END,
       streak_last = $4::date
     WHERE id = $1`,
    [req.userId, Math.round(score * 2 + correct * 3), Math.round(correct * 0.6), today]
  )

  // all-India rank for this exam by average accuracy (min 3 attempts)
  const { rows: rankRows } = await query(
    `SELECT user_id, COUNT(*)::int AS n, AVG(accuracy)::numeric AS avg_acc FROM attempts
     WHERE exam_id = $1 GROUP BY user_id HAVING COUNT(*) >= 1 ORDER BY avg_acc DESC, SUM(score) DESC`,
    [examId]
  )
  const rank = rankRows.findIndex((r) => r.user_id === req.userId) + 1

  res.status(201).json({
    attempt: {
      id: att.id,
      examId: att.exam_id,
      testId: att.test_id,
      mode: att.mode,
      total: att.total,
      correct: att.correct,
      wrong: att.wrong,
      skipped: att.skipped,
      score: Number(att.score),
      maxScore: Number(att.max_score),
      accuracy: Number(att.accuracy),
      timeTaken: att.time_taken,
      createdAt: att.created_at,
      rank,
    },
    graded,
  })
})

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
