import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl } from '../migration-core.js'
import { migrateMasterAssembler } from '../master-migration.js'
import { migratePracticePacks, PRACTICE_MIGRATION_VERSION } from '../practice-migration.js'
import { importPracticePack, PREVIEW_REVIEWER } from '../practice-ingest.js'
import { readPracticePack, validatePracticePack, practiceContentHash } from '../practice-content.js'
import { TIER1_DIFFICULTY, TIER1_EDITORIAL_TOPICS, TIER1_EDITORIAL_SETS } from '../master-formats.js'
import { createCglRouter } from '../cgl-api.js'

const content = await readPracticePack()
const report = await validatePracticePack(content)

function cloneContent() {
  return JSON.parse(JSON.stringify(content))
}

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
    if (!['1', '2'].includes(req.get('x-test-user'))) return res.status(401).json({ error: 'Missing token' })
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

function noAnswerLeak(data) {
  const raw = JSON.stringify(data)
  for (const term of ['"correct_option_index"', '"correct_option_indices"', '"solution_basic"', '"solution_trick"', '"answer_status"']) {
    assert.equal(raw.includes(term), false, `active payload leaks ${term}`)
  }
}

test('practice pack passes structure, quota, duplicate and recomputed-answer checks', () => {
  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.equal(report.stats.questions, 100)
  assert.equal(report.stats.by_subject.Quant, 25)
  assert.equal(report.stats.by_subject.Reasoning, 25)
  assert.equal(report.stats.by_subject.English, 25)
  assert.equal(report.stats.by_subject.General_Awareness, 25)
  assert.deepEqual(report.stats.by_difficulty, TIER1_DIFFICULTY)
  assert.equal(report.stats.sets, 2)
  assert.equal(content.pack.provenance.is_pyq, false)
  assert.equal(content.pack.review.human_reviewed, false)
  assert.equal(report.content_hash, practiceContentHash(content))
  const quant = content.questions.filter(question => question.subject === 'Quant')
  assert.equal(quant.length, 25)
  assert.ok(quant.every(question => question.source.url.startsWith('https://')))
})

test('validator rejects quota drift, duplicate text, unsafe sources and a wrong quantitative key', async () => {
  const wrongAnswer = cloneContent()
  wrongAnswer.questions.find(question => question.qid === 'quant-21').correct = 1
  assert.equal((await validatePracticePack(wrongAnswer)).ok, false)

  const duplicate = cloneContent()
  duplicate.questions[1].text_en = duplicate.questions[0].text_en
  duplicate.questions[1].options = duplicate.questions[0].options.map(option => ({ ...option }))
  duplicate.questions[1].correct = duplicate.questions[0].correct
  const duplicateReport = await validatePracticePack(duplicate)
  assert.equal(duplicateReport.ok, false)
  assert.ok(duplicateReport.errors.some(error => /Duplicate question text/.test(error)))

  const unsafe = cloneContent()
  unsafe.questions[0].source.url = 'http://example.com/not-https'
  assert.equal((await validatePracticePack(unsafe)).ok, false)

  const quota = cloneContent()
  quota.questions[0].subject = 'English'
  quota.questions[0].topic = 'Vocabulary'
  quota.questions[0].sub_topic = 'Synonyms and homonyms'
  assert.equal((await validatePracticePack(quota)).ok, false)

  const missingHindi = cloneContent()
  missingHindi.questions[5].options[0].hi = ' '
  assert.equal((await validatePracticePack(missingHindi)).ok, false)
})

test('migration is additive, checksum-guarded and idempotent', async () => {
  const { db, client } = await database()
  try {
    await migrateSscCgl(client, { resetLegacyBank: true })
    const first = await migratePracticePacks(client)
    assert.equal(first.applied, true)
    assert.equal(first.version, PRACTICE_MIGRATION_VERSION)
    const second = await migratePracticePacks(client)
    assert.equal(second.applied, false)
    const { rows } = await db.query("SELECT to_regclass('public.cgl_practice_packs') IS NOT NULL AS packs, to_regclass('public.cgl_practice_pack_items') IS NOT NULL AS items")
    assert.deepEqual(rows[0], { packs: true, items: true })
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_pack_items')).rows[0].n, 0, 'Migration seeds no content')
  } finally { await db.close() }
})

