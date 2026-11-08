import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl, MIGRATION_VERSION, MIGRATION_CHECKSUM } from '../server/migration-core.js'
import { seedOfficialCatalog, CATALOG_VERSION, CATALOG_CHECKSUM, CATALOG_DATA_CHECKSUM, CATALOG_SEED_KEY } from '../server/official-catalog.js'

async function fixture() {
  const db = await PGlite.create()
  await db.exec(`CREATE TABLE users(id SERIAL PRIMARY KEY, name TEXT, password_hash TEXT);
    CREATE TABLE attempts(id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id),mode TEXT);
    INSERT INTO users(name,password_hash) VALUES ('learner','preserve-hash');
    INSERT INTO attempts(user_id,mode) VALUES (1,'historical');`)
  const client = { query: (sql,args) => sql.includes('DROP TABLE IF EXISTS mock_test_questions;') || sql.startsWith('-- Additive catalogue only:')
    ? db.exec(sql).then(() => ({rows:[]})) : db.query(sql,args) }
  return { db, client }
}

async function existingData(db) {
  const {rows:[blueprint]}=await db.query("INSERT INTO cgl_mock_blueprints(name,category,exam_stage) VALUES ('Existing draft','Sectional_Tier1','Tier_1') RETURNING id")
  const {rows:[section]}=await db.query(`INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,time_limit_seconds,counts_for_merit)
    VALUES ($1,'Custom','Quant',1,1,2,0.5,60,true) RETURNING id`,[blueprint.id])
  const options=JSON.stringify(['A','B','C','D'].map(x => ({en:x,hi:x})))
  const {rows:[question]}=await db.query(`INSERT INTO cgl_questions(exam_stage,subject,topic,sub_topic,difficulty,question_type,question_text_en,question_text_hi,options,correct_option_index,solution_basic,solution_trick,ideal_time_seconds)
    VALUES ('Both','Quant','Fundamental Arithmetical Operations','Percentages','Easy','Standard_MCQ','Existing question','मौजूदा सवाल',$1,0,'Basic solution','Short solution',30) RETURNING id`,[options])
  const {rows:[mock]}=await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title) VALUES ($1,'Tier_1','Existing draft mock') RETURNING id",[blueprint.id])
  await db.query("INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES ($1,$2,$3,$4,'Quant',1)",[mock.id,blueprint.id,section.id,question.id])
  await db.query(`INSERT INTO cgl_user_attempts(user_id,mock_test_id,blueprint_id,exam_stage,status,merit_out_of,actual_max_merit_score,computer_qualifying_status)
    VALUES (1,$1,$2,'Tier_1','In_Progress',200,2,'Not_Applicable')`,[mock.id,blueprint.id])
  return { blueprint, section, question, mock }
}

const snapshot = async db => (await db.query(`SELECT
  (SELECT password_hash FROM users WHERE id=1) account,
  (SELECT COUNT(*)::int FROM attempts) history,
  (SELECT COUNT(*)::int FROM cgl_questions) questions,
  (SELECT COUNT(*)::int FROM cgl_mock_tests) mocks,
  (SELECT COUNT(*)::int FROM cgl_mock_test_questions) mock_items,
  (SELECT COUNT(*)::int FROM cgl_user_attempts) cgl_attempts`)).rows[0]

