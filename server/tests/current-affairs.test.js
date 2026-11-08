import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import {PGlite} from '@electric-sql/pglite'
import {migrateSscCgl} from '../migration-core.js'
import {migrateCurrentAffairs,CA_MIGRATION_CHECKSUM,CA_MIGRATION_VERSION} from '../ca-migration.js'
import {migrateMasterAssembler} from '../master-migration.js'
import {fileDigest} from '../content-utils.js'
import {normalizeCaManifest,ingestCaManifest,publishCaEvent,publicSourceUrl} from '../ca-ingest.js'
import {generateCaQuestion,publishCaQuestion} from '../ca-ai.js'
import {normalizeCaSpec,assembleCaMock,publishCaMock,allCaSpecs,selectCaQuestions} from '../ca-assembler.js'
import {withdrawCaRecord,rejectCaDraft} from '../ca-editorial.js'
import {monthBounds,weekBounds,indiaToday} from '../ca-dates.js'
import {createCglRouter} from '../cgl-api.js'
import {CA_CATEGORY_CODES} from '../data/ssc-cgl-ca-categories.js'

// Every name, event, source and answer below is fictional and used only in an isolated test DB.
async function fixture(){
  const dir=await mkdtemp(path.join(os.tmpdir(),'ca-fixture-'))
  const files={event:path.join(dir,'event'),static:path.join(dir,'static'),rights:path.join(dir,'rights')}
  await Promise.all(Object.entries(files).map(([name,p])=>writeFile(p,`FICTIONAL fixture ${name} only`)))
  const rights=await fileDigest(files.rights)
  const sources=[{ref:'event-source',title:'FICTIONAL event source',url:'https://example.invalid/news?PRID=123',evidence_sha256:await fileDigest(files.event),rights_sha256:rights,rights_reference:'FICTIONAL test permission',allow_republication:true,allow_derivatives:true,allow_external_processing:true},
    {ref:'static-source',title:'FICTIONAL static source',url:'https://example.invalid/static',evidence_sha256:await fileDigest(files.static),rights_sha256:rights,rights_reference:'FICTIONAL test permission',allow_republication:true,allow_derivatives:true,allow_external_processing:true}]
  const events=[]
  for(let i=0;i<135;i++){
    let month,day,category
    if(i<80){month=1;day=i<20?1+(i%7):8+(i%21);category=i>=20&&i<40?'Schemes':i>=40&&i<60?'Awards':CA_CATEGORY_CODES[i%8]}
    else{month=2+Math.floor((i-80)/5);day=1+(i%20);category=CA_CATEGORY_CODES[i%8]}
    const d=`2025-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    events.push({event_key:`fictional-event-${i}`,event_date:d,category,award_group:category==='Awards'?'Padma':null,editorial_priority:(i%5)+1,
      title_en:`FICTIONAL fixture event ${i}`,fact_en:`FICTIONAL fixture event number ${i} has the label Alpha ${i}.`,event_source_ref:'event-source',
      static_booster:{source_ref:'static-source',title_en:'Fictional geography',title_hi:'काल्पनिक भूगोल',fact_en:'Fixture City is the capital of Fixture Republic.',fact_hi:'फिक्चर सिटी, फिक्चर गणराज्य की राजधानी है।',link_en:'This fictional event refers to Fixture Republic.',link_hi:'यह काल्पनिक घटना फिक्चर गणराज्य से जुड़ी है।',translation_note:'Editorial fixture translation',as_of:'2025-01-01'}})
  }
  const db=await PGlite.create()
  await db.exec('CREATE TABLE users(id SERIAL PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES; CREATE TABLE attempts(id INT PRIMARY KEY); INSERT INTO attempts VALUES(1)')
  const client={query:(sql,args)=>sql.includes('DROP TABLE IF EXISTS mock_test_questions;')||sql.startsWith('-- Additive CA events')||sql.startsWith('-- Additive per-learner master assembler.')||sql.startsWith('-- Additive exam-player progress;')?db.exec(sql).then(()=>({rows:[]})):db.query(sql,args),release:()=>{}}
  return {db,client,manifest:{schema_version:1,sources,events},index:{sources:{'event-source':{evidence:files.event,rights:files.rights},'static-source':{evidence:files.static,rights:files.rights}}},close:async()=>{await db.close();await rm(dir,{recursive:true,force:true})}}
}
const allAudit={answer_unique:true,evidence_supports_answer:true,explanation_grounded:true,booster_relevant:true,booster_grounded:true,translation_consistent:true,temporal_context_correct:true,original_writing:true,notes:'Fictional answer and booster checked for test.'}
function fakeProvider({solverIndex=0,audit=allAudit,trace=[]}={}){
  return {models:{generator:'fixture-gen',solver:'fixture-solver',auditor:'fixture-auditor'},async complete(role,{user}){
    trace.push({role,user})
    if(role==='generator'){
      const n=user.event.title.match(/(\d+)$/)?.[1]??'0',year=user.event.date.slice(0,4)
      return {question_text_en:`In ${year}, what was the label for fictional fixture event ${n}?`,question_text_hi:`${year} में काल्पनिक घटना ${n} का लेबल क्या था?`,options:[{en:`Alpha ${n}`,hi:`अल्फा ${n}`},{en:`Beta ${n}`,hi:`बीटा ${n}`},{en:`Gamma ${n}`,hi:`गामा ${n}`},{en:`Delta ${n}`,hi:`डेल्टा ${n}`}],correct_option_index:0,
        explanation_en:`The fictional fixture source states Alpha ${n}.`,explanation_hi:`काल्पनिक स्रोत अल्फा ${n} बताता है।`,ideal_time_seconds:20}
    }
    if(role==='solver')return {answer_index:solverIndex,unique_correct:true,supported_by_source:true,steps:'The fictional source directly states the selected label.'}
    return structuredClone(audit)
  }}
}

test('source-backed CA workflow assembles exact mocks, boosters and isolated attempts',async()=>{
  const f=await fixture(),{db,client,manifest,index}=f
  const mentorCalls=[],mentorOptions={provider:{complete:async(context)=>{mentorCalls.push(context);return 'Fictional CA explanation'}}}
  const app=express();app.use(express.json())
  const auth=(req,res,next)=>{const id=req.get('x-test-user');if(!['1','2'].includes(id))return res.status(401).json({error:'Missing token'});req.userId=Number(id);next()}
  app.use('/api/cgl',createCglRouter({pool:{connect:async()=>client},query:client.query,auth,mentorOptions}))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))}),url=`http://127.0.0.1:${server.address().port}/api/cgl`
  const get=async(p,user)=>{const r=await fetch(url+p,{headers:user?{'x-test-user':String(user)}:{}});return {status:r.status,body:await r.json()}}
  const post=async(p,body,user)=>{const r=await fetch(url+p,{method:'POST',headers:{'content-type':'application/json',...(user?{'x-test-user':String(user)}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
  try{
    await assert.rejects(migrateCurrentAffairs(client),/001/)
    await migrateSscCgl(client,{resetLegacyBank:true})
    assert.equal((await get('/current-affairs/coverage')).status,503)
    assert.equal((await get('/mock-tests')).status,200)
    assert.equal((await migrateCurrentAffairs(client)).applied,true);assert.equal((await migrateCurrentAffairs(client)).applied,false)
    await migrateMasterAssembler(client)
    assert.equal((await get('/current-affairs/capsule')).body.capsule,null)
    const initial=await get('/current-affairs/coverage')
    assert.equal(initial.status,200);assert.equal(initial.body.months.length,24);assert.equal(initial.body.annual.length,2)
    assert.equal(initial.body.months.find(m=>m.year===2025&&m.month===1).status,'Awaiting_Content')
    if(indiaToday()==='2026-11-07'){
      assert.equal(initial.body.months.find(m=>m.year===2026&&m.month===12).status,'Upcoming')
      assert.equal(initial.body.annual.find(a=>a.year===2026).status,'In_Progress')
    }
    assert.deepEqual((await get('/current-affairs/mocks')).body.mocks,[])
    assert.equal((await get('/current-affairs/categories')).body.categories.length,8)
    const empty=await assembleCaMock(client,{kind:'Monthly',exam_stage:'Tier_1',year:2025,month:1})
    assert.equal(empty.reason,'Insufficient_Reviewed_Content');assert.equal(empty.required,50)
    await assert.rejects(ingestCaManifest(client,manifest,{sources:{...index.sources,'event-source':{...index.sources['event-source'],evidence:index.sources['static-source'].evidence}}}),/digest mismatch/)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_ca_events')).rows[0].n,0)
    const future=structuredClone(manifest);future.events=[{...future.events[0],event_date:'2026-12-01'}]
    assert.throws(()=>normalizeCaManifest(future,{today:'2026-11-07'}),/Future/)
    assert.throws(()=>publicSourceUrl('https://example.invalid/article?token=secret','url'),/secret/)
    assert.throws(()=>publicSourceUrl('https://example.invalid/article?sig=secret','url'),/secret/)
    assert.throws(()=>publicSourceUrl('https://127.0.0.1/source','url'),/public host/)
    assert.equal(publicSourceUrl('https://example.invalid/article?PRID=123','url'),'https://example.invalid/article?PRID=123')
    assert.throws(()=>normalizeCaManifest({...manifest,candidate_name:'personal'},{}),/unsupported fields/)
    const imported=await ingestCaManifest(client,manifest,index)
    assert.equal(imported.events.length,135);assert.equal((await ingestCaManifest(client,manifest,index)).imported,false)
    await assert.rejects(db.query("UPDATE cgl_ca_imports SET manifest_sha256=$2 WHERE id=$1",[imported.import_id,'0'.repeat(64)]),/immutable/)
    const forbidden=structuredClone(manifest);forbidden.events=[{...forbidden.events[0],event_key:'fictional-restricted-event'}]
    forbidden.sources[0].allow_external_processing=false
    const restricted=await ingestCaManifest(client,forbidden,index)
    await publishCaEvent(client,{eventId:restricted.events[0].id,reviewer:'Fixture source reviewer',notes:'Synthetic source may be republished only'})
    const capsule=await get('/current-affairs/capsule')
    assert.equal(capsule.status,200);assert.ok(capsule.body.capsule.fact_en);assert.ok(capsule.body.capsule.source_url)
    assert.ok(!('correct_option_index' in capsule.body.capsule));assert.ok(!('static_gk_booster' in capsule.body.capsule))
    const noCalls=[]
    await assert.rejects(generateCaQuestion(client,{eventId:restricted.events[0].id},fakeProvider({trace:noCalls})),/permissions|permit/)
    assert.equal(noCalls.length,0,'restricted source is never sent to a model')
    const noPublish=structuredClone(forbidden);noPublish.events[0].event_key='fictional-no-publication';noPublish.sources[0].allow_republication=false
    const unpublished=await ingestCaManifest(client,noPublish,index)
    await assert.rejects(publishCaEvent(client,{eventId:unpublished.events[0].id,reviewer:'Fixture source reviewer',notes:'Synthetic source intentionally restricted'}),/permitted/)
    assert.equal((await rejectCaDraft(client,{kind:'event',id:unpublished.events[0].id,reviewer:'Fixture reviewer',notes:'Synthetic draft requires correction'})).rejected,true)
    const retried=structuredClone(noPublish);retried.revision='fixture-second-review'
    const retryImport=await ingestCaManifest(client,retried,index)
    assert.notEqual(String(retryImport.events[0].id),String(unpublished.events[0].id))
    await rejectCaDraft(client,{kind:'event',id:retryImport.events[0].id,reviewer:'Fixture reviewer',notes:'Synthetic retry still restricted'})
    const corrected=structuredClone(noPublish);corrected.sources[0].allow_republication=true
    const correctedImport=await ingestCaManifest(client,corrected,index)
    assert.notEqual(String(correctedImport.events[0].id),String(unpublished.events[0].id))
    await publishCaEvent(client,{eventId:correctedImport.events[0].id,reviewer:'Fixture reviewer',notes:'Synthetic corrected event reviewed'})
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_ca_questions')).rows[0].n,0)
    const ids=imported.events.map(x=>String(x.id))
    for(const id of ids)await publishCaEvent(client,{eventId:id,reviewer:'Fictional source reviewer',notes:'Synthetic event and static evidence inspected'})
    await assert.rejects(db.query('UPDATE cgl_ca_events SET fact_en=$2 WHERE id=$1',[ids[0],'changed']),/immutable/)
    const trace=[]
    await assert.rejects(generateCaQuestion(client,{eventId:ids[0]},fakeProvider({solverIndex:1})),/solver rejected/)
    await assert.rejects(generateCaQuestion(client,{eventId:ids[0]},fakeProvider({audit:{...allAudit,booster_relevant:false}})),/booster_relevant/)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_ca_questions')).rows[0].n,0)
    const first=await generateCaQuestion(client,{eventId:ids[0]},fakeProvider({trace}))
    assert.equal(first.status,'Verified_Draft')
    const blind=trace.find(c=>c.role==='solver').user
    assert.ok(!('correct_option_index' in blind.question)&&!('explanation_en' in blind.question),'solver receives no proposed key or explanation')
    assert.match(blind.event.fact,/FICTIONAL/,'solver is grounded in the source fact')
    assert.equal((await generateCaQuestion(client,{eventId:ids[0]},fakeProvider())).created,false)
    const old=(await db.query('SELECT content FROM cgl_ca_questions WHERE id=$1',[first.question_id])).rows[0].content
    await db.query("UPDATE cgl_ca_questions SET content=jsonb_set(content,'{question_text_en}',to_jsonb('tampered 2025'::text)) WHERE id=$1",[first.question_id])
    await assert.rejects(publishCaQuestion(client,{questionId:first.question_id,reviewer:'Fixture editor',notes:'Fictional question reviewed'}),/checksum/)
    await db.query('UPDATE cgl_ca_questions SET content=$2 WHERE id=$1',[first.question_id,JSON.stringify(old)])
    await publishCaQuestion(client,{questionId:first.question_id,reviewer:'Fixture editor',notes:'Fictional question and booster reviewed'})
    const rejectedQuestion=await generateCaQuestion(client,{eventId:ids[1]},fakeProvider())
    await rejectCaDraft(client,{kind:'question',id:rejectedQuestion.question_id,reviewer:'Fixture reviewer',notes:'Synthetic draft question rejected'})
    const regenerated=await generateCaQuestion(client,{eventId:ids[1]},fakeProvider())
    assert.notEqual(String(regenerated.question_id),String(rejectedQuestion.question_id))
    for(const id of ids.slice(1)){
      const q=await generateCaQuestion(client,{eventId:id},fakeProvider())
      await publishCaQuestion(client,{questionId:q.question_id,reviewer:'Fixture editor',notes:'Fictional question and booster reviewed'})
    }
    assert.equal((await db.query("SELECT COUNT(*)::int n FROM cgl_ca_questions WHERE status='Published'")).rows[0].n,135)
    const monthly=await assembleCaMock(client,{kind:'Monthly',exam_stage:'Tier_1',year:2025,month:1})
    assert.equal(monthly.created,true);assert.equal(monthly.target_count,50)
    const {rows:[emptyDraft]}=await db.query(`INSERT INTO cgl_ca_mocks(active_key,kind,exam_stage,year,month,period_start,period_end,as_of_date,title,target_count,correct_marks,wrong_deduction,selection_policy)
      VALUES('empty-test','Monthly','Tier_1',2025,2,'2025-02-01','2025-02-28','2025-03-01','Fictional incomplete draft',50,2,0.5,'{}'::jsonb) RETURNING id`)
    await assert.rejects(publishCaMock(client,{mockId:emptyDraft.id,reviewer:'Fixture mock reviewer',notes:'Synthetic incomplete mock test'}),/exact number/)
    assert.equal((await assembleCaMock(client,{kind:'Monthly',exam_stage:'Tier_1',year:2025,month:1})).reason,'Already_Exists')
    assert.equal((await get(`/current-affairs/mocks/${monthly.mock_id}`)).status,404,'draft mocks are private')
    await publishCaMock(client,{mockId:monthly.mock_id,reviewer:'Fixture mock reviewer',notes:'Fictional fifty-question composition checked'})
    const week=await assembleCaMock(client,{kind:'Weekly',exam_stage:'Tier_2',year:2025,month:1,week:1})
    assert.equal(week.target_count,20);assert.equal(week.created,true)
    await publishCaMock(client,{mockId:week.mock_id,reviewer:'Fixture mock reviewer',notes:'Fictional weekly composition checked'})
    const oldSnapshot=await assembleCaMock(client,{kind:'Category',exam_stage:'Tier_1',year:2025,month:1,category:'Schemes'},{today:'2025-01-30'})
    assert.equal(oldSnapshot.created,true)
    await publishCaMock(client,{mockId:oldSnapshot.mock_id,reviewer:'Fixture mock reviewer',notes:'Fictional dated snapshot checked'})
    const snapshotCoverage=await get('/current-affairs/coverage?stage=Tier_1')
    const snapshot=snapshotCoverage.body.months.find(m=>m.year===2025&&m.month===1).categories.find(c=>c.category==='Schemes')
    assert.equal(snapshot.snapshot_stale,true);assert.equal(snapshot.snapshot_period_end,'2025-01-30')
    const category=await assembleCaMock(client,{kind:'Category',exam_stage:'Tier_1',year:2025,month:1,category:'Schemes'})
    assert.equal(category.created,true);assert.equal(category.target_count,20)
    await rejectCaDraft(client,{kind:'mock',id:category.mock_id,reviewer:'Fixture reviewer',notes:'Synthetic draft composition rejected'})
    const revisedCategory=await assembleCaMock(client,{kind:'Category',exam_stage:'Tier_1',year:2025,month:1,category:'Schemes'})
    assert.equal(revisedCategory.created,true);assert.notEqual(String(revisedCategory.mock_id),String(category.mock_id))
    await publishCaMock(client,{mockId:revisedCategory.mock_id,reviewer:'Fixture mock reviewer',notes:'Fictional category composition checked'})
    const padma=await assembleCaMock(client,{kind:'Category',exam_stage:'Tier_1',year:2025,month:1,category:'Awards',award_group:'Padma'})
    assert.equal(padma.created,true);await publishCaMock(client,{mockId:padma.mock_id,reviewer:'Fixture mock reviewer',notes:'Fictional Padma category checked'})
    const annual=await assembleCaMock(client,{kind:'Annual',exam_stage:'Tier_1',year:2025})
    assert.equal(annual.created,true);assert.equal(annual.target_count,100)
    assert.ok(Object.values(annual.selection_policy.month_counts).every(n=>n>=1))
    await publishCaMock(client,{mockId:annual.mock_id,reviewer:'Fixture mock reviewer',notes:'All synthetic annual months and weights checked'})
    const futureAnnual=await assembleCaMock(client,{kind:'Annual',exam_stage:'Tier_1',year:2026},{today:'2026-11-07'})
    assert.equal(futureAnnual.reason,'In_Progress')
    const list=await get('/current-affairs/mocks?year=2025&kind=Monthly&stage=Tier_1')
    assert.equal(list.body.mocks.length,1);assert.match(list.body.note,/not verified/)
    assert.equal((await get('/current-affairs/mocks?category=Awards&award_group=Padma')).body.mocks.length,1)
    const mock=(await get(`/current-affairs/mocks/${monthly.mock_id}`)).body.mock
    assert.equal(mock.questions.length,50);assert.ok(!('correct_option_index' in mock.questions[0]));assert.ok(!('static_gk_booster' in mock.questions[0]))
    assert.equal((await post(`/current-affairs/mocks/${monthly.mock_id}/attempts`,{answers:[]},null)).status,401)
    const bad=await post(`/current-affairs/mocks/${monthly.mock_id}/attempts`,{answers:[{question_id:mock.questions[0].id,selected_option_index:0},{question_id:mock.questions[0].id,selected_option_index:1}]},1)
    assert.equal(bad.status,400)
    const grade=await post(`/current-affairs/mocks/${monthly.mock_id}/attempts`,{answers:[{question_id:mock.questions[0].id,selected_option_index:0},{question_id:mock.questions[1].id,selected_option_index:1}]},1)
    assert.equal(grade.status,201);assert.equal(grade.body.attempt.score,1.5);assert.equal(grade.body.attempt.max_score,100)
    assert.equal(grade.body.attempt.results.length,50);assert.ok(grade.body.attempt.results.every(r=>r.static_gk_booster?.source?.url))
    assert.match(grade.body.attempt.results[0].static_gk_booster.label,/Static GK Booster/)
    assert.equal((await get(`/current-affairs/attempts/${grade.body.attempt.id}`,2)).status,404)
    assert.equal((await get(`/current-affairs/attempts/${grade.body.attempt.id}`,1)).body.attempt.results.length,50)
    // A fixed reviewed CA mock stays intact even after its questions were seen
    // through the original CA API; boosters remain hidden until submission.
    const master=await post('/master/mocks',{category:'CA_Monthly',stage:'Tier_1',year:2025,month:1},1)
    assert.equal(master.status,201,JSON.stringify(master.body));assert.equal(master.body.mock.duration_seconds,1800,'monthly practice is 30 minutes');assert.equal(master.body.mock.selection.reused_questions,50)
    const masterLaunch=await post(`/master/mocks/${master.body.mock.id}/launch`,{},1)
    assert.equal(masterLaunch.status,200);assert.equal(masterLaunch.body.questions.length,50)
    assert.ok(masterLaunch.body.questions.every(q=>q.previously_seen&&!('correct_option_index' in q)&&!('static_gk_booster' in q)))
    const masterGrade=await post(`/master/mocks/${master.body.mock.id}/submit`,{answers:[{position:1,selected_option_index:0}]},1)
    assert.equal(masterGrade.status,200);assert.equal(masterGrade.body.summary.score,2)
    assert.ok(masterGrade.body.results.every(q=>q.static_gk_booster?.source?.url))
    const caMentor=await post(`/attempts/master/${master.body.mock.id}/mentor`,{position:1,intent:'step',language:'en'},1)
    assert.equal(caMentor.status,200,JSON.stringify(caMentor.body));assert.match(mentorCalls[0].reviewed_basic_solution,/fictional/i)
    // Category drills use the same fixed-source master lifecycle and disclose repeats.
    const categoryMock=await post('/master/mocks',{category:'CA_Monthly',stage:'Tier_1',year:2025,month:1,ca_category:'Schemes'},1)
    assert.equal(categoryMock.status,201,JSON.stringify(categoryMock.body));assert.equal(categoryMock.body.mock.question_count,20);assert.equal(categoryMock.body.mock.duration_seconds,900,'category practice is 15 minutes')
    const seenIds=new Set(mock.questions.map(q=>String(q.id)))
    const categoryContents=(await get(`/current-affairs/mocks/${revisedCategory.mock_id}`)).body.mock.questions
    assert.equal(categoryMock.body.mock.selection.reused_questions,categoryContents.filter(q=>seenIds.has(String(q.id))).length)
    const categoryLaunch=await post(`/master/mocks/${categoryMock.body.mock.id}/launch`,{},1)
    assert.equal(categoryLaunch.status,200);assert.equal(categoryLaunch.body.questions.length,20)
    assert.equal(categoryLaunch.body.questions.filter(q=>q.previously_seen).length,categoryMock.body.mock.selection.reused_questions)
    assert.ok(categoryLaunch.body.questions.every(q=>!('correct_option_index' in q)))
    await post(`/master/mocks/${categoryMock.body.mock.id}/cancel`,{},1)
    const yearly=await post('/master/mocks',{category:'CA_Annual',stage:'Tier_1',year:2025},1)
    assert.equal(yearly.status,201);assert.equal(yearly.body.mock.question_count,100);assert.equal(yearly.body.mock.duration_seconds,3600,'annual practice is 60 minutes')
    const yearlyLaunch=await post(`/master/mocks/${yearly.body.mock.id}/launch`,{},1)
    assert.equal(yearlyLaunch.status,200);assert.equal(yearlyLaunch.body.questions.length,100)
    assert.ok(yearlyLaunch.body.questions.every(q=>!('correct_option_index' in q)&&!('static_gk_booster' in q)))
    await post(`/master/mocks/${yearly.body.mock.id}/cancel`,{},1)
    if(indiaToday()==='2026-11-07'){
      const future=await post('/master/mocks',{category:'CA_Annual',stage:'Tier_1',year:2026},1)
      assert.equal(future.status,409);assert.equal(future.body.code,'CONTENT_PENDING')
    }
    const coverage=await get('/current-affairs/coverage?stage=Tier_1')
    assert.equal(coverage.body.months.find(m=>m.year===2025&&m.month===1).status,'Available')
    assert.equal(coverage.body.annual.find(a=>a.year===2025).status,'Available')
    const awards=coverage.body.months.find(m=>m.year===2025&&m.month===1).categories.find(c=>c.category==='Awards')
    assert.equal(awards.award_groups.find(g=>g.award_group==='Padma').status,'Available')
    assert.equal(awards.award_groups.find(g=>g.award_group==='Padma').snapshot_period_end,'2025-01-31')
    assert.equal(coverage.body.annual.find(a=>a.year===2025).categories.length,8)
    const {rows:[linked]}=await db.query('SELECT event_id FROM cgl_ca_mock_items WHERE mock_id=$1 AND question_id=$2',[monthly.mock_id,mock.questions[0].id])
    await withdrawCaRecord(client,{kind:'event',id:linked.event_id,reviewer:'Fixture reviewer',notes:'Synthetic event withdrawn for test'})
    assert.equal((await get(`/current-affairs/mocks/${monthly.mock_id}`)).status,404,'mock with withdrawn source is hidden')
    const history=await get(`/current-affairs/attempts/${grade.body.attempt.id}`,1)
    assert.equal(history.status,200);assert.equal(history.body.attempt.score,'1.50')
    assert.equal(history.body.attempt.results[0].content_withdrawn,true);assert.ok(!('static_gk_booster' in history.body.attempt.results[0]))
    const masterHistory=await get(`/master/mocks/${master.body.mock.id}/review`,1)
    assert.equal(masterHistory.status,200);assert.equal(masterHistory.body.summary.score,2)
    assert.equal(masterHistory.body.results[0].content_withdrawn,true);assert.ok(!('static_gk_booster' in masterHistory.body.results[0]))
    assert.equal((await post(`/attempts/master/${master.body.mock.id}/mentor`,{position:1,intent:'step',language:'en'},1)).status,409)
    await assert.rejects(db.query('UPDATE cgl_ca_events SET status=$2 WHERE id=$1',[linked.event_id,'Published']),/immutable/)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM attempts')).rows[0].n,1,'legacy history retained')
    const latestBeforeWithdrawal=(await get('/current-affairs/capsule')).body.capsule
    await withdrawCaRecord(client,{kind:'event',id:latestBeforeWithdrawal.id,reviewer:'Fixture reviewer',notes:'Synthetic capsule withdrawal checked'})
    const latestAfterWithdrawal=(await get('/current-affairs/capsule')).body.capsule
    assert.notEqual(String(latestAfterWithdrawal?.id),String(latestBeforeWithdrawal.id),'withdrawn capsule facts are not served')
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',['wrong',CA_MIGRATION_VERSION])
    assert.equal((await get('/current-affairs/mocks')).body.code,'SSC_CGL_CA_CHECKSUM_MISMATCH')
    assert.equal((await get('/mock-tests')).status,200)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',[CA_MIGRATION_CHECKSUM,CA_MIGRATION_VERSION])
  }finally{await new Promise(resolve=>server.close(resolve));await f.close()}
})

test('period boundaries, selection gaps, weights and future availability are explicit',()=>{
  assert.equal(indiaToday(new Date('2026-11-07T18:45:00Z')),'2026-11-08')
  assert.deepEqual(monthBounds(2025,2),{start:'2025-02-01',end:'2025-02-28',days:28})
  assert.deepEqual(weekBounds(2025,1,5),{start:'2025-01-29',end:'2025-01-31',partial_window:true})
  assert.throws(()=>weekBounds(2025,2,5),/does not have/)
  assert.equal(normalizeCaSpec({kind:'Monthly',exam_stage:'Tier_1',year:2026,month:12},{today:'2026-11-07'}).reason,'Upcoming')
  assert.equal(normalizeCaSpec({kind:'Annual',exam_stage:'Tier_1',year:2026},{today:'2026-11-07'}).reason,'In_Progress')
  const ytd=normalizeCaSpec({kind:'Category',exam_stage:'Tier_2',year:2026,category:'Science_Space'},{today:'2026-11-07'})
  assert.equal(ytd.period_end,'2026-11-07');assert.equal(ytd.target_count,20);assert.equal(ytd.correct_marks,3)
  assert.equal(allCaSpecs('Tier_1').filter(s=>s.kind==='Monthly').length,24)
  assert.equal(allCaSpecs('Tier_1').length,456)
  assert.equal(allCaSpecs('Tier_1').filter(s=>s.award_group==='Padma').length,26)
  const fake=Array.from({length:100},(_,i)=>({question_id:String(i+1),event_id:String(i+1),event_date:'2025-01-02',category:'Schemes',editorial_priority:3}))
  assert.equal(selectCaQuestions(fake,{kind:'Annual',target_count:100}).reason,'Annual_Month_Coverage_Missing')
})

test('CA migration rolls back late DDL failures without touching prior history',async()=>{
  const f=await fixture(),{db,client}=f
  try{
    await migrateSscCgl(client,{resetLegacyBank:true})
    const fail={query:async(sql,args)=>{if(sql.startsWith('-- Additive CA events')){await client.query(sql,args);throw new Error('injected CA failure')}return client.query(sql,args)}}
    await assert.rejects(migrateCurrentAffairs(fail),/injected CA failure/)
    const {rows:[state]}=await db.query(`SELECT to_regclass('public.cgl_ca_events') AS events,(SELECT COUNT(*)::int FROM cgl_schema_migrations WHERE version=$1) AS migration,
      (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM attempts) AS history`,[CA_MIGRATION_VERSION])
    assert.deepEqual(state,{events:null,migration:0,users:2,history:1})
  }finally{await f.close()}
})
