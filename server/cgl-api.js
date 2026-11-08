import {redactPublicQuestion} from './public-question.js'
import {lockLearnerContent} from './learner-content-lock.js'
import { createMasterRouter } from './master-api.js'
import { masterStatus } from './master-migration.js'
import { Router } from 'express'
import { gradeCglAttempt, AttemptValidationError } from './cgl-scoring.js'
import { MIGRATION_VERSION, MIGRATION_CHECKSUM } from './migration-core.js'
import { catalogStatus, createCatalogRouter } from './catalog-api.js'
import { pyqStatus, createPyqRouter } from './pyq-api.js'
import { caStatus, createCaRouter } from './ca-api.js'

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const positiveId = (value) => typeof value === 'string' && /^[1-9][0-9]{0,17}$/.test(value)

async function cglSchemaStatus(query) {
  const { rows: [tables] } = await query(`SELECT
    to_regclass('public.cgl_schema_migrations') IS NOT NULL AS migrations,
    to_regclass('public.cgl_syllabus') IS NOT NULL AS syllabus,
    to_regclass('public.cgl_questions') IS NOT NULL AS questions,
    to_regclass('public.cgl_question_sets') IS NOT NULL AS sets,
    to_regclass('public.cgl_mock_blueprints') IS NOT NULL AS blueprints,
    to_regclass('public.cgl_blueprint_sections') IS NOT NULL AS sections,
    to_regclass('public.cgl_mock_tests') IS NOT NULL AS mocks,
    to_regclass('public.cgl_mock_test_questions') IS NOT NULL AS mock_questions,
    to_regclass('public.cgl_user_attempts') IS NOT NULL AS attempts,
    to_regclass('public.cgl_attempt_sections') IS NOT NULL AS attempt_sections,
    to_regclass('public.cgl_attempt_answers') IS NOT NULL AS answers,
    (to_regclass('public.questions') IS NOT NULL OR to_regclass('public.question_sets') IS NOT NULL) AS legacy_questions,
    (to_regclass('public.mock_tests') IS NOT NULL OR to_regclass('public.mock_blueprints') IS NOT NULL
     OR to_regclass('public.mock_test_questions') IS NOT NULL) AS legacy_mocks`)
  const required = ['migrations','syllabus','questions','sets','blueprints','sections','mocks','mock_questions','attempts','attempt_sections','answers']
  if (!required.every((key) => tables[key]) || tables.legacy_questions || tables.legacy_mocks) {
    return { ok: false, code: 'SSC_CGL_MIGRATION_REQUIRED', legacy_question_schema_present: tables.legacy_questions, legacy_mock_schema_present: tables.legacy_mocks }
  }
  const { rows: versions } = await query('SELECT version, checksum FROM cgl_schema_migrations WHERE version = $1', [MIGRATION_VERSION])
  if (!versions.length) return { ok: false, code: 'SSC_CGL_MIGRATION_REQUIRED' }
  if (versions[0].checksum !== MIGRATION_CHECKSUM) return { ok: false, code: 'SSC_CGL_SCHEMA_CHECKSUM_MISMATCH' }
  return { ok: true, schema_version: MIGRATION_VERSION }
}

export async function cglHealth(query) {
  const schema = await cglSchemaStatus(query)
  if (!schema.ok) return schema
  const { rows: [counts] } = await query(`SELECT
    (SELECT COUNT(*)::int FROM cgl_questions) AS questions,
    (SELECT COUNT(*)::int FROM cgl_question_sets) AS question_sets,
    (SELECT COUNT(*)::int FROM cgl_mock_tests) AS mock_tests,
    (SELECT COUNT(*)::int FROM cgl_user_attempts) AS user_attempts,
    (SELECT COUNT(*)::int FROM cgl_mock_blueprints) AS blueprints,
    (SELECT COUNT(*)::int FROM cgl_syllabus) AS syllabus_mappings`)
  const catalog = await catalogStatus(query)
  const pyq_vault = await pyqStatus(query)
  const current_affairs = await caStatus(query)
  const master_assembler = await masterStatus(query)
  return { ok: true, schema_version: MIGRATION_VERSION, catalog, pyq_vault, current_affairs, master_assembler, clean: counts.questions === 0 && counts.question_sets === 0 && counts.mock_tests === 0 && counts.user_attempts === 0, questions: counts.questions, counts, legacy_question_schema_present: false, legacy_mock_schema_present: false }
}

