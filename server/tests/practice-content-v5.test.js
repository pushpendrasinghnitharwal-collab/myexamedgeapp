import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl } from '../migration-core.js'
import { migrateMasterAssembler } from '../master-migration.js'
import { migratePracticePacks } from '../practice-migration.js'
import { importPracticePack } from '../practice-ingest.js'
import { PRACTICE_PACKS, PRACTICE_PACK_KEYS, readPracticePack, validatePracticePack, practiceContentHash } from '../practice-content.js'
import { createCglRouter } from '../cgl-api.js'

const contents = {}
const reports = {}
for (const key of PRACTICE_PACK_KEYS) {
  contents[key] = await readPracticePack({ dir: PRACTICE_PACKS[key] })
  reports[key] = await validatePracticePack(contents[key])
}

const DRILL_KEY = 'ssc-cgl-2026-tier1-practice-drills-v1'
const keys = [
  'ssc-cgl-2026-tier1-practice-v1',
  'ssc-cgl-2026-tier1-practice-v2',
  'ssc-cgl-2026-tier1-practice-v3',
  DRILL_KEY,
  'ssc-cgl-2026-tier1-practice-v4',
  'ssc-cgl-2026-tier1-practice-v5',
]
const normalize = value => String(value).toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[.,;:!?'"()[\]{}\-–—]/g, '').trim()

async function database() {
  const db = await PGlite.create()
  await db.exec('CREATE TABLE users(id SERIAL PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES;')
  const client = {
    query: (sql, args) => sql.includes('DROP TABLE IF EXISTS mock_test_questions;')
      || sql.startsWith('-- Additive vault and AI draft tables.')
      || sql.startsWith('-- Additive per-learner master assembler.')
      || sql.startsWith('-- Additive exam-player progress;')
      || sql.startsWith('-- Additive provenance ledger')
      ? db.exec(sql).then(() => ({ rows: [] }))
      : db.query(sql, args),
    release: () => {},
  }
  return { db, client }
}

async function httpFixture(client) {
  const app = express()
  app.use(express.json())
  const auth = (req, res, next) => {
    if (!['1', '2', '3'].includes(req.get('x-test-user'))) return res.status(401).json({ error: 'Missing token' })
    req.userId = Number(req.get('x-test-user'))
    next()
  }
  app.use('/api/cgl', createCglRouter({ pool: { connect: async () => client }, query: client.query, auth }))
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}/api/cgl`
  async function request(path, { method = 'GET', body, user } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(user ? { 'x-test-user': String(user) } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: response.status, data: await response.json() }
  }
  return { request, close: async () => { await new Promise(resolve => server.close(resolve)) } }
}

test('five full-mock packs plus the drill pool validate with no cross-pack duplicates', () => {
  assert.deepEqual(PRACTICE_PACK_KEYS, keys)
  let fullMockQuestions = 0
  let drillQuestions = 0
  for (const key of keys) {
    assert.equal(reports[key].ok, true, `${key}: ${reports[key].errors.join('\n')}`)
    assert.equal(reports[key].content_hash, practiceContentHash(contents[key]))
    if (key === DRILL_KEY) {
      assert.equal(reports[key].stats.kind, 'topic_drills')
      assert.equal(contents[key].questions.length, 60)
      drillQuestions += 60
    } else {
      assert.equal(reports[key].stats.kind, 'full_mock')
      assert.equal(contents[key].questions.length, 100)
      assert.deepEqual(reports[key].stats.by_difficulty, { Easy: 30, Medium: 50, Hard: 20 })
      fullMockQuestions += 100
    }
  }
  assert.equal(fullMockQuestions, 500)
  assert.equal(drillQuestions, 60)
  assert.equal(new Set(keys.map(key => reports[key].content_hash)).size, 6)

  const qids = new Set()
  const texts = new Set()
  for (const key of keys) {
    for (const question of contents[key].questions) {
      assert.equal(qids.has(question.qid), false, `duplicate qid across packs: ${question.qid}`)
      qids.add(question.qid)
      const fingerprint = `${question.subject}|${normalize(question.text_en)}`
      assert.equal(texts.has(fingerprint), false, `duplicate question across packs: ${question.qid}`)
      texts.add(fingerprint)
    }
  }
  assert.equal(qids.size, 560)
})

test('five independent full mocks can be prepared from the 560-question bank without repeats', async () => {
  const { db, client } = await database()
  let http
  try {
    await migrateSscCgl(client, { resetLegacyBank: true })
    await migrateMasterAssembler(client)
    await migratePracticePacks(client)
    for (const key of keys) {
      const result = await importPracticePack(client, { content: contents[key], report: reports[key], mode: 'preview', importedBy: 'test' })
      assert.equal(result.imported, true)
      assert.equal(result.review_status, 'preview_not_human_reviewed')
    }

    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 560)
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status='Published'")).rows[0].n, 560)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_question_sets')).rows[0].n, 10)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_packs')).rows[0].n, 6)

    http = await httpFixture(client)
    const status = await http.request('/practice/status')
    assert.equal(status.status, 200, JSON.stringify(status.data))
    assert.equal(status.data.packs.length, 6)
    assert.equal(status.data.total_questions, 560)
    assert.equal(status.data.published_questions, 560)
    assert.equal(status.data.pending_review, true)
    assert.equal(status.data.human_reviewed, false)

    const delivered = []
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const mock = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
      assert.equal(mock.status, 201, `attempt ${attempt}: ${JSON.stringify(mock.data)}`)
      assert.equal(mock.data.mock.question_count, 100)
      assert.equal(mock.data.mock.selection.reused_questions, 0)
      const launch = await http.request(`/master/mocks/${mock.data.mock.id}/launch`, { method: 'POST', user: 1 })
      assert.equal(launch.status, 200, JSON.stringify(launch.data))
      assert.equal(launch.data.questions.length, 25)
      delivered.push(new Set(launch.data.questions.map(q => q.question_text_en)))
      const submitted = await http.request(`/master/mocks/${mock.data.mock.id}/submit`, { method: 'POST', user: 1, body: {} })
      assert.equal(submitted.status, 200, JSON.stringify(submitted.data))
      assert.equal(submitted.data.summary.max_score, 200)
    }
    for (let i = 0; i < delivered.length; i += 1) {
      for (let j = i + 1; j < delivered.length; j += 1) {
        for (const text of delivered[i]) {
          assert.equal(delivered[j].has(text), false, `mock ${j + 1} repeated a delivered question: ${text}`)
        }
      }
    }
  } finally {
    await http?.close()
    await db.close()
  }
})
