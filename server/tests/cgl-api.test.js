import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl, MIGRATION_CHECKSUM } from '../migration-core.js'
import { createCglRouter } from '../cgl-api.js'

// PGlite provides isolated PostgreSQL semantics; the auth shim represents two
// already authenticated backend users. Real JWT login is tested separately.
test('CGL HTTP routes gate readiness, hide answers, score and isolate attempts', async () => {
  const db = await PGlite.create()
  await db.exec('CREATE TABLE users(id SERIAL PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES')
  const client = {
    query: (sql, args) => sql.includes('DROP TABLE IF EXISTS mock_test_questions;') ? db.exec(sql).then(() => ({ rows: [] })) : db.query(sql, args),
    release: () => {},
  }
  const app = express()
  app.use(express.json())
  const auth = (req, res, next) => {
    if (!['1', '2'].includes(req.get('x-test-user'))) return res.status(401).json({ error: 'Missing token' })
    req.userId = Number(req.get('x-test-user')); next()
  }
  app.use('/api/cgl', createCglRouter({ pool: { connect: async () => client }, query: client.query, auth }))
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const url = `http://127.0.0.1:${server.address().port}/api/cgl`
  const get = (path, user) => fetch(url + path, { headers: user ? { 'x-test-user': String(user) } : {} })
  const post = (path, body, user) => fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': String(user) } : {}) }, body: JSON.stringify(body) })
  try {
    let res = await get('/health'); assert.equal(res.status, 503)
    await migrateSscCgl(client, { resetLegacyBank: true })
    res = await get('/health'); const health = await res.json()
    assert.equal(res.status, 200); assert.equal(health.clean, true); assert.equal(health.counts.questions, 0); assert.equal(health.counts.blueprints, 2)
    await db.query("UPDATE cgl_schema_migrations SET checksum='altered'")
    res = await get('/health'); assert.equal(res.status, 503); assert.equal((await res.json()).code, 'SSC_CGL_SCHEMA_CHECKSUM_MISMATCH')
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1', [MIGRATION_CHECKSUM])
    assert.deepEqual((await (await get('/mock-tests')).json()).mock_tests, [])

    const { rows: [blueprint] } = await db.query("INSERT INTO cgl_mock_blueprints(name,category,exam_stage) VALUES ('Fixture','Sectional_Tier2','Tier_2') RETURNING id")
    const { rows: [quant] } = await db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'I','Quant',1,1,3,1,true) RETURNING id", [blueprint.id])
    const { rows: [computer] } = await db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'III','Computer_Knowledge',2,1,3,1,false) RETURNING id", [blueprint.id])
    const options = JSON.stringify([{ en: 'A', hi: 'अ' }, { en: 'B', hi: 'ब' }, { en: 'C', hi: 'स' }, { en: 'D', hi: 'द' }])
    const insertQuestion = async (stage, subject, topic, subtopic) => (await db.query(`INSERT INTO cgl_questions
      (exam_stage,subject,topic,sub_topic,difficulty,question_type,question_text_en,question_text_hi,options,correct_option_index,solution_basic,solution_trick,ideal_time_seconds,status,source_url,source_citation,reviewed_by,reviewed_at)
      VALUES ($1,$2,$3,$4,'Easy','Standard_MCQ','Fixture question','परीक्षण प्रश्न',$5,1,'Fixture solution','Fixture shortcut',20,'Published','https://ssc.gov.in/','Fixture source','Fixture reviewer',now()) RETURNING id`, [stage,subject,topic,subtopic,options])).rows[0].id
    const q1 = await insertQuestion('Both','Quant','Fundamental Arithmetical Operations','Percentages')
    const q2 = await insertQuestion('Tier_2','Computer_Knowledge','Computer Basics','Computer organization')
    // Metadata is flexible JSON: public reads must not leak embedded answers.
    await db.query('UPDATE cgl_questions SET pyq_meta=$1 WHERE id=$2', [JSON.stringify({is_pyq:false,correct_option_index:1,nested:{solution_basic:'Hidden',final_key_url:'https://example.invalid/key'}}),q1])
    const { rows: [mock] } = await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title) VALUES ($1,'Tier_2','Fixture') RETURNING id", [blueprint.id])
    await db.query('INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES ($1,$2,$3,$4,$5,1),($1,$2,$6,$7,$8,2)', [mock.id,blueprint.id,quant.id,q1,'Quant',computer.id,q2,'Computer_Knowledge'])
    await db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1", [mock.id])

    res = await get(`/mock-tests/${mock.id}`); const paper = await res.json()
    assert.equal(res.status, 200); assert.equal(paper.questions.length, 2)
    assert.ok(!('correct_option_index' in paper.questions[0])); assert.ok(!('solution_basic' in paper.questions[0]))
    assert.deepEqual(paper.questions[0].pyq_meta,{is_pyq:false,nested:{}})
    res = await post('/attempts', { mock_test_id: mock.id, answers: [] }); assert.equal(res.status, 401)
    res = await post('/attempts', { mock_test_id: mock.id, answers: [{ question_id: q1, selected_option_index: 1, option_state: 'Not_Answered', time_spent_seconds: 1 }] }, 1)
    assert.equal(res.status, 400); assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_user_attempts')).rows[0].n, 0)
    res = await post('/attempts', { mock_test_id: mock.id, answers: [
      { question_id: q1, selected_option_index: 0, option_state: 'Answered', time_spent_seconds: 15 },
      { question_id: q2, selected_option_index: 1, option_state: 'Answered_And_Marked', time_spent_seconds: 8 },
    ] }, 1)
    const { attempt } = await res.json(); assert.equal(res.status, 201)
    assert.equal(attempt.merit_score, -1); assert.equal(attempt.merit_out_of, 390); assert.equal(attempt.actual_max_merit_score, 3)
    assert.equal(attempt.computer_score, 3); assert.equal(attempt.computer_qualifying_status, 'Pending'); assert.equal(attempt.time_spent_seconds, 23)
    res = await get(`/attempts/${attempt.id}`, 1); const saved = (await res.json()).attempt
    assert.equal(saved.sections.length, 2); assert.equal(saved.answers[0].correct_option_index, 1); assert.equal(saved.answers[0].solution_basic, 'Fixture solution')
    res = await get(`/attempts/${attempt.id}`, 2); assert.equal(res.status, 404)
    res = await get('/health'); assert.equal((await res.json()).clean, false)
  } finally { await new Promise(resolve => server.close(resolve)); await db.close() }
})