test('catalog seed is additive, idempotent, stage-safe and preserves all existing learning data', async () => {
  const {db,client}=await fixture()
  try {
    await assert.rejects(seedOfficialCatalog(client),/migration 001/i)
    assert.equal((await db.query("SELECT to_regclass('public.cgl_official_blueprints') name")).rows[0].name,null)
    await migrateSscCgl(client,{resetLegacyBank:true})
    const data=await existingData(db), before=await snapshot(db)
    // A missing but unreferenced official mapping is restored, not replaced wholesale.
    await db.query("DELETE FROM cgl_syllabus WHERE subject='Quant' AND topic='Number Systems' AND sub_topic='Whole numbers' AND exam_stage='Tier_1'")
    const first=await seedOfficialCatalog(client)
    assert.equal(first.schema_applied,true); assert.equal(first.official_blueprints,2)
    assert.equal(first.subjects,5); assert.ok(first.topics>=75); assert.ok(first.subtopics>=250); assert.ok(first.stage_mappings>=450)
    assert.deepEqual(await snapshot(db),before)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_syllabus')).rows[0].n,311)
    const seedBefore=(await db.query('SELECT applied_at FROM cgl_catalog_seed_versions WHERE seed_key=$1',[CATALOG_SEED_KEY])).rows[0].applied_at
    const second=await seedOfficialCatalog(client)
    assert.equal(second.schema_applied,false)
    assert.deepEqual(await snapshot(db),before)
    const seedAfter=(await db.query('SELECT applied_at FROM cgl_catalog_seed_versions WHERE seed_key=$1',[CATALOG_SEED_KEY])).rows[0].applied_at
    assert.deepEqual(seedAfter,seedBefore,'a repeat seed does not rewrite the seed timestamp')
    const {rows:[versions]}=await db.query(`SELECT
      (SELECT checksum FROM cgl_schema_migrations WHERE version=$1) migration_001,
      (SELECT checksum FROM cgl_schema_migrations WHERE version=$2) migration_002,
      (SELECT data_checksum FROM cgl_catalog_seed_versions WHERE seed_key=$3) data_checksum`,[MIGRATION_VERSION,CATALOG_VERSION,CATALOG_SEED_KEY])
    assert.deepEqual(versions,{migration_001:MIGRATION_CHECKSUM,migration_002:CATALOG_CHECKSUM,data_checksum:CATALOG_DATA_CHECKSUM})
    const {rows:[counts]}=await db.query(`SELECT
      (SELECT COUNT(*)::int FROM cgl_catalog_topics) topics,
      (SELECT COUNT(*)::int FROM cgl_catalog_subtopics) subtopics,
      (SELECT COUNT(*)::int FROM cgl_catalog_subtopic_stages) stage_mappings`)
    assert.deepEqual(counts,{topics:first.topics,subtopics:first.subtopics,stage_mappings:first.stage_mappings})
    await db.query("INSERT INTO cgl_catalog_topics(id,subject,name,provenance) VALUES ('unexpected','Quant','Custom unversioned group','editorial_detail')")
    await assert.rejects(seedOfficialCatalog(client),/row counts conflict/i)
    assert.equal((await db.query("SELECT COUNT(*)::int n FROM cgl_catalog_topics WHERE id='unexpected'")).rows[0].n,1,'unexpected content is never deleted by a seed')
    await db.query("DELETE FROM cgl_catalog_topics WHERE id='unexpected'")
    assert.equal((await db.query("SELECT COUNT(*)::int n FROM cgl_catalog_subtopic_stages WHERE subject='Computer_Knowledge' AND exam_stage='Tier_1'")).rows[0].n,0)
    assert.equal((await db.query(`SELECT COUNT(*)::int n FROM cgl_catalog_subtopic_stages m JOIN cgl_catalog_subtopics s ON s.id=m.subtopic_id JOIN cgl_catalog_topics t ON t.id=s.topic_id
      WHERE t.name='Statistics and Probability' AND t.provenance='editorial_detail' AND m.exam_stage='Tier_1'`)).rows[0].n,0)
    await assert.rejects(db.query("UPDATE cgl_mock_blueprints SET name='incorrect' WHERE name LIKE 'SSC CGL 2026%'") ,/immutable/i)
    await assert.rejects(db.query("DELETE FROM cgl_blueprint_sections WHERE blueprint_id=(SELECT blueprint_id FROM cgl_official_blueprints WHERE exam_stage='Tier_1')"),/immutable/i)
    await assert.rejects(db.query("UPDATE cgl_official_blueprints SET source_url='https://wrong.example'") ,/immutable/i)
    await db.query("UPDATE cgl_mock_blueprints SET name='Existing draft changed' WHERE id=$1",[data.blueprint.id])
    await db.query('UPDATE cgl_blueprint_sections SET time_limit_seconds=90 WHERE id=$1',[data.section.id])
    await assert.rejects(db.query(`UPDATE cgl_catalog_subtopic_stages SET canonical_sub_topic='not a syllabus key'
      WHERE subtopic_id=(SELECT subtopic_id FROM cgl_catalog_subtopic_stages LIMIT 1)`),/foreign key/i)
  } finally { await db.close() }
})

test('a mismatched original blueprint or checksum rolls the entire additive migration back', async () => {
  const {db,client}=await fixture()
  try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    await existingData(db)
    const before=await snapshot(db)
    await db.query("UPDATE cgl_blueprint_sections SET time_limit_seconds=1200 WHERE section_code='Part_A'")
    await assert.rejects(seedOfficialCatalog(client),/blueprint sections differ/i)
    assert.equal((await db.query("SELECT to_regclass('public.cgl_official_blueprints') name")).rows[0].name,null)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_schema_migrations WHERE version=$1',[CATALOG_VERSION])).rows[0].n,0)
    assert.deepEqual(await snapshot(db),before)
    await db.query("UPDATE cgl_blueprint_sections SET time_limit_seconds=900 WHERE section_code='Part_A'")
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',['bad',MIGRATION_VERSION])
    await assert.rejects(seedOfficialCatalog(client),/001.*checksum/i)
    assert.equal((await db.query("SELECT to_regclass('public.cgl_catalog_topics') name")).rows[0].name,null)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',[MIGRATION_CHECKSUM,MIGRATION_VERSION])
    await seedOfficialCatalog(client)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',['bad',CATALOG_VERSION])
    await assert.rejects(seedOfficialCatalog(client),/catalog migration checksum/i)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',[CATALOG_CHECKSUM,CATALOG_VERSION])
    await db.query('UPDATE cgl_catalog_seed_versions SET data_checksum=$1 WHERE seed_key=$2',['bad',CATALOG_SEED_KEY])
    await assert.rejects(seedOfficialCatalog(client),/seed data checksum/i)
    assert.deepEqual(await snapshot(db),before)
  } finally { await db.close() }
})

test('a failure late in seeding leaves no partial catalog, trigger, or recorded migration', async () => {
  const {db,client}=await fixture()
  try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const injected={query:(sql,args) => sql.startsWith('INSERT INTO cgl_catalog_subtopic_stages')
      ? Promise.reject(new Error('simulated late seed failure')) : client.query(sql,args)}
    await assert.rejects(seedOfficialCatalog(injected),/simulated late seed failure/)
    const {rows:[state]}=await db.query(`SELECT to_regclass('public.cgl_catalog_topics') catalog,
      (SELECT COUNT(*)::int FROM cgl_schema_migrations WHERE version=$1) migration`,[CATALOG_VERSION])
    assert.deepEqual(state,{catalog:null,migration:0})
    // The 002 immutability trigger was also rolled back.
    await db.query("UPDATE cgl_mock_blueprints SET name='Temporary' WHERE category='Full_Tier1'")
    await db.query("UPDATE cgl_mock_blueprints SET name='SSC CGL 2026 Tier I — full paper' WHERE category='Full_Tier1'")
    assert.equal((await seedOfficialCatalog(client)).schema_applied,true)
  } finally { await db.close() }
})