test('draft import stays unavailable, is idempotent and refuses duplicate content', async () => {
  const { db, client } = await database()
  try {
    await migrateSscCgl(client, { resetLegacyBank: true })
    await migratePracticePacks(client)

    const publishedBefore = await db.query("SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status='Published'")
    assert.equal(publishedBefore.rows[0].n, 0)

    const first = await importPracticePack(client, { content, report, mode: 'draft', importedBy: 'test' })
    assert.equal(first.imported, true)
    assert.equal(first.published, false)
    assert.equal(first.review_status, 'draft')
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status='Published'")).rows[0].n, 0)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 100)
    const packRow = await db.query('SELECT review_status, reviewer, published_at FROM cgl_practice_packs WHERE pack_key=$1', [content.pack.pack_key])
    assert.equal(packRow.rows[0].review_status, 'draft')
    assert.equal(packRow.rows[0].reviewer, null)
    assert.equal(packRow.rows[0].published_at, null)

    const again = await importPracticePack(client, { content, report, mode: 'draft' })
    assert.equal(again.imported, false)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 100, 'Re-import does not duplicate content')

    await assert.rejects(
      importPracticePack(client, { content, report, mode: 'publish', reviewer: null }),
      /named reviewer/
    )

    // A second, differently keyed pack that repeats existing question text must
    // be refused before any row is written.
    const changed = cloneContent()
    changed.pack.pack_key = 'ssc-cgl-2026-tier1-practice-v2'
    const changedReport = { ...report, content_hash: practiceContentHash(changed) }
    await assert.rejects(
      importPracticePack(client, { content: changed, report: changedReport, mode: 'draft' }),
      error => error.code === 'PRACTICE_DUPLICATE_CONTENT'
    )
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_practice_packs')).rows[0].n, 1)

    // Same pack key with altered content is rejected instead of rewritten.
    const rewritten = cloneContent()
    rewritten.questions[0].text_en += ' (changed)'
    const rewrittenReport = await validatePracticePack(rewritten)
    assert.equal(rewrittenReport.ok, true)
    await assert.rejects(
      importPracticePack(client, { content: rewritten, report: rewrittenReport, mode: 'draft' }),
      error => error.code === 'PRACTICE_PACK_CHANGED'
    )
  } finally { await db.close() }
})

