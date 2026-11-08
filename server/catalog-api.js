import { Router } from 'express'
import { CATALOG_VERSION, CATALOG_CHECKSUM, CATALOG_SEED_KEY, CATALOG_DATA_CHECKSUM, readCatalogCounts } from './official-catalog.js'
import { NOTICE_URL, officialBlueprints } from './data/ssc-cgl-official-blueprints.js'

const stages = ['Tier_1', 'Tier_2']
const officialKeys = officialBlueprints.map(item => item.blueprint_key)
const officialKeyByStage = new Map(officialBlueprints.map(item => [item.exam_stage,item.blueprint_key]))
const subjects = ['Quant','Reasoning','English','General_Awareness','Computer_Knowledge']
const asyncRoute = (handler) => (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next)
const disclaimer = 'SSC publishes an indicative syllabus. notice_mapped labels are application mappings; editorial_detail labels are study subdivisions, not an SSC-prescribed chapter list.'
const weightageNote = 'SSC specifies subject-level question allocations, but does not prescribe numerical question counts or marks per topic or subtopic in the 2026 notice.'

// This is checked separately from the existing 001 health gate: an installation
// that has not yet run the additive seeder can still use its existing CGL APIs.
export async function catalogStatus(query) {
  const { rows: [tables] } = await query(`SELECT
    to_regclass('public.cgl_official_blueprints') IS NOT NULL AS blueprints,
    to_regclass('public.cgl_catalog_subjects') IS NOT NULL AS subjects,
    to_regclass('public.cgl_catalog_topics') IS NOT NULL AS topics,
    to_regclass('public.cgl_catalog_subtopics') IS NOT NULL AS subtopics,
    to_regclass('public.cgl_catalog_subtopic_stages') IS NOT NULL AS stages,
    to_regclass('public.cgl_catalog_seed_versions') IS NOT NULL AS seeds`)
  if (!Object.values(tables).every(Boolean)) return { ok: false, code: 'SSC_CGL_CATALOG_SEED_REQUIRED' }
  const { rows: [migration] } = await query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1', [CATALOG_VERSION])
  if (!migration) return { ok: false, code: 'SSC_CGL_CATALOG_SEED_REQUIRED' }
  if (migration.checksum !== CATALOG_CHECKSUM) return { ok: false, code: 'SSC_CGL_CATALOG_SCHEMA_CHECKSUM_MISMATCH' }
  const { rows: [seed] } = await query('SELECT data_checksum,expected_counts FROM cgl_catalog_seed_versions WHERE seed_key=$1', [CATALOG_SEED_KEY])
  if (!seed) return { ok: false, code: 'SSC_CGL_CATALOG_SEED_REQUIRED' }
  if (seed.data_checksum !== CATALOG_DATA_CHECKSUM) return { ok: false, code: 'SSC_CGL_CATALOG_DATA_CHECKSUM_MISMATCH' }
  const counts = await readCatalogCounts(query)
  if (Object.keys(counts).some(key => counts[key] !== seed.expected_counts?.[key])) {
    return { ok: false, code: 'SSC_CGL_CATALOG_INCOMPLETE' }
  }
  return { ok: true, schema_version: CATALOG_VERSION, seed_key: CATALOG_SEED_KEY, notice_year: 2026, counts }
}

function parseFilters(req, { requireStage = false, subjectFromPath = false } = {}) {
  const rawStage = req.query.stage
  const rawSubject = subjectFromPath ? req.params.subject : req.query.subject
  if (rawStage !== undefined && typeof rawStage !== 'string') return { error: 'Invalid stage' }
  if (rawSubject !== undefined && typeof rawSubject !== 'string') return { error: 'Invalid subject' }
  const stage = rawStage === undefined ? null : rawStage
  const subject = rawSubject === undefined ? null : rawSubject
  if ((requireStage && stage === null) || (stage !== null && !stages.includes(stage))) return { error: `stage must be ${stages.join(' or ')}` }
  if (subject !== null && !subjects.includes(subject)) return { error: 'Invalid subject' }
  return { stage, subject }
}

async function buildSubjectTrees(query, stage, subject) {
  const { rows: subjectRows } = await query(`SELECT subject,label,position FROM cgl_catalog_subjects
    WHERE ($1::text IS NULL OR subject=$1) ORDER BY position`, [subject])
  const { rows } = await query(`SELECT t.id AS topic_id,t.name AS topic_name,t.provenance,
      t.subject,st.id AS subtopic_id,st.name AS subtopic_name,m.exam_stage,m.canonical_topic,m.canonical_sub_topic,
      c.notice_year,c.source_url,c.source_sections,
      (shared.subject IS NOT NULL AND EXISTS (SELECT 1 FROM cgl_catalog_subtopic_stages other
        WHERE other.subtopic_id=m.subtopic_id AND other.exam_stage<>m.exam_stage
          AND other.subject=m.subject AND other.canonical_topic=m.canonical_topic
          AND other.canonical_sub_topic=m.canonical_sub_topic)) AS supports_both
    FROM cgl_catalog_topics t
    JOIN cgl_catalog_subtopics st ON st.topic_id=t.id AND st.subject=t.subject
    JOIN cgl_catalog_subtopic_stages m ON m.subtopic_id=st.id AND m.subject=st.subject
    JOIN cgl_syllabus c ON (c.subject,c.topic,c.sub_topic,c.exam_stage)=(m.subject,m.canonical_topic,m.canonical_sub_topic,m.exam_stage)
    LEFT JOIN cgl_syllabus shared ON (shared.subject,shared.topic,shared.sub_topic,shared.exam_stage)=(m.subject,m.canonical_topic,m.canonical_sub_topic,'Both')
    WHERE ($1::text IS NULL OR m.exam_stage=$1) AND ($2::text IS NULL OR t.subject=$2)
    ORDER BY t.subject,CASE t.provenance WHEN 'notice_mapped' THEN 0 ELSE 1 END,t.name,st.name,m.exam_stage`, [stage,subject])
  const tree = subjectRows.map(({subject: code,label}) => ({ subject: code, label, available_in_stage: false, topics: [] }))
  const subjectMap = new Map(tree.map(item => [item.subject,item]))
  const topics = new Map(), subtopics = new Map()
  for (const row of rows) {
    const parent = subjectMap.get(row.subject)
    if (!parent) continue
    parent.available_in_stage = true
    let topic = topics.get(row.topic_id)
    if (!topic) {
      topic = { id:row.topic_id, name:row.topic_name, provenance:row.provenance, subtopics:[] }
      topics.set(row.topic_id,topic); parent.topics.push(topic)
    }
    let subtopic = subtopics.get(row.subtopic_id)
    if (!subtopic) {
      subtopic = { id:row.subtopic_id, name:row.subtopic_name, canonical_mappings:[] }
      subtopics.set(row.subtopic_id,subtopic); topic.subtopics.push(subtopic)
    }
    const canonical_key = { subject:row.subject, topic:row.canonical_topic, sub_topic:row.canonical_sub_topic, exam_stage:row.exam_stage }
    subtopic.canonical_mappings.push({ canonical_key, both_stage_key:row.supports_both ? {...canonical_key,exam_stage:'Both'} : null,
      notice_year:row.notice_year, source_url:row.source_url, source_sections:row.source_sections })
  }
  return tree
}

