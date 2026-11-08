import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { cglHealth, createCglRouter } from './cgl-api.js'
import { validateRegistration } from './auth-validation.js'
import { migrateSscCgl } from './migration-core.js'
import { seedOfficialCatalog } from './official-catalog.js'
import { migrateMasterAssembler } from './master-migration.js'
import { migratePracticePacks } from './practice-migration.js'
import { importPracticePack, PREVIEW_REVIEWER } from './practice-ingest.js'
import { readPracticePack, validatePracticePack } from './practice-content.js'

// LOCAL PREVIEW ONLY.
// A disposable in-memory PGlite database makes the real backend, master-mock
// engine and player usable without a PostgreSQL server. The practice pack is
// imported in "preview" mode: it is technically served, but is explicitly
// labelled as automatically checked and NOT human reviewed. No production
// database, account or learner history is read or modified.

const PORT = Number(process.env.PORT || 4000)
const HOST = process.env.HOST || '0.0.0.0'
const JWT_SECRET = process.env.PREVIEW_JWT_SECRET || randomBytes(32).toString('hex')

const db = await PGlite.create()
await db.exec(`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    target_exam TEXT,
    lang TEXT DEFAULT 'en',
    plan TEXT DEFAULT 'free',
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 40,
    streak_count INTEGER DEFAULT 0,
    streak_last DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`)

const multiStatement = [
  'DROP TABLE IF EXISTS mock_test_questions;',
  '-- Additive catalogue only',
  '-- Additive vault and AI draft tables.',
  '-- Additive per-learner master assembler.',
  '-- Additive exam-player progress;',
  '-- Additive provenance ledger',
]
const client = {
  query: (sql, args) => multiStatement.some(prefix => sql.includes(prefix))
    ? db.exec(sql).then(() => ({ rows: [] }))
    : db.query(sql, args),
  release: () => {},
}

console.log('preview: applying additive migrations')
await migrateSscCgl(client, { resetLegacyBank: true })
await seedOfficialCatalog(client)
await migrateMasterAssembler(client)
await migratePracticePacks(client)

const content = await readPracticePack()
const report = await validatePracticePack(content)
if (!report.ok) {
  console.error('Preview content failed validation; refusing to serve it.')
  console.error(report.errors.join('\n'))
  process.exit(1)
}
const imported = await importPracticePack(client, {
  content,
  report,
  mode: 'preview',
  importedBy: 'dev-preview',
  notes: 'Disposable local preview. Not human reviewed.',
})
console.log('preview: practice pack', imported.review_status, `${imported.questions} questions`)

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const sign = user => jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' })
const publicUser = user => ({
  id: user.id, name: user.name, email: user.email, targetExam: user.target_exam,
  lang: user.lang, plan: user.plan, xp: user.xp, coins: user.coins,
  streak: user.streak_count, streakLast: user.streak_last, joinedAt: user.created_at,
})

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

app.get('/api/preview/info', (_req, res) => res.json({
  preview: true,
  database: 'in-memory PGlite (disposable)',
  practice_content: imported.review_status,
  practice_label: 'Original ExamEdge practice — automatically checked, human review pending',
  reviewer_marker: PREVIEW_REVIEWER,
}))
app.get('/api/health', async (_req, res) => {
  try {
    const result = await cglHealth(client.query.bind(client))
    res.status(result.ok ? 200 : 503).json({ ...result, preview: true, time: new Date().toISOString() })
  } catch (error) {
    res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE', message: error.message })
  }
})
app.use('/api/cgl', createCglRouter({ pool: { connect: async () => client }, query: client.query.bind(client), auth }))

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, targetExam, error } = validateRegistration(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, target_exam) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, hash, targetExam]
    )
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' })
    res.status(500).json({ error: 'Registration unavailable', message: e.message })
  }
})
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [String(email || '').trim().toLowerCase()])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(typeof password === 'string' ? password : '', user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  res.json({ token: sign(user), user: publicUser(user) })
})
app.get('/api/me', auth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId])
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json({ user: publicUser(rows[0]) })
})
app.patch('/api/me', auth, async (req, res) => {
  const { name, targetExam, lang } = req.body || {}
  const { rows } = await db.query(`UPDATE users SET name = COALESCE($2, name), target_exam = COALESCE($3, target_exam),
    lang = COALESCE($4, lang) WHERE id = $1 RETURNING *`, [req.userId, name ?? null, targetExam ?? null, lang ?? null])
  res.json({ user: publicUser(rows[0]) })
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Local preview API on http://${HOST}:${PORT}`)
  console.log('Practice content is PREVIEW / NOT HUMAN REVIEWED. No production data is used.')
  console.log('In-memory data is lost when this process stops.')
})

async function shutdown() {
  await new Promise(resolve => server.close(resolve))
  await db.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