test('preview import powers a pattern-exact full mock with hidden keys and correct marking', async () => {
  const { db, client } = await database()
  let http
  try {
    await migrateSscCgl(client, { resetLegacyBank: true })
    await migrateMasterAssembler(client)
    await migratePracticePacks(client)
    const imported = await importPracticePack(client, { content, report, mode: 'preview', importedBy: 'test' })
    assert.equal(imported.imported, true)
    assert.equal(imported.review_status, 'preview_not_human_reviewed')
    assert.equal(imported.reviewer, PREVIEW_REVIEWER)
    assert.match(imported.reviewer, /NOT human reviewed/)

    const packRow = await db.query('SELECT review_status, reviewer, published_at FROM cgl_practice_packs WHERE pack_key=$1', [content.pack.pack_key])
    assert.equal(packRow.rows[0].review_status, 'preview_not_human_reviewed')
    assert.notEqual(packRow.rows[0].published_at, null)
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cgl_questions WHERE status='Published'")).rows[0].n, 100)
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cgl_question_sets WHERE status='Published'")).rows[0].n, 2)

    http = await httpFixture(client)
    const prepared = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Full_Tier1', timing_profile: 'official_2026' } })
    assert.equal(prepared.status, 201, JSON.stringify(prepared.data))
    const mock = prepared.data.mock
    assert.equal(mock.question_count, 100)
    noAnswerLeak(prepared.data)

    const { rows: items } = await db.query(`SELECT q.subject, q.topic, q.difficulty, q.passage_set_id, ps.set_type
      FROM cgl_master_items i JOIN cgl_questions q ON q.id=i.source_id
      LEFT JOIN cgl_question_sets ps ON ps.id=q.passage_set_id WHERE i.mock_id=$1`, [mock.id])
    assert.equal(items.length, 100)
    for (const subject of Object.keys(TIER1_EDITORIAL_TOPICS)) assert.equal(items.filter(item => item.subject === subject).length, 25)
    for (const [subject, topics] of Object.entries(TIER1_EDITORIAL_TOPICS)) {
      for (const [topic, count] of Object.entries(topics)) {
        assert.equal(items.filter(item => item.subject === subject && item.topic === topic).length, count, `${subject} / ${topic}`)
      }
    }
    for (const [difficulty, count] of Object.entries(TIER1_DIFFICULTY)) {
      assert.equal(items.filter(item => item.difficulty === difficulty).length, count, difficulty)
    }
    assert.equal(items.filter(item => item.set_type === 'Data_Interpretation').length, TIER1_EDITORIAL_SETS.Data_Interpretation)
    assert.equal(items.filter(item => item.set_type === 'Cloze_Test').length, TIER1_EDITORIAL_SETS.Cloze_Test)

    const launch = await http.request(`/master/mocks/${mock.id}/launch`, { method: 'POST', user: 1 })
    assert.equal(launch.status, 200, JSON.stringify(launch.data))
    assert.equal(launch.data.questions.length, 25)
    assert.equal(launch.data.timer.current_module.subject, 'Reasoning')
    assert.equal(launch.data.timer.current_module.duration_seconds, 900)
    assert.equal(mock.modules.reduce((total, module) => total + module.duration_seconds, 0), 3600)
    noAnswerLeak(launch.data)
    const first = launch.data.questions[0]
    assert.ok(first.question_text_en && first.question_text_hi)
    assert.equal(first.options.length, 4)
    assert.ok(first.options[0].en && first.options[0].hi)

    const sectional = await http.request('/master/mocks', { method: 'POST', user: 1, body: { category: 'Sectional_Tier1', subject: 'Reasoning', timing_profile: 'official_2026' } })
    assert.equal(sectional.status, 201, JSON.stringify(sectional.data))
    assert.equal(sectional.data.mock.question_count, 25)
    const sectionalLaunch = await http.request(`/master/mocks/${sectional.data.mock.id}/launch`, { method: 'POST', user: 1 })
    assert.equal(sectionalLaunch.status, 200, JSON.stringify(sectionalLaunch.data))
    assert.equal(sectionalLaunch.data.questions.length, 25)
    noAnswerLeak(sectionalLaunch.data)

    const reasoning = content.questions.filter(question => question.subject === 'Reasoning')
    const delivered = sectionalLaunch.data.questions
    const answers = []
    const plan = reasoning.slice(0, 5).map((question, index) => ({
      question,
      chosen: index < 3 ? question.correct : (question.correct + 1) % 4,
    }))
    for (const { question, chosen } of plan) {
      const position = delivered.find(item => item.question_text_en === question.text_en)?.position
      assert.ok(position, `delivered question not found: ${question.qid}`)
      answers.push({ position, selected_option_index: chosen })
    }
    const expected = 3 * 2 - 2 * 0.5
    const save = await http.request(`/master/mocks/${sectional.data.mock.id}/responses`, { method: 'PUT', user: 1, body: { answers } })
    assert.equal(save.status, 200, JSON.stringify(save.data))
    assert.equal((await http.request(`/master/mocks/${sectional.data.mock.id}/review`, { user: 1 })).status, 409, 'Review is hidden before submission')
    const graded = await http.request(`/master/mocks/${sectional.data.mock.id}/submit`, { method: 'POST', user: 1, body: {} })
    assert.equal(graded.status, 200, JSON.stringify(graded.data))
    assert.equal(graded.data.summary.score, expected)
    assert.equal(graded.data.summary.max_score, 50)
    assert.equal(graded.data.summary.correct, 3)
    assert.equal(graded.data.summary.wrong, 2)
    assert.equal(graded.data.summary.skipped, 20)
    assert.ok(graded.data.results.every(result => Number.isInteger(result.correct_option_index)))
    assert.ok(graded.data.results.every(result => result.solution_basic))

    const english = await http.request('/master/mocks', { method: 'POST', user: 2, body: { category: 'Sectional_Tier1', subject: 'English', timing_profile: 'official_2026' } })
    assert.equal(english.status, 201, JSON.stringify(english.data))
    const englishLaunch = await http.request(`/master/mocks/${english.data.mock.id}/launch`, { method: 'POST', user: 2 })
    assert.equal(englishLaunch.status, 200, JSON.stringify(englishLaunch.data))
    const cloze = englishLaunch.data.questions.filter(question => question.passage?.set_type === 'Cloze_Test')
    assert.equal(cloze.length, 5)
    assert.ok(cloze.every(question => question.passage.passage_text_en && question.passage.passage_text_hi))

    const again = await importPracticePack(client, { content, report, mode: 'preview' })
    assert.equal(again.imported, false)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n, 100)
  } finally {
    await http?.close()
    await db.close()
  }
})
