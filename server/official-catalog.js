import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { MIGRATION_VERSION, MIGRATION_CHECKSUM, syllabus } from './migration-core.js'
import { NOTICE_URL, officialBlueprints } from './data/ssc-cgl-official-blueprints.js'
import { studyTopics } from './data/ssc-cgl-study-topics.js'

export const CATALOG_VERSION = '002_ssc_cgl_official_catalog'
export const CATALOG_SEED_KEY = 'ssc_cgl_2026_official_and_editorial_v1'
const sql = await readFile(new URL('./migrations/002_ssc_cgl_official_catalog.sql', import.meta.url), 'utf8')
export const CATALOG_CHECKSUM = createHash('sha256').update(sql).digest('hex')
const key = (prefix, ...parts) => `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24)}`
const subjects = [
  ['Reasoning','General Intelligence and Reasoning',1],
  ['General_Awareness','General Awareness',2],
  ['Quant','Quantitative Aptitude / Mathematical Abilities',3],
  ['English','English Comprehension / Language and Comprehension',4],
  ['Computer_Knowledge','Computer Knowledge',5],
]
export const CATALOG_DATA_CHECKSUM = createHash('sha256').update(JSON.stringify({ officialBlueprints, studyTopics, syllabus, subjects, id_scheme: 'sha256-96-v1' })).digest('hex')

export async function readCatalogCounts(query) {
  const { rows: [counts] } = await query(`SELECT
    (SELECT COUNT(*)::int FROM cgl_official_blueprints WHERE blueprint_key = ANY($1::text[])) AS blueprints,
    (SELECT COUNT(*)::int FROM cgl_catalog_subjects) AS subjects,
    (SELECT COUNT(*)::int FROM cgl_catalog_topics) AS topics,
    (SELECT COUNT(*)::int FROM cgl_catalog_subtopics) AS subtopics,
    (SELECT COUNT(*)::int FROM cgl_catalog_subtopic_stages) AS stage_mappings`, [officialBlueprints.map(item => item.blueprint_key)])
  return counts
}

