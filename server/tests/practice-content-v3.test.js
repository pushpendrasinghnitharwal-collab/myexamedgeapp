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

test('all three Tier-I packs independently pass validation and contain no cross-pack duplicates', () => {
  assert.deepEqual(PRACTICE_PACK_KEYS, [
    'ssc-cgl-2026-tier1-practice-v1',
    'ssc-cgl-2026-tier1-practice-v2',
    'ssc-cgl-2026-tier1-practice-v3',
  ])
  let total = 0
  for (const key of PRACTICE_PACK_KEYS) {
    assert.equal(reports[key].ok, true, `${key}: ${reports[key].errors.join('\n')}`)
    assert.equal(contents[key].questions.length, 100)
    assert.deepEqual(reports[key].stats.by_difficulty, { Easy: 30, Medium: 50, Hard: 20 })
    assert.equal(reports[key].content_hash, practiceContentHash(contents[key]))
    total += contents[key].questions.length
  }
  assert.equal(total, 300)
  assert.equal(new Set(PRACTICE_PACK_KEYS.map(key => reports[key].content_hash)).size, 3)

  const qids = new Set()
  const texts = new Set()
  for (const key of PRACTICE_PACK_KEYS) {
    for (const question of contents[key].questions) {
      assert.equal(qids.has(question.qid), false, `duplicate qid across packs: ${question.qid}`)
      qids.add(question.qid)
      const fingerprint = `${question.subject}|${normalize(question.text_en)}|${normalize(question.options[question.correct].en)}`
      assert.equal(texts.has(fingerprint), false, `duplicate question across packs: ${question.qid}`)
      texts.add(fingerprint)
    }
  }
})

test('three packs provide three independent full mocks and exhaust the unseen pool honestly', async () => {
  const { db, client } = await database()
  let http
  try {
    await migrateSscCgl(client, { resetLegacyBank: true })
    await migrateMasterAssembler(client)
    await migratePracticePacks(client)
    for (const key of PRACTICE_PACK_KEYS) {
      const result = await importPracticePack(client, { content: contents[key], report: reports[key], mode: 'preview', importedBy: 'test' })
      assert.equal(result.imported, true)
      assert.equal(result.review_status, 'preview_not_human_reviewed')
    }

    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 300)
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status='Published'")).rows[0].n, 300)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_question_sets')).rows[0].n, 6)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_packs')).rows[0].n, 3)

    http = await httpFixture(client)
    const status = await http.request('/practice/status')
    assert.equal(status.status, 200, JSON.stringify(status.data))
    assert.equal(status.data.available, true)
    assert.equal(status.data.packs.length, 3)
    assert.equal(status.data.total_questions, 300)
    assert.equal(status.data.published_questions, 300)
    assert.equal(status.data.pending_review, true)
    assert.equal(status.data.human_reviewed, false)

    const delivered = []
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const mock = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
      assert.equal(mock.status, 201, `attempt ${attempt}: ${JSON.stringify(mock.data)}`)
      assert.equal(mock.data.mock.question_count, 100)
      const launch = await http.request(`/master/mocks/${mock.data.mock.id}/launch`, { method: 'POST', user: 1 })
      assert.equal(launch.status, 200, JSON.stringify(launch.data))
      const texts = launch.data.questions.map(question => question.question_text_en)
      assert.equal(texts.length, 25)
      delivered.push(new Set(texts))
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

    // After the whole pool is used, the engine may still prepare a mock, but it must
    // disclose that it is reusing seen questions and why (intact DI/cloze sets).
    const fourth = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(fourth.status, 201, JSON.stringify(fourth.data))
    assert.equal(fourth.data.mock.question_count, 100)
    assert.ok(fourth.data.mock.selection.reused_questions > 0, JSON.stringify(fourth.data.mock.selection))
    assert.ok(fourth.data.mock.selection.repeat_reason, JSON.stringify(fourth.data.mock.selection))

    // A separate learner still gets a complete 100-question mock after the first
    // learner has used the whole pool.
    const other = await http.request('/master/mocks', { method: 'POST', user: 2, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(other.status, 201, JSON.stringify(other.data))
    assert.equal(other.data.mock.question_count, 100)
  } finally {
    await http?.close()
    await db.close()
  }
})