export function createCatalogRouter({ query }) {
  const router = Router()
  const ready = asyncRoute(async (_req,res,next) => {
    const status = await catalogStatus(query)
    if (!status.ok) return res.status(503).json(status)
    next()
  })
  router.get('/blueprints',ready,asyncRoute(async (req,res) => {
    const {stage,subject,error} = parseFilters(req)
    if (error) return res.status(400).json({error})
    const { rows } = await query(`SELECT blueprint_id,details FROM cgl_official_blueprints
      WHERE ($1::text IS NULL OR exam_stage=$1) AND blueprint_key=ANY($2::text[]) ORDER BY exam_stage`, [stage,officialKeys])
    const matches = subject ? rows.filter(row => row.details.sessions.some(session => session.sections.some(section => section.modules.some(module => module.subject===subject)))) : rows
    res.json({ notice_year:2026, source_url:NOTICE_URL, blueprints:matches.map(row => ({...row.details,mock_blueprint_id:row.blueprint_id})) })
  }))
  router.get('/blueprints/:key',ready,asyncRoute(async (req,res) => {
    const { rows } = await query('SELECT blueprint_id,details FROM cgl_official_blueprints WHERE blueprint_key=$1 AND blueprint_key=ANY($2::text[])', [req.params.key,officialKeys])
    if (!rows.length) return res.status(404).json({error:'Official blueprint not found'})
    res.json({ blueprint:{...rows[0].details,mock_blueprint_id:rows[0].blueprint_id} })
  }))
  router.get('/subjects',ready,asyncRoute(async (req,res) => {
    const {stage,subject,error} = parseFilters(req)
    if (error) return res.status(400).json({error})
    const tree = await buildSubjectTrees(query,stage,subject)
    res.json({ notice_year:2026, source_url:NOTICE_URL, exam_stage:stage, disclaimer, subjects:tree.filter(item => item.available_in_stage) })
  }))
  router.get('/subjects/:subject',ready,asyncRoute(async (req,res) => {
    const {stage,subject,error} = parseFilters(req,{subjectFromPath:true})
    if (error) return res.status(400).json({error})
    const [tree] = await buildSubjectTrees(query,stage,subject)
    if (!tree) return res.status(404).json({error:'Subject not found'})
    res.json({ notice_year:2026, source_url:NOTICE_URL, exam_stage:stage, disclaimer, subject:tree })
  }))
  router.get('/weightages',ready,asyncRoute(async (req,res) => {
    const {stage,subject,error} = parseFilters(req,{requireStage:true})
    if (error) return res.status(400).json({error})
    const { rows: [record] } = await query('SELECT details FROM cgl_official_blueprints WHERE blueprint_key=$1 AND exam_stage=$2', [officialKeyByStage.get(stage),stage])
    if (!record) return res.status(503).json({ok:false,code:'SSC_CGL_CATALOG_INCOMPLETE'})
    const modules = record.details.sessions.flatMap(session => session.sections.flatMap(section => section.modules || []))
    const trees = await buildSubjectTrees(query,stage,subject)
    const bySubject = new Map(trees.map(tree => [tree.subject,tree]))
    const wanted = subject ? [subject] : modules.map(module => module.subject)
    const result = wanted.map(code => {
      const tree = bySubject.get(code)
      const allocation = modules.find(module => module.subject===code)
      return { subject:code, label:tree.label, available_in_stage:!!allocation,
        official_subject_allocation:allocation ? { section_code:allocation.code, question_count:allocation.questions, maximum_marks:allocation.marks, time_limit_seconds:allocation.time_limit_seconds, counts_for_final_merit:allocation.counts_for_merit } : null,
        topics:tree.topics.map(topic => ({ id:topic.id, name:topic.name, provenance:topic.provenance,
          question_count:null, maximum_marks:null, weightage_percentage:null,
          subtopics:topic.subtopics.map(subtopic => ({ id:subtopic.id, name:subtopic.name, question_count:null, maximum_marks:null, weightage_percentage:null })) })) }
    })
    res.json({ notice_year:2026, source_url:NOTICE_URL, exam_stage:stage, topic_weightage_status:'not_prescribed', note:weightageNote, disclaimer, subjects:result })
  }))
  return router
}
