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

const keys = ['ssc-cgl-2026-tier1-practice-v1', 'ssc-cgl-2026-tier1-practice-v2', 'ssc-cgl-2026-tier1-practice-v3', DRILL_KEY, 'ssc-cgl-2026-tier1-practice-v4']

test('four full-mock packs and the 60-question drill pool validate with no cross-pack duplicates', () => {
  assert.deepEqual(keys, [
    'ssc-cgl-2026-tier1-practice-v1',
    'ssc-cgl-2026-tier1-practice-v2',
    'ssc-cgl-2026-tier1-practice-v3',
    DRILL_KEY,
    'ssc-cgl-2026-tier1-practice-v4',
  ])
  let fullMockQuestions = 0
  let drillQuestions = 0
  for (const key of keys) {
    assert.equal(reports[key].ok, true, `${key}: ${reports[key].errors.join('\n')}`)
    assert.equal(reports[key].content_hash, practiceContentHash(contents[key]))
    if (key === DRILL_KEY) {
      assert.equal(reports[key].stats.kind, 'topic_drills')
      assert.equal(contents[key].questions.length, 60)
      assert.equal(contents[key].sets.length, 0)
      assert.deepEqual(reports[key].stats.by_subject, { Quant: 15, Reasoning: 15, English: 15, General_Awareness: 15 })
      drillQuestions += contents[key].questions.length
    } else {
      assert.equal(reports[key].stats.kind, 'full_mock')
      assert.equal(contents[key].questions.length, 100)
      assert.deepEqual(reports[key].stats.by_difficulty, { Easy: 30, Medium: 50, Hard: 20 })
      fullMockQuestions += contents[key].questions.length
    }
  }
  assert.equal(fullMockQuestions, 400)
  assert.equal(drillQuestions, 60)
  assert.equal(new Set(keys.map(key => reports[key].content_hash)).size, 5)

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
  assert.equal(qids.size, 460)
})

test('a fourth full mock and a topic drill both draw from the imported 460-question bank', async () => {
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

    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 460)
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status='Published'")).rows[0].n, 460)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_question_sets')).rows[0].n, 8)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_packs')).rows[0].n, 5)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_pack_items WHERE pack_key=$1', [DRILL_KEY])).rows[0].n, 60)

    http = await httpFixture(client)
    const status = await http.request('/practice/status')
    assert.equal(status.status, 200, JSON.stringify(status.data))
    assert.equal(status.data.packs.length, 5)
    assert.equal(status.data.total_questions, 460)
    assert.equal(status.data.published_questions, 460)
    assert.equal(status.data.pending_review, true)
    assert.equal(status.data.human_reviewed, false)

    const mock = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(mock.status, 201, JSON.stringify(mock.data))
    assert.equal(mock.data.mock.question_count, 100)
    const launch = await http.request(`/master/mocks/${mock.data.mock.id}/launch`, { method: 'POST', user: 1 })
    assert.equal(launch.status, 200, JSON.stringify(launch.data))
    assert.equal(launch.data.questions.length, 25)

    // A 15-question single-topic drill drawn from full-mock and drill-pool items.
    const drill = await http.request('/master/mocks', {
      method: 'POST', user: 1,
      body: { category: 'Micro', stage: 'Tier_1', subject: 'Quant', topic: 'Fundamental Arithmetical Operations', count: 15 },
    })
    assert.equal(drill.status, 201, JSON.stringify(drill.data))
    assert.equal(drill.data.mock.question_count, 15)
    const drillLaunch = await http.request(`/master/mocks/${drill.data.mock.id}/launch`, { method: 'POST', user: 1 })
    assert.equal(drillLaunch.status, 200, JSON.stringify(drillLaunch.data))
    assert.equal(drillLaunch.data.questions.length, 15)
    for (const question of drillLaunch.data.questions) {
      assert.equal(question.topic, 'Fundamental Arithmetical Operations')
      assert.equal(question.subject, 'Quant')
    }
  } finally {
    await http?.close()
    await db.close()
  }
})
