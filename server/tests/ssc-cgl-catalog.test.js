import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl } from '../migration-core.js'
import { seedOfficialCatalog, CATALOG_CHECKSUM, CATALOG_DATA_CHECKSUM, CATALOG_VERSION, CATALOG_SEED_KEY } from '../official-catalog.js'
import { createCglRouter } from '../cgl-api.js'

const findTopic = (tree,name) => tree.topics.find(topic => topic.name===name && topic.provenance==='editorial_detail')
const findChild = (topic,name) => topic.subtopics.find(subtopic => subtopic.name===name)

test('catalog HTTP endpoints expose 2026 rules, mapped subject trees and unknown topic weights', async () => {
  const db=await PGlite.create()
  await db.exec('CREATE TABLE users(id SERIAL PRIMARY KEY)')
  const client={query:(sql,args)=>sql.includes('DROP TABLE IF EXISTS mock_test_questions;') || sql.startsWith('-- Additive catalogue only:')
    ? db.exec(sql).then(()=>({rows:[]})) : db.query(sql,args),release:()=>{}}
  const app=express()
  app.use('/api/cgl',createCglRouter({pool:{connect:async()=>client},query:client.query,auth:(_req,_res,next)=>next()}))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const get=async path=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/cgl${path}`); return {status:response.status, body:await response.json()}}
  try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    let result=await get('/health')
    assert.equal(result.status,200); assert.equal(result.body.catalog.ok,false); assert.equal(result.body.catalog.code,'SSC_CGL_CATALOG_SEED_REQUIRED')
    for(const path of ['/blueprints','/subjects','/weightages?stage=Tier_1']) {
      result=await get(path); assert.equal(result.status,503); assert.equal(result.body.code,'SSC_CGL_CATALOG_SEED_REQUIRED')
    }
    assert.equal((await get('/syllabus')).status,200,'existing API remains usable before additive seed')
    await seedOfficialCatalog(client)
    result=await get('/health'); assert.equal(result.body.catalog.ok,true); assert.equal(result.body.clean,true)
    assert.equal(result.body.counts.questions,0); assert.equal(result.body.counts.mock_tests,0)

    const allBlueprints=(await get('/blueprints')).body.blueprints
    assert.equal(allBlueprints.length,2)
    const tier1=allBlueprints.find(b=>b.exam_stage==='Tier_1')
    const tier2=allBlueprints.find(b=>b.exam_stage==='Tier_2')
    assert.equal(tier1.notice_year,2026); assert.match(tier1.source_url,/Notice_of_adv_cgl_2026\.pdf$/)
    assert.deepEqual([tier1.total_questions,tier1.total_marks,tier1.duration_seconds],[100,200,3600])
    assert.deepEqual(tier1.marking,{correct:2,wrong:-0.5,unanswered:0})
    assert.equal(tier1.merit.contributes_to_final_merit,false)
    assert.equal(tier1.navigation.free_section_switching,false)
    assert.deepEqual(tier1.sessions[0].sections.map(s=>s.modules[0]).map(m=>[m.subject,m.questions,m.marks,m.time_limit_seconds]),[
      ['Reasoning',25,50,900],['General_Awareness',25,50,900],['Quant',25,50,900],['English',25,50,900]])
    assert.deepEqual(tier1.qualification.minimum_percentages,{UR:30,OBC_EWS:25,Others:20})
    assert.deepEqual([tier2.total_questions,tier2.total_marks,tier2.duration_seconds,tier2.full_paper_i_active_duration_seconds],[150,450,8100,9000])
    assert.deepEqual(tier2.marking,{correct:3,wrong:-1,unanswered:0})
    assert.equal(tier2.merit.merit_out_of,390); assert.equal(tier2.merit.qualifying_computer_marks,60)
    assert.equal(tier2.qualification.minimum_percentages.OBC_EWS,25)
    assert.match(tier2.qualification.note,/higher computer standards/i)
    assert.deepEqual(tier2.sessions[0].sections.flatMap(s=>s.modules).map(m=>[m.subject,m.questions,m.marks,m.time_limit_seconds,m.counts_for_merit]),[
      ['Quant',30,90,1800,true],['Reasoning',30,90,1800,true],['English',45,135,2400,true],['General_Awareness',25,75,1200,true],['Computer_Knowledge',20,60,900,false]])
    assert.equal(tier2.sessions[1].sections[0].code,'Section_IV'); assert.equal(tier2.sessions[1].sections[0].qualifying_only,true)
    assert.equal((await get('/blueprints?stage=Tier_1')).body.blueprints.length,1)
    assert.equal((await get('/blueprints?subject=Computer_Knowledge')).body.blueprints.length,1)
    assert.equal((await get('/blueprints?stage=Tier_1&subject=Computer_Knowledge')).body.blueprints.length,0)
    assert.equal((await get(`/blueprints/${tier2.blueprint_key}`)).body.blueprint.exam_stage,'Tier_2')
    assert.equal((await get('/blueprints/no-such-rule')).status,404)
    for(const path of ['/blueprints?stage=Both','/blueprints?stage=','/subjects?stage=Tier_3','/subjects?subject=Unknown','/weightages','/weightages?stage=Tier_2&subject=Nope','/subjects?subject=Quant&subject=English','/subjects?stage%5Bfoo%5D=Tier_1','/subjects?stage%5B%5D=Tier_1']) {
      assert.equal((await get(path)).status,400,path)
    }

    const all=(await get('/subjects')).body
    assert.equal(all.subjects.length,5); assert.match(all.disclaimer,/editorial_detail/)
    const tier1Tree=(await get('/subjects?stage=Tier_1')).body.subjects
    assert.deepEqual(tier1Tree.map(s=>s.subject),['Reasoning','General_Awareness','Quant','English'])
    const quant1=tier1Tree.find(s=>s.subject==='Quant')
    assert.ok(findTopic(quant1,'Mensuration 2D and 3D')); assert.equal(findTopic(quant1,'Statistics and Probability'),undefined)
    const quant2=(await get('/subjects/Quant?stage=Tier_2')).body.subject
    assert.ok(findChild(findTopic(quant2,'Statistics and Probability'),'Simple probability'))
    const interest=findChild(findTopic(quant2,'Simple and Compound Interest'),'Simple interest')
    assert.equal(interest.canonical_mappings[0].canonical_key.sub_topic,'Simple interest')
    assert.equal(interest.canonical_mappings[0].both_stage_key.exam_stage,'Both')
    assert.equal(findChild(findTopic(quant2,'Mensuration 2D and 3D'),'Frustum').canonical_mappings[0].canonical_key.sub_topic,'Right circular cone')
    const reasoning=(await get('/subjects/Reasoning')).body.subject
    const blood=findChild(findTopic(reasoning,'Blood Relations'),'Blood relations')
    assert.deepEqual(blood.canonical_mappings.map(m=>m.canonical_key.exam_stage).sort(),['Tier_1','Tier_2'])
    assert.ok(blood.canonical_mappings.every(m=>m.both_stage_key===null),'different editorial anchors do not claim a shared both-stage mapping')
    const ga=(await get('/subjects/General_Awareness?stage=Tier_2')).body.subject
    assert.ok(findChild(findTopic(ga,'Current Affairs'),'Current affairs 2025'))
    assert.ok(findChild(findTopic(ga,'Current Affairs'),'Current affairs 2026'))
    const computer=(await get('/subjects/Computer_Knowledge?stage=Tier_2')).body.subject
    assert.equal(findChild(findTopic(computer,'Microsoft Office'),'MS Word shortcuts').canonical_mappings[0].canonical_key.sub_topic,'Microsoft Word')
    assert.ok(findChild(findTopic(computer,'Networking and OSI'),'OSI model'))
    const noComputer=(await get('/subjects/Computer_Knowledge?stage=Tier_1')).body.subject
    assert.equal(noComputer.available_in_stage,false); assert.deepEqual(noComputer.topics,[])
    for(const subject of all.subjects) for(const topic of subject.topics) for(const subtopic of topic.subtopics) {
      assert.ok(['notice_mapped','editorial_detail'].includes(topic.provenance))
      assert.ok(subtopic.canonical_mappings.length>0)
      assert.ok(subtopic.canonical_mappings.every(m=>m.canonical_key.subject===subject.subject && ['Tier_1','Tier_2'].includes(m.canonical_key.exam_stage)))
    }

    const weights=(await get('/weightages?stage=Tier_2')).body
    assert.equal(weights.topic_weightage_status,'not_prescribed'); assert.equal(weights.subjects.length,5)
    assert.deepEqual(weights.subjects.map(s=>[s.subject,s.official_subject_allocation.question_count,s.official_subject_allocation.maximum_marks]),[
      ['Quant',30,90],['Reasoning',30,90],['English',45,135],['General_Awareness',25,75],['Computer_Knowledge',20,60]])
    assert.equal(weights.subjects[4].official_subject_allocation.counts_for_final_merit,false)
    for(const subject of weights.subjects) for(const topic of subject.topics) {
      assert.equal(topic.question_count,null); assert.equal(topic.maximum_marks,null); assert.equal(topic.weightage_percentage,null)
      for(const sub of topic.subtopics) { assert.equal(sub.question_count,null); assert.equal(sub.maximum_marks,null); assert.equal(sub.weightage_percentage,null) }
    }
    const tier1Weight=(await get('/weightages?stage=Tier_1&subject=Quant')).body.subjects[0]
    assert.deepEqual([tier1Weight.official_subject_allocation.question_count,tier1Weight.official_subject_allocation.maximum_marks],[25,50])
    const absent=(await get('/weightages?stage=Tier_1&subject=Computer_Knowledge')).body.subjects[0]
    assert.equal(absent.available_in_stage,false); assert.equal(absent.official_subject_allocation,null); assert.deepEqual(absent.topics,[])

    await db.query(`DELETE FROM cgl_catalog_subtopic_stages WHERE (subtopic_id,exam_stage) IN
      (SELECT subtopic_id,exam_stage FROM cgl_catalog_subtopic_stages LIMIT 1)`)
    result=await get('/subjects'); assert.equal(result.status,503); assert.equal(result.body.code,'SSC_CGL_CATALOG_INCOMPLETE')
    await seedOfficialCatalog(client)
    assert.equal((await get('/subjects')).status,200,'rerunning the seed repairs a missing mapping')

    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',['bad',CATALOG_VERSION])
    result=await get('/blueprints'); assert.equal(result.status,503); assert.equal(result.body.code,'SSC_CGL_CATALOG_SCHEMA_CHECKSUM_MISMATCH')
    assert.equal((await get('/mock-tests')).status,200,'a bad optional catalog does not block existing APIs')
    assert.equal((await get('/health')).body.catalog.ok,false)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',[CATALOG_CHECKSUM,CATALOG_VERSION])
    await db.query('UPDATE cgl_catalog_seed_versions SET data_checksum=$1 WHERE seed_key=$2',['bad',CATALOG_SEED_KEY])
    result=await get('/subjects'); assert.equal(result.status,503); assert.equal(result.body.code,'SSC_CGL_CATALOG_DATA_CHECKSUM_MISMATCH')
    await db.query('UPDATE cgl_catalog_seed_versions SET data_checksum=$1 WHERE seed_key=$2',[CATALOG_DATA_CHECKSUM,CATALOG_SEED_KEY])
    assert.equal((await get('/subjects')).status,200)
  } finally { await new Promise(resolve=>server.close(resolve)); await db.close() }
})