export function createCglRouter({ pool, query, auth, mentorOptions }) {
  const router = Router()
  // Live timers, answers and owner-specific reviews must never be replayed from
  // a browser, Vercel or intermediary cache after a refresh.
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
  router.get('/health', asyncRoute(async (_req, res) => {
    try {
      const result = await cglHealth(query)
      res.status(result.ok ? 200 : 503).json(result)
    } catch (error) {
      console.error('SSC CGL health check failed:', error.message)
      res.status(503).json({ ok: false, code: 'DATABASE_UNAVAILABLE' })
    }
  }))
  router.use(asyncRoute(async (_req, res, next) => {
    const result = await cglSchemaStatus(query)
    if (!result.ok) return res.status(503).json(result)
    next()
  }))
  router.use(createCatalogRouter({ query }))
  router.use(createPyqRouter({ pool, query, auth }))
  router.use(createCaRouter({ pool, query, auth }))
  router.use(createMasterRouter({ pool, query, auth, mentorOptions }))
  router.get('/syllabus', asyncRoute(async (req, res) => {
    const stage = req.query.stage ? String(req.query.stage) : null
    const subject = req.query.subject ? String(req.query.subject) : null
    if (stage && !['Tier_1','Tier_2','Both'].includes(stage)) return res.status(400).json({ error: 'Invalid stage' })
    if (subject && !['Quant','Reasoning','English','General_Awareness','Computer_Knowledge'].includes(subject)) return res.status(400).json({ error: 'Invalid subject' })
    const { rows } = await query(`SELECT subject, topic, sub_topic, exam_stage, notice_year, source_url, source_sections FROM cgl_syllabus
      WHERE ($1::text IS NULL OR exam_stage = $1) AND ($2::text IS NULL OR subject = $2) ORDER BY subject, topic, sub_topic, exam_stage`, [stage, subject])
    res.json({ mappings: rows })
  }))
  router.get('/mock-tests', asyncRoute(async (_req, res) => {
    const { rows } = await query(`SELECT m.id, m.title, m.exam_stage, b.category, b.notice_year
      FROM cgl_mock_tests m JOIN cgl_mock_blueprints b ON b.id=m.blueprint_id WHERE m.status='Published' ORDER BY m.id`)
    res.json({ mock_tests: rows })
  }))
  router.get('/mock-tests/:id', asyncRoute(async (req, res) => {
    if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Invalid mock ID' })
    const { rows: tests } = await query(`SELECT m.id, m.title, m.exam_stage, b.category
      FROM cgl_mock_tests m JOIN cgl_mock_blueprints b ON b.id=m.blueprint_id WHERE m.id=$1 AND m.status='Published'`, [req.params.id])
    if (!tests.length) return res.status(404).json({ error: 'Mock not found' })
    // Do not expose correct answers or solutions before submission.
    const { rows: questions } = await query(`SELECT q.id, q.exam_stage, q.subject, q.topic, q.sub_topic, q.difficulty, q.question_type,
      q.passage_set_id, q.question_text_en, q.question_text_hi, q.media_svg_or_url, q.options, q.pyq_meta, q.current_affairs_meta,
      mq.position, s.section_code, s.time_limit_seconds,
      CASE WHEN ps.id IS NULL THEN NULL ELSE jsonb_build_object('id',ps.id,'set_type',ps.set_type,'passage_text_en',ps.passage_text_en,'passage_text_hi',ps.passage_text_hi,'media_svg_or_url',ps.media_svg_or_url,'chart_data',ps.chart_data) END AS passage_set
      FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id=mq.question_id
      JOIN cgl_blueprint_sections s ON s.id=mq.section_id LEFT JOIN cgl_question_sets ps ON ps.id=q.passage_set_id
      WHERE mq.mock_test_id=$1 ORDER BY mq.position`, [req.params.id])
    res.json({ mock_test: tests[0], questions: questions.map(redactPublicQuestion) })
  }))
  router.post('/attempts', auth, asyncRoute(async (req, res) => {
    const mockId = String(req.body?.mock_test_id ?? '')
    if (!positiveId(mockId) || !Array.isArray(req.body?.answers)) return res.status(400).json({ error: 'mock_test_id and answers[] are required' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await lockLearnerContent(client,req.userId)
      const { rows: tests } = await client.query("SELECT id, blueprint_id, exam_stage FROM cgl_mock_tests WHERE id=$1 AND status='Published' FOR SHARE", [mockId])
      if (!tests.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Published mock not found' }) }
      const mock = tests[0]
      const { rows } = await client.query(`SELECT mq.question_id, mq.section_id, mq.subject, q.correct_option_index,
        s.section_code, s.correct_marks, s.wrong_deduction, s.counts_for_merit
        FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id=mq.question_id
        JOIN cgl_blueprint_sections s ON s.id=mq.section_id WHERE mq.mock_test_id=$1 ORDER BY mq.position`, [mockId])
      const result = gradeCglAttempt(mock.exam_stage, rows, req.body.answers)
      const { rows: [attempt] } = await client.query(`INSERT INTO cgl_user_attempts
        (user_id,mock_test_id,blueprint_id,exam_stage,status,submitted_at,time_spent_seconds,merit_score,merit_out_of,actual_max_merit_score,computer_score,computer_max_score,computer_qualifying_status)
        VALUES ($1,$2,$3,$4,'Submitted',NOW(),$5,$6,$7,$8,$9,$10,$11) RETURNING id,started_at,submitted_at`,
        [req.userId,mock.id,mock.blueprint_id,mock.exam_stage,result.time_spent_seconds,result.merit_score,result.merit_out_of,result.actual_max_merit_score,result.computer_score,result.computer_max_score,result.computer_qualifying_status])
      for (const section of result.sections) await client.query(`INSERT INTO cgl_attempt_sections
        (attempt_id,mock_test_id,blueprint_id,section_id,subject,question_count,correct_count,wrong_count,skipped_count,score,max_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [attempt.id,mock.id,mock.blueprint_id,section.section_id,section.subject,section.question_count,section.correct_count,section.wrong_count,section.skipped_count,section.score,section.max_score])
      for (const answer of result.answers) await client.query(`INSERT INTO cgl_attempt_answers
        (attempt_id,mock_test_id,question_id,selected_option_index,option_state,time_spent_seconds,is_correct,awarded_marks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [attempt.id,mock.id,answer.question_id,answer.selected_option_index,answer.option_state,answer.time_spent_seconds,answer.is_correct,answer.awarded_marks])
      await client.query('COMMIT')
      res.status(201).json({ attempt: { ...attempt, mock_test_id: mockId, exam_stage: mock.exam_stage, ...result } })
    } catch (error) {
      await client.query('ROLLBACK')
      if (error instanceof AttemptValidationError) return res.status(400).json({ error: error.message })
      throw error
    } finally { client.release() }
  }))
  router.get('/attempts', auth, asyncRoute(async (req, res) => {
    const { rows } = await query(`SELECT id,mock_test_id,exam_stage,status,started_at,submitted_at,time_spent_seconds,merit_score,merit_out_of,actual_max_merit_score,computer_score,computer_max_score,computer_qualifying_status
      FROM cgl_user_attempts WHERE user_id=$1 ORDER BY started_at DESC LIMIT 100`, [req.userId])
    res.json({ attempts: rows })
  }))
  router.get('/attempts/:id', auth, asyncRoute(async (req, res) => {
    if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Invalid attempt ID' })
    const { rows: attempts } = await query('SELECT id,mock_test_id,exam_stage,status,started_at,submitted_at,time_spent_seconds,merit_score,merit_out_of,actual_max_merit_score,computer_score,computer_max_score,computer_qualifying_status FROM cgl_user_attempts WHERE id=$1 AND user_id=$2', [req.params.id,req.userId])
    if (!attempts.length) return res.status(404).json({ error: 'Attempt not found' })
    const { rows: sections } = await query('SELECT section_id,subject,question_count,correct_count,wrong_count,skipped_count,score,max_score FROM cgl_attempt_sections WHERE attempt_id=$1 ORDER BY section_id', [req.params.id])
    // Review material is available only to the owner after submission, never
    // while a mock is being taken. Published question content is immutable.
    const { rows: answers } = await query(`SELECT a.question_id,a.selected_option_index,a.option_state,a.time_spent_seconds,a.is_correct,a.awarded_marks,
      CASE WHEN $2 = 'Submitted' THEN q.correct_option_index END AS correct_option_index,
      CASE WHEN $2 = 'Submitted' THEN q.solution_basic END AS solution_basic,
      CASE WHEN $2 = 'Submitted' THEN q.solution_trick END AS solution_trick,
      CASE WHEN $2 = 'Submitted' THEN q.ideal_time_seconds END AS ideal_time_seconds
      FROM cgl_attempt_answers a JOIN cgl_questions q ON q.id=a.question_id WHERE a.attempt_id=$1 ORDER BY a.question_id`, [req.params.id, attempts[0].status])
    res.json({ attempt: { ...attempts[0], sections, answers } })
  }))
  router.use((err, _req, res, _next) => {
    console.error('SSC CGL API error:', err.message)
    res.status(500).json({ error: 'Database operation failed' })
  })
  return router
}
