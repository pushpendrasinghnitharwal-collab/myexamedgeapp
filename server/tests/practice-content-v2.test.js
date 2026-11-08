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

const keys = PRACTICE_PACK_KEYS.slice(0, 2)

test('both Tier-I packs independently pass validation and contain no cross-pack duplicates', () => {
  assert.deepEqual(keys, ['ssc-cgl-2026-tier1-practice-v1', 'ssc-cgl-2026-tier1-practice-v2'])
  let total = 0
  for (const key of keys) {
    assert.equal(reports[key].ok, true, `${key}: ${reports[key].errors.join('\n')}`)
    assert.equal(contents[key].questions.length, 100)
    assert.deepEqual(reports[key].stats.by_difficulty, { Easy: 30, Medium: 50, Hard: 20 })
    assert.equal(reports[key].content_hash, practiceContentHash(contents[key]))
    total += contents[key].questions.length
  }
  assert.equal(total, 200)
  assert.notEqual(reports[keys[0]].content_hash, reports[keys[1]].content_hash)

  const qids = new Set()
  const texts = new Set()
  for (const key of keys) {
    for (const question of contents[key].questions) {
      assert.equal(qids.has(question.qid), false, `duplicate qid across packs: ${question.qid}`)
      qids.add(question.qid)
      const fingerprint = `${question.subject}|${normalize(question.text_en)}|${normalize(question.options[question.correct].en)}`
      assert.equal(texts.has(fingerprint), false, `duplicate question across packs: ${question.qid}`)
      texts.add(fingerprint)
    }
  }
})

test('two packs provide two independent full mocks and a second attempt avoids seen questions', async () => {
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

    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 200)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status=\'Published\'')).rows[0].n, 200)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_question_sets')).rows[0].n, 4)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_packs')).rows[0].n, 2)

    http = await httpFixture(client)
    const status = await http.request('/practice/status')
    assert.equal(status.status, 200, JSON.stringify(status.data))
    assert.equal(status.data.available, true)
    assert.equal(status.data.packs.length, 2)
    assert.equal(status.data.total_questions, 200)
    assert.equal(status.data.published_questions, 200)
    assert.equal(status.data.pending_review, true)
    assert.equal(status.data.human_reviewed, false)

    const first = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(first.status, 201, JSON.stringify(first.data))
    assert.equal(first.data.mock.question_count, 100)
    const firstLaunch = await http.request(`/master/mocks/${first.data.mock.id}/launch`, { method: 'POST', user: 1 })
    assert.equal(firstLaunch.status, 200, JSON.stringify(firstLaunch.data))
    const firstDelivered = firstLaunch.data.questions.map(question => question.question_text_en)
    assert.equal(firstDelivered.length, 25)
    const submitted = await http.request(`/master/mocks/${first.data.mock.id}/submit`, { method: 'POST', user: 1, body: {} })
    assert.equal(submitted.status, 200, JSON.stringify(submitted.data))
    assert.equal(submitted.data.summary.max_score, 200)

    const second = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(second.status, 201, JSON.stringify(second.data))
    assert.equal(second.data.mock.question_count, 100)
    const secondLaunch = await http.request(`/master/mocks/${second.data.mock.id}/launch`, { method: 'POST', user: 1 })
    assert.equal(secondLaunch.status, 200, JSON.stringify(secondLaunch.data))
    const secondDelivered = new Set(secondLaunch.data.questions.map(question => question.question_text_en))
    assert.equal(secondDelivered.size, 25)
    for (const text of firstDelivered) {
      assert.equal(secondDelivered.has(text), false, `second mock repeated a delivered question: ${text}`)
    }

    // A separate learner gets a complete 100-question mock from the remaining pool
    // even while the first learner's second mock is active.
    const other = await http.request('/master/mocks', { method: 'POST', user: 2, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(other.status, 201, JSON.stringify(other.data))
    assert.equal(other.data.mock.question_count, 100)
  } finally {
    await http?.close()
    await db.close()
  }
})