async function insertRows(client, table, columns, rows, conflict) {
  for (let offset=0; offset<rows.length; offset+=200) {
    const values=[]
    const placeholders=rows.slice(offset, offset+200).map(row => `(${row.map(value => { values.push(value); return `$${values.length}` }).join(',')})`)
    await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders.join(',')} ${conflict}`, values)
  }
}

function expectedSyllabusRows() {
  const rows=[]
  for (const topic of syllabus.topics) for (const sub of topic.sub_topics) {
    const stages=[...topic.stages]
    if (stages.includes('Tier_1') && stages.includes('Tier_2')) stages.push('Both')
    for (const stage of stages) rows.push([topic.subject, topic.topic, sub, stage, 2026, syllabus.source_url, topic.source_sections])
  }
  return rows
}

async function seedInTransaction(client) {
  const { rows: [previousSeed] } = await client.query('SELECT data_checksum FROM cgl_catalog_seed_versions WHERE seed_key=$1 FOR UPDATE', [CATALOG_SEED_KEY])
  if (previousSeed && previousSeed.data_checksum !== CATALOG_DATA_CHECKSUM) {
    throw new Error('Applied catalog seed data checksum differs; create a new versioned seed')
  }
  // Restore missing canonical rows without modifying existing question mappings.
  const canonical = expectedSyllabusRows()
  await insertRows(client, 'cgl_syllabus', ['subject','topic','sub_topic','exam_stage','notice_year','source_url','source_sections'], canonical, 'ON CONFLICT (subject,topic,sub_topic,exam_stage) DO NOTHING')
  const { rows: actual } = await client.query('SELECT subject,topic,sub_topic,exam_stage,notice_year,source_url,source_sections FROM cgl_syllabus')
  const index=new Map(actual.map(row => [JSON.stringify([row.subject,row.topic,row.sub_topic,row.exam_stage]),row]))
  const officialKeys=new Set(canonical.map(row => JSON.stringify(row.slice(0,4))))
  for (const row of canonical) {
    const record=index.get(JSON.stringify(row.slice(0,4)))
    if (!record || record.notice_year !== row[4] || record.source_url !== row[5] || record.source_sections !== row[6]) {
      throw new Error(`Canonical syllabus mapping conflicts with the 2026 source: ${row.slice(0,4).join(' / ')}`)
    }
  }

  // Validate the existing immutable mock templates before linking official rules.
  for (const blueprint of officialBlueprints) {
    const { rows: matches } = await client.query(`SELECT id FROM cgl_mock_blueprints
      WHERE name=$1 AND category=$2 AND exam_stage=$3 AND notice_year=$4 AND source_url=$5
        AND target_subject IS NULL AND target_topic IS NULL AND target_sub_topic IS NULL AND ca_year IS NULL AND ca_month IS NULL FOR UPDATE`,
      [blueprint.blueprint_name, blueprint.category, blueprint.exam_stage, blueprint.notice_year, blueprint.source_url])
    if (matches.length !== 1) throw new Error(`Expected one 2026 mock blueprint for ${blueprint.blueprint_key}; found ${matches.length}`)
    const id=matches[0].id
    const { rows: sections }=await client.query('SELECT section_code,subject,position,question_count,correct_marks,wrong_deduction,time_limit_seconds,counts_for_merit FROM cgl_blueprint_sections WHERE blueprint_id=$1 ORDER BY position FOR UPDATE', [id])
    const modules=blueprint.sessions.flatMap(session => session.sections.flatMap(section => section.modules || []))
    if (sections.length !== modules.length || modules.some((m,i) => {
      const s=sections[i]
      return !s || s.section_code!==m.code || s.subject!==m.subject || s.position!==i+1 || s.question_count!==m.questions ||
        m.marks!==m.questions*blueprint.marking.correct ||
        Number(s.correct_marks)!==blueprint.marking.correct || Number(s.wrong_deduction)!==-blueprint.marking.wrong ||
        s.time_limit_seconds!==m.time_limit_seconds || s.counts_for_merit!==(blueprint.exam_stage==='Tier_1' ? true : m.counts_for_merit)
    })) throw new Error(`2026 blueprint sections differ from official rules: ${blueprint.blueprint_key}`)
    await client.query(`INSERT INTO cgl_official_blueprints(blueprint_key,blueprint_id,exam_stage,notice_year,source_url,details)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (blueprint_key) DO NOTHING`,
      [blueprint.blueprint_key,id,blueprint.exam_stage,blueprint.notice_year,blueprint.source_url,JSON.stringify(blueprint)])
    const { rows: [stored] }=await client.query('SELECT blueprint_id,exam_stage,notice_year,source_url,details FROM cgl_official_blueprints WHERE blueprint_key=$1', [blueprint.blueprint_key])
    // JSONB key order is not significant in PostgreSQL; use database equality.
    const { rows: [same] }=await client.query('SELECT details=$2::jsonb AS matches FROM cgl_official_blueprints WHERE blueprint_key=$1', [blueprint.blueprint_key, JSON.stringify(blueprint)])
    if (!stored || String(stored.blueprint_id)!==String(id) || stored.exam_stage!==blueprint.exam_stage || stored.notice_year!==2026 || stored.source_url!==NOTICE_URL || !same.matches) {
      throw new Error(`Official blueprint snapshot differs; add a versioned record instead: ${blueprint.blueprint_key}`)
    }
  }

  await insertRows(client,'cgl_catalog_subjects',['subject','label','position'],subjects,
    'ON CONFLICT (subject) DO UPDATE SET label=EXCLUDED.label, position=EXCLUDED.position')
  const topicRows=[], subRows=[], mappingRows=[]
  const knownTopics=new Set(),knownSubs=new Set(),knownMappings=new Set()
  function addTopic(subject,name,provenance) {
    const id=key('topic',subject,name,provenance)
    if (!knownTopics.has(id)) { knownTopics.add(id); topicRows.push([id,subject,name,provenance]) }
    return id
  }
  function addSub(topicId,subject,name) {
    const id=key('sub',topicId,name)
    if (!knownSubs.has(id)) { knownSubs.add(id); subRows.push([id,topicId,subject,name]) }
    return id
  }
  function addMapping(id,subject,stage,topic,sub) {
    const k=JSON.stringify([id,stage])
    if (knownMappings.has(k)) throw new Error(`Duplicate catalogue mapping: ${k}`)
    knownMappings.add(k); mappingRows.push([id,subject,stage,topic,sub])
  }
  for (const row of canonical.filter(item => item[3] !== 'Both')) {
    const [subject,topic,sub,stage]=row
    addMapping(addSub(addTopic(subject,topic,'notice_mapped'),subject,sub),subject,stage,topic,sub)
  }
  for (const group of studyTopics) {
    const topicId=addTopic(group.subject,group.name,'editorial_detail')
    for (const child of group.children) {
      const name=Array.isArray(child) ? child[0] : child
      const parent=Array.isArray(child) ? child[1] : group.parent
      const stageOverrides={...group.stageOverrides, ...(Array.isArray(child) ? child[2] : {})}
      const subId=addSub(topicId,group.subject,name)
      let found=0
      for (const stage of ['Tier_1','Tier_2']) {
        const [canonicalTopic, canonicalSubtopic]=stageOverrides[stage] || [group.topic,parent]
        if (officialKeys.has(JSON.stringify([group.subject,canonicalTopic,canonicalSubtopic,stage]))) {
          addMapping(subId,group.subject,stage,canonicalTopic,canonicalSubtopic); found++
        }
      }
      if (!found) throw new Error(`Study detail has no notice-mapped parent: ${group.subject} / ${group.name} / ${name}`)
    }
  }
  await insertRows(client,'cgl_catalog_topics',['id','subject','name','provenance'],topicRows,
    'ON CONFLICT (id) DO UPDATE SET subject=EXCLUDED.subject,name=EXCLUDED.name,provenance=EXCLUDED.provenance')
  await insertRows(client,'cgl_catalog_subtopics',['id','topic_id','subject','name'],subRows,
    'ON CONFLICT (id) DO UPDATE SET topic_id=EXCLUDED.topic_id,subject=EXCLUDED.subject,name=EXCLUDED.name')
  await insertRows(client,'cgl_catalog_subtopic_stages',['subtopic_id','subject','exam_stage','canonical_topic','canonical_sub_topic'],mappingRows,
    'ON CONFLICT (subtopic_id,exam_stage) DO UPDATE SET subject=EXCLUDED.subject,canonical_topic=EXCLUDED.canonical_topic,canonical_sub_topic=EXCLUDED.canonical_sub_topic')
  const expectedCounts={ subjects:subjects.length, topics:topicRows.length, subtopics:subRows.length, stage_mappings:mappingRows.length, blueprints:officialBlueprints.length }
  const actualCounts = await readCatalogCounts(client.query.bind(client))
  if (Object.keys(expectedCounts).some(field => actualCounts[field] !== expectedCounts[field])) {
    throw new Error('Catalog row counts conflict with this seed; investigate unexpected rows rather than deleting them')
  }
  await client.query(`INSERT INTO cgl_catalog_seed_versions(seed_key,data_checksum,expected_counts) VALUES ($1,$2,$3)
    ON CONFLICT(seed_key) DO NOTHING`, [CATALOG_SEED_KEY,CATALOG_DATA_CHECKSUM,JSON.stringify(expectedCounts)])
  const { rows: [sameCounts] } = await client.query('SELECT expected_counts=$2::jsonb AS matches FROM cgl_catalog_seed_versions WHERE seed_key=$1', [CATALOG_SEED_KEY,JSON.stringify(expectedCounts)])
  if (!sameCounts.matches) throw new Error('Catalog seed expected counts differ; investigate or create a new versioned seed')
  return { notice_year:2026, subjects:subjects.length, topics:topicRows.length, subtopics:subRows.length, stage_mappings:mappingRows.length, official_blueprints:officialBlueprints.length }
}

// Additive and safe to rerun. DDL and seed are one transaction; no bank reset.
// A dedicated client is required for the advisory lock and transaction.
export async function seedOfficialCatalog(client) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)',[729002])
    const { rows: [present] }=await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
    if (!present.present) throw new Error('Apply SSC CGL migration 001 before seeding the official catalog')
    const { rows: versions }=await client.query('SELECT version,checksum FROM cgl_schema_migrations WHERE version IN ($1,$2)',[MIGRATION_VERSION,CATALOG_VERSION])
    const prior=versions.find(v=>v.version===MIGRATION_VERSION)
    if (!prior || prior.checksum!==MIGRATION_CHECKSUM) throw new Error('SSC CGL migration 001 is missing or its checksum differs')
    const existing=versions.find(v=>v.version===CATALOG_VERSION)
    if (existing && existing.checksum!==CATALOG_CHECKSUM) throw new Error('SSC CGL catalog migration checksum differs; create a new migration')
    if (!existing) {
      await client.query(sql)
      await client.query('INSERT INTO cgl_schema_migrations(version,checksum) VALUES($1,$2)',[CATALOG_VERSION,CATALOG_CHECKSUM])
    }
    const counts=await seedInTransaction(client)
    await client.query('COMMIT')
    return { schema_applied:!existing, seed_key:CATALOG_SEED_KEY, ...counts }
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
