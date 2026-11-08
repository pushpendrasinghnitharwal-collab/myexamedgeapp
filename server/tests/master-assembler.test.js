import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {PGlite} from '@electric-sql/pglite'
import {migrateSscCgl} from '../migration-core.js'
import {migratePyqAi} from '../pyq-migration.js'
import {migrateMasterAssembler,MASTER_MIGRATION_VERSION,MASTER_MIGRATION_CHECKSUM,PLAYER_MIGRATION_VERSION} from '../master-migration.js'
import {readFile} from 'node:fs/promises'
import {TIER1_EDITORIAL_TOPICS,TIER1_EDITORIAL_SETS,TIER1_DIFFICULTY,TIER1_MODULES,TIER2_MODULES} from '../master-formats.js'
import {timingState} from '../master-service.js'
import {selectMasterUnits,sourceKey} from '../master-solver.js'
import {withdrawPyqPaper} from '../pyq-ingest.js'
import {labelMasterQuestion} from '../master-label.js'
import {redactPublicQuestion} from '../public-question.js'
import {createCglRouter} from '../cgl-api.js'
import {createMentorLimiter} from '../mentor-provider.js'

// Every source, paper, question, answer and review here is fictional and lives
// only in a disposable PGlite database. No fixture is a real SSC paper.
async function fixture(mentorOptions){
  const db=await PGlite.create()
  await db.exec('CREATE TABLE users(id SERIAL PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES; CREATE TABLE attempts(id INT PRIMARY KEY); INSERT INTO attempts VALUES(1)')
  const client={query:(sql,args)=>sql.includes('DROP TABLE IF EXISTS mock_test_questions;')||sql.startsWith('-- Additive vault and AI draft tables.')||sql.startsWith('-- Additive per-learner master assembler.')||sql.startsWith('-- Additive exam-player progress;')
    ?db.exec(sql).then(()=>({rows:[]})):db.query(sql,args),release:()=>{}}
  const app=express();app.use(express.json())
  const auth=(req,res,next)=>{if(!['1','2'].includes(req.get('x-test-user')))return res.status(401).json({error:'Missing token'});req.userId=Number(req.get('x-test-user'));next()}
  app.use('/api/cgl',createCglRouter({pool:{connect:async()=>client},query:client.query,auth,mentorOptions}))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))}),base=`http://127.0.0.1:${server.address().port}/api/cgl`
  async function request(path,{method='GET',body,user,signal}={}){
    const r=await fetch(base+path,{method,signal,headers:{...(body?{'content-type':'application/json'}:{}),...(user?{'x-test-user':String(user)}:{})},...(body?{body:JSON.stringify(body)}:{})})
    const data=await r.json();return {status:r.status,data,headers:r.headers}
  }
  return {db,client,request,close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close()}}
}
const options=JSON.stringify([{en:'Fixture A',hi:'विकल्प अ'},{en:'Fixture B',hi:'विकल्प ब'},{en:'Fixture C',hi:'विकल्प स'},{en:'Fixture D',hi:'विकल्प द'}])
let serial=0
async function addSet(db,stage,type){
  const subject=type==='Data_Interpretation'?'Quant':'English'
  const {rows:[set]}=await db.query(`INSERT INTO cgl_question_sets(set_type,exam_stage,subject,passage_text_en,passage_text_hi,chart_data)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[type,stage,subject,type==='Data_Interpretation'?null:'Fictional practice passage.',type==='Data_Interpretation'?null:'काल्पनिक अभ्यास अनुच्छेद।',type==='Data_Interpretation'?JSON.stringify({fictional:true,correct_option_index:0,nested:{solution_basic:'Must not appear',answer:2},series:[1,2]}):null])
  return set.id
}
async function addBank(db,{stage,subject,topic,subtopic,difficulty,setId=null}){
  serial++
  const {rows:[q]}=await db.query(`INSERT INTO cgl_questions(exam_stage,subject,topic,sub_topic,difficulty,question_type,passage_set_id,
    question_text_en,question_text_hi,options,correct_option_index,solution_basic,solution_basic_hi,solution_trick,ideal_time_seconds,status,source_url,source_citation,reviewed_by,reviewed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'Fictional basic solution','काल्पनिक समाधान','Fictional shortcut',20,'Published','https://example.invalid/test','Fictional test only','Fixture reviewer',now()) RETURNING id`,
    [stage,subject,topic,subtopic,difficulty,setId?'Passage_Based':'Standard_MCQ',setId,`Fictional practice question ${serial}?`,`काल्पनिक प्रश्न ${serial}?`,options])
  return q.id
}
async function buildBank(db){
  const {rows}=await db.query("SELECT DISTINCT subject,topic,sub_topic FROM cgl_syllabus WHERE exam_stage='Both' OR exam_stage IN ('Tier_1','Tier_2') ORDER BY subject,topic,sub_topic")
  const sub=(subject,topic)=>rows.find(r=>r.subject===subject&&r.topic===topic)?.sub_topic
  await db.query('BEGIN')
  try{
    for(let copy=0;copy<2;copy++){
      const di=await addSet(db,'Tier_1','Data_Interpretation'),cloze=await addSet(db,'Tier_1','Cloze_Test');let position=0
      for(const [subject,topics] of Object.entries(TIER1_EDITORIAL_TOPICS))for(const [topic,count] of Object.entries(topics))for(let i=0;i<count;i++){
        const difficulty=position<30?'Easy':position<80?'Medium':'Hard';position++
        const setId=subject==='Quant'&&topic==='Statistical Charts'&&i<2?di:subject==='English'&&topic==='Comprehension'?cloze:null
        await addBank(db,{stage:'Tier_1',subject,topic,subtopic:sub(subject,topic),difficulty,setId})
      }
      await db.query("UPDATE cgl_question_sets SET status='Published' WHERE id=ANY($1::bigint[])",[[di,cloze]])
    }
    const di2=await addSet(db,'Tier_2','Data_Interpretation'),cloze2=await addSet(db,'Tier_2','Cloze_Test'),rc2=await addSet(db,'Tier_2','Reading_Comprehension')
    for(const mod of TIER2_MODULES)for(let i=0;i<mod.question_count;i++){
      let topic=mod.subject==='Quant'?'Number Systems':mod.subject==='Reasoning'?'Analogy':mod.subject==='English'?'Vocabulary':mod.subject==='General_Awareness'?'Current Events':'Computer Basics'
      let setId=null
      if(mod.subject==='Quant'&&i<4){topic='Statistical Charts';setId=di2}
      if(mod.subject==='English'&&i<10){topic='Comprehension';setId=i<5?cloze2:rc2}
      await addBank(db,{stage:'Tier_2',subject:mod.subject,topic,subtopic:sub(mod.subject,topic),difficulty:['Easy','Medium','Hard'][i%3],setId})
    }
    await db.query("UPDATE cgl_question_sets SET status='Published' WHERE id=ANY($1::bigint[])",[[di2,cloze2,rc2]])
    for(let i=0;i<20;i++)await addBank(db,{stage:'Tier_1',subject:'Quant',topic:'Number Systems',subtopic:'Decimals',difficulty:'Medium'})
    await db.query('COMMIT')
  }catch(e){await db.query('ROLLBACK');throw e}
}
async function buildPyq(db,{code='FICTIONAL',allowExternal=true,importHash='2'}={}){
  const {rows:[paper]}=await db.query(`INSERT INTO cgl_pyq_papers(cycle_year,exam_stage,paper_code,exam_date,shift_label,title,duration_seconds,expected_questions,paper_url,final_key_url,final_key_type,
    paper_sha256,final_key_sha256,rights_sha256,rights_reference,source_description,allow_derivatives,allow_external_processing,import_sha256,import_manifest)
    VALUES(2024,'Tier_1',$3,'2024-09-01','Fictional shift','FICTIONAL PYQ paper',600,4,'https://example.invalid/paper','https://example.invalid/key','Final',
    $1,$1,$1,'Synthetic test permission','Fictional source',true,$4,$2,'{}') RETURNING id`,['1'.repeat(64),importHash.repeat(64),code,allowExternal])
  await db.query("INSERT INTO cgl_pyq_sections(paper_id,section_code,label,position,expected_questions,correct_marks,wrong_deduction) VALUES($1,'Q','Fixture quant',1,4,2,0.5)",[paper.id])
  await db.query("INSERT INTO cgl_pyq_passages(paper_id,passage_ref,text_en) VALUES($1,'fictional-passage','Fictional passage for testing')",[paper.id])
  const statuses=[['Single',[0],null],['Multiple',[0,2],null],['Void',[],'Excluded'],['Void',[],'All_Awarded']]
  for(let i=0;i<4;i++)await db.query(`INSERT INTO cgl_pyq_questions(paper_id,section_code,source_question_ref,position,subject,chapter,sub_chapter,passage_ref,
    question_text_en,options,answer_status,correct_option_indices,void_policy,solution_basic,solution_trick)
    VALUES($1,'Q',$2,$3,'Quant','Fixture chapter','Fixture subchapter',$4,$5,$6,$7,$8,$9,'Fictional solution','Fictional shortcut')`,
    [paper.id,`fixture-${i}`,i+1,i<2?'fictional-passage':null,`Fictional historical question ${i}?`,options,statuses[i][0],JSON.stringify(statuses[i][1]),statuses[i][2]])
  await db.query("UPDATE cgl_pyq_papers SET status='Published',reviewed_by='Fixture editor',review_notes='Fictional source and keys reviewed',reviewed_at=now() WHERE id=$1",[paper.id])
  return paper.id
}
function noKeys(data){
  const raw=JSON.stringify(data)
  for(const term of ['"correct_option_index"','"correct_option_indices"','"solution_basic"','"solution_trick"','"static_gk_booster"','"answer_status"','"verification"'])assert.equal(raw.includes(term),false,`active payload leaks ${term}`)
}

test('master engine covers formats, exact constraints, reservations, privacy, reuse and historical papers',async()=>{
  const mentorCalls=[],f=await fixture({provider:{complete:async(context)=>{mentorCalls.push(context);return 'Fictional AI explanation'}},limiter:createMentorLimiter({perUser:100,global:200})}),{db,client,request}=f
  try{
    await migrateSscCgl(client,{resetLegacyBank:true})
    let r=await request('/master/formats');assert.equal(r.status,200);assert.equal(r.data.assembler.ok,false)
    assert.equal((await request('/master/mocks',{method:'POST',body:{category:'Full_Tier1'},user:1})).status,503)
    await migratePyqAi(client)
    assert.equal((await migrateMasterAssembler(client)).applied,true);assert.equal((await migrateMasterAssembler(client)).applied,false)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_master_mocks')).rows[0].n,0)
    assert.equal((await request('/health')).data.master_assembler.ok,true)
    const pending=await request('/master/mocks',{method:'POST',body:{category:'Full_Tier1'},user:1})
    assert.equal(pending.status,409);assert.equal(pending.data.code,'INSUFFICIENT_REVIEWED_CONTENT')
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_master_mocks')).rows[0].n,0)
    await buildBank(db);const paperId=await buildPyq(db)
    r=await request('/master/formats');assert.equal(r.data.full_tier1.questions,100);assert.equal(r.data.full_tier2.questions,150)
    assert.deepEqual(r.data.full_tier1.difficulty_counts,TIER1_DIFFICULTY);assert.deepEqual(r.data.full_tier1.set_question_counts,TIER1_EDITORIAL_SETS)
    assert.equal((await request('/master/mocks',{method:'POST',body:{category:'Full_Tier1'}})).status,401)
    const gen=await request('/master/mocks',{method:'POST',body:{category:'Full_Tier1',timing_profile:'official_2026'},user:1})
    assert.equal(gen.status,201,JSON.stringify(gen.data));const mock=gen.data.mock;assert.equal(mock.question_count,100);assert.equal(mock.selection.reused_questions,0);noKeys(gen.data)
    const {rows:items}=await db.query('SELECT i.*,q.passage_set_id,ps.set_type FROM cgl_master_items i JOIN cgl_questions q ON q.id=i.source_id LEFT JOIN cgl_question_sets ps ON ps.id=q.passage_set_id WHERE i.mock_id=$1 ORDER BY i.position',[mock.id])
    assert.equal(items.length,100)
    for(const [subject,topics] of Object.entries(TIER1_EDITORIAL_TOPICS))for(const [topic,count] of Object.entries(topics))assert.equal(items.filter(q=>q.subject===subject&&q.topic===topic).length,count,`${subject} ${topic}`)
    for(const [difficulty,count] of Object.entries(TIER1_DIFFICULTY))assert.equal(items.filter(q=>q.difficulty===difficulty).length,count)
    assert.equal(items.filter(q=>q.set_type==='Data_Interpretation').length,2);assert.equal(items.filter(q=>q.set_type==='Cloze_Test').length,5)
    await assert.rejects(db.query("UPDATE cgl_questions SET question_text_en='Unauthorized edit' WHERE id=$1",[items[0].source_id]),/immutable/)
    const diSet=items.find(item=>item.set_type==='Data_Interpretation')
    await assert.rejects(addBank(db,{stage:'Tier_1',subject:'Quant',topic:'Statistical Charts',subtopic:diSet.sub_topic,difficulty:'Easy',setId:diSet.passage_set_id}),/cannot gain children/)
    const anotherPrepared=await request('/master/mocks',{method:'POST',body:{category:'Full_Tier1'},user:1})
    assert.equal(anotherPrepared.status,201,JSON.stringify(anotherPrepared.data))
    const reservedOther=(await db.query('SELECT source_id FROM cgl_master_items WHERE mock_id=$1',[anotherPrepared.data.mock.id])).rows
    const reservedFirst=new Set(items.map(i=>String(i.source_id)))
    assert.ok(reservedOther.every(i=>!reservedFirst.has(String(i.source_id))),'Prepared mocks reserve disjoint question sets')
    await request(`/master/mocks/${anotherPrepared.data.mock.id}/cancel`,{method:'POST',user:1})
    assert.equal((await request(`/master/mocks/${mock.id}`,{user:2})).status,404)
    assert.equal((await request(`/master/mocks/${mock.id}/review`,{user:1})).status,409)
    assert.equal((await request(`/attempts/master/${mock.id}/mentor`,{method:'POST',user:1,body:{position:1,intent:'pyq',language:'en'}})).status,409,'Mentor is unavailable before submission')
    const launch=await request(`/master/mocks/${mock.id}/launch`,{method:'POST',user:1})
    assert.equal(launch.status,200,JSON.stringify(launch.data));assert.equal(launch.data.questions.length,25);assert.equal(launch.data.timer.current_module.subject,'Reasoning');noKeys(launch.data)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_master_seen WHERE user_id=1')).rows[0].n,25,'Only delivered modules become seen')
    assert.equal((await request(`/master/mocks/${mock.id}/launch`,{method:'POST',user:1})).data.questions.length,25,'Launch is idempotent')
    assert.equal((await db.query('SELECT MAX(times_seen)::int n FROM cgl_master_seen WHERE user_id=1')).rows[0].n,1,'Refresh does not create a new exposure')
    const bad=await request(`/master/mocks/${mock.id}/responses`,{method:'PUT',user:1,body:{answers:[{position:26,selected_option_index:0}]}})
    assert.equal(bad.status,409);assert.equal(bad.data.code,'MODULE_LOCKED')
    const save=await request(`/master/mocks/${mock.id}/responses`,{method:'PUT',user:1,body:{answers:[{position:1,selected_option_index:0},{position:2,selected_option_index:1}]}})
    assert.equal(save.status,200,JSON.stringify(save.data));assert.equal(save.data.saved,2)
    const graded=await request(`/master/mocks/${mock.id}/submit`,{method:'POST',user:1,body:{answers:[]}})
    assert.equal(graded.status,200,JSON.stringify(graded.data));assert.equal(graded.data.summary.score,1.5);assert.equal(graded.data.summary.max_score,200)
    assert.equal(graded.data.results.filter(x=>x.not_delivered).length,75)
    assert.equal(graded.data.results[0].correct_option_index,0);assert.equal(graded.data.results[25].correct_option_index,undefined)
    assert.equal((await request(`/attempts/master/${mock.id}/mentor`,{method:'POST',user:1,body:{position:26,intent:'pyq',language:'en'}})).status,409,'Mentor cannot access undelivered content')
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_master_seen WHERE user_id=1')).rows[0].n,25)
    const summary=await request('/master/summary',{user:1})
    assert.equal(summary.status,200,JSON.stringify(summary.data));assert.deepEqual(summary.data.stages,{Tier_1:1,Tier_2:0})
    assert.equal(summary.data.current_streak,1);assert.equal(summary.data.time_zone,'Asia/Kolkata')
    const otherSummary=await request('/master/summary',{user:2})
    assert.deepEqual(otherSummary.data.stages,{Tier_1:0,Tier_2:0});assert.equal(otherSummary.data.current_streak,0)
    assert.equal((await request('/master/summary')).status,401)
    const next=await request('/master/mocks',{method:'POST',body:{category:'Full_Tier1'},user:1})
    assert.equal(next.status,201,JSON.stringify(next.data));assert.equal(next.data.mock.selection.reused_questions,0,'Untouched questions should be used first')
    await request(`/master/mocks/${next.data.mock.id}/cancel`,{method:'POST',user:1})

    const micro={category:'Micro',stage:'Tier_1',subject:'Quant',topic:'Number Systems',sub_topic:'Decimals',count:15,difficulty:'Medium'}
    const m1=await request('/master/mocks',{method:'POST',user:2,body:micro});assert.equal(m1.status,201,JSON.stringify(m1.data))
    const active=await request(`/master/mocks/${m1.data.mock.id}/launch`,{method:'POST',user:2});assert.equal(active.data.questions.length,15);noKeys(active.data)
    const whileActive=await request('/master/mocks',{method:'POST',user:2,body:micro})
    assert.equal(whileActive.status,201,JSON.stringify(whileActive.data));assert.equal(whileActive.data.mock.selection.unseen_questions,5)
    assert.equal(whileActive.data.mock.selection.reused_questions,10,'Delivered active items may be reused only after available unseen content is exhausted')
    await request(`/master/mocks/${whileActive.data.mock.id}/cancel`,{method:'POST',user:2})
    await request(`/master/mocks/${m1.data.mock.id}/submit`,{method:'POST',user:2,body:{answers:[]}})
    const before=await db.query("SELECT source_id FROM cgl_master_seen WHERE user_id=2 AND source_kind='Bank' ORDER BY source_id")
    for(let i=0;i<before.rows.length;i++)await db.query("UPDATE cgl_master_seen SET last_seen_at=DATE '2025-01-01'+$3::int WHERE user_id=$1 AND source_kind='Bank' AND source_id=$2",[2,before.rows[i].source_id,i])
    const m2=await request('/master/mocks',{method:'POST',user:2,body:micro})
    assert.equal(m2.status,201,JSON.stringify(m2.data));assert.equal(m2.data.mock.selection.reused_questions,10);assert.equal(m2.data.mock.selection.unseen_questions,5)
    const picked=(await db.query("SELECT source_id FROM cgl_master_items WHERE mock_id=$1 AND source_kind='Bank'",[m2.data.mock.id])).rows.map(x=>String(x.source_id))
    const old=before.rows.slice(0,10).map(x=>String(x.source_id));assert.ok(old.every(id=>picked.includes(id)),'Least recently seen questions are selected first')
    await request(`/master/mocks/${m2.data.mock.id}/cancel`,{method:'POST',user:2})

    const tier2=await request('/master/mocks',{method:'POST',body:{category:'Full_Tier2',timing_profile:'official_2026'},user:1});assert.equal(tier2.status,201,JSON.stringify(tier2.data))
    assert.equal(tier2.data.mock.question_count,150);assert.deepEqual(tier2.data.mock.modules.map(m=>m.question_count),[30,30,45,25,20])
    const setRows=await db.query(`SELECT q.passage_set_id,COUNT(*)::int n FROM cgl_master_items i JOIN cgl_questions q ON q.id=i.source_id WHERE i.mock_id=$1 AND q.passage_set_id IS NOT NULL GROUP BY q.passage_set_id`,[tier2.data.mock.id])
    assert.deepEqual(setRows.rows.map(x=>x.n).sort((a,b)=>a-b),[4,5,5],'DI, cloze and RC sets remain intact')
    const tier2Launch=await request(`/master/mocks/${tier2.data.mock.id}/launch`,{method:'POST',user:1})
    assert.equal(tier2Launch.status,200,JSON.stringify(tier2Launch.data));assert.equal(tier2Launch.data.questions.length,30);noKeys(tier2Launch.data)
    const chart=tier2Launch.data.questions.find(q=>q.passage?.chart_data)?.passage.chart_data
    assert.deepEqual(chart,{fictional:true,nested:{},series:[1,2]},'Nested chart metadata cannot leak an answer or solution')
    const tier2Grade=await request(`/master/mocks/${tier2.data.mock.id}/submit`,{method:'POST',user:1,body:{answers:[{position:1,selected_option_index:0},{position:2,selected_option_index:1}]}})
    assert.equal(tier2Grade.status,200);assert.equal(tier2Grade.data.summary.score,2);assert.equal(tier2Grade.data.summary.max_score,450)
    assert.equal(tier2Grade.data.summary.actual_merit_max_score,390);assert.equal(tier2Grade.data.summary.computer_max_score,60);assert.equal(tier2Grade.data.summary.computer_qualifying_status,'Pending')
    assert.equal(tier2Grade.data.analytics.merit.score,2);assert.equal(tier2Grade.data.analytics.computer.assessments.UR.status,'Not_Assessed')
    const tier1History=await request('/master/mocks?stage=Tier_1',{user:1}),tier2History=await request('/master/mocks?stage=Tier_2',{user:1})
    assert.ok(tier1History.data.mocks.length>0&&tier1History.data.mocks.every(m=>m.exam_stage==='Tier_1'))
    assert.ok(tier2History.data.mocks.length>0&&tier2History.data.mocks.every(m=>m.exam_stage==='Tier_2'))
    assert.equal((await request('/master/mocks?stage=Tier_3',{user:1})).status,400)
    assert.equal((await request('/master/mocks?status=Building',{user:1})).status,400)
    const submittedHistory=await request('/master/mocks?stage=Tier_1&status=Submitted',{user:1})
    assert.equal(submittedHistory.data.mocks.length,1);assert.ok(submittedHistory.data.mocks.every(m=>m.status==='Submitted'))
    assert.deepEqual((await request('/master/summary',{user:1})).data.stages,{Tier_1:1,Tier_2:1})
    for(const [section,count] of [['Section_I',60],['Section_II',70],['Section_III',20]]){
      const sec=await request('/master/mocks',{method:'POST',user:1,body:{category:'Sectional_Tier2',section}})
      assert.equal(sec.status,201,JSON.stringify(sec.data));assert.equal(sec.data.mock.question_count,count);await request(`/master/mocks/${sec.data.mock.id}/cancel`,{method:'POST',user:1})
    }
    const timed=await request('/master/mocks',{method:'POST',user:1,body:{category:'Sectional_Tier2',section:'Section_II',timing_profile:'official_2026'}})
    assert.equal(timed.status,201);const timedId=timed.data.mock.id
    const english=await request(`/master/mocks/${timedId}/launch`,{method:'POST',user:1});assert.equal(english.data.questions.length,45)
    assert.equal((await request(`/master/mocks/${timedId}/responses`,{method:'PUT',user:1,body:{answers:[{position:1,selected_option_index:0}]}})).status,200)
    // Simulate the server clock reaching the next locked module; trigger
    // disabling is limited to this disposable test database.
    await db.exec(`ALTER TABLE cgl_master_mocks DISABLE TRIGGER cgl_master_mock_guard;
      UPDATE cgl_master_mocks SET started_at=clock_timestamp()-INTERVAL '40 minutes 1 second',expires_at=clock_timestamp()+INTERVAL '19 minutes 59 seconds' WHERE id=${Number(timedId)};
      ALTER TABLE cgl_master_mocks ENABLE TRIGGER cgl_master_mock_guard;`)
    const ga=await request(`/master/mocks/${timedId}/active`,{user:1});assert.equal(ga.status,200);assert.equal(ga.data.timer.current_module.subject,'General_Awareness');assert.equal(ga.data.questions.length,25);noKeys(ga.data)
    assert.equal((await request(`/master/mocks/${timedId}/responses`,{method:'PUT',user:1,body:{answers:[{position:1,selected_option_index:0}]}})).data.code,'MODULE_LOCKED')
    const timedSubmit=await request(`/master/mocks/${timedId}/submit`,{method:'POST',user:1,body:{answers:[{position:46,selected_option_index:0}]}})
    assert.equal(timedSubmit.status,200);assert.equal(timedSubmit.data.summary.score,6);assert.equal(timedSubmit.data.summary.max_score,210)
    const mains=await request('/master/mocks',{method:'POST',user:1,body:{category:'Micro',stage:'Tier_2',subject:'Quant',count:15,difficulty:'Mains_Level'}})
    assert.equal(mains.status,201,JSON.stringify(mains.data));await request(`/master/mocks/${mains.data.mock.id}/cancel`,{method:'POST',user:1})
    for(const subject of ['Quant','Reasoning','English','General_Awareness']){
      const ti=await request('/master/mocks',{method:'POST',user:1,body:{category:'Sectional_Tier1',subject}})
      assert.equal(ti.status,201,JSON.stringify(ti.data));assert.equal(ti.data.mock.question_count,25);assert.equal(ti.data.mock.modules[0].duration_seconds,900);await request(`/master/mocks/${ti.data.mock.id}/cancel`,{method:'POST',user:1})
    }
    for(const [subject,difficulty] of [['Quant','Easy'],['Reasoning','Medium'],['General_Awareness','Hard']]){
      const filtered=await request('/master/mocks',{method:'POST',user:1,body:{category:'Micro',stage:'Tier_1',subject,count:15,difficulty}})
      assert.equal(filtered.status,201,JSON.stringify(filtered.data));const labels=(await db.query('SELECT DISTINCT difficulty FROM cgl_master_items WHERE mock_id=$1',[filtered.data.mock.id])).rows
      assert.deepEqual(labels,[{difficulty}]);await request(`/master/mocks/${filtered.data.mock.id}/cancel`,{method:'POST',user:1})
    }
    assert.equal((await request('/master/mocks',{method:'POST',user:1,body:{category:'Micro',stage:'Tier_1',subject:'Quant',count:15,difficulty:'Mains_Level'}})).status,400)
    assert.equal((await request('/master/mocks',{method:'POST',user:1,body:{category:'Micro',stage:'Tier_1',subject:'Quant',topic:'Not in syllabus',count:15}})).status,400)
    // A source withdrawal invalidates a prepared test, and existing reviewed
    // scores survive with the affected question redacted.
    const bankId=before.rows[0].source_id
    await db.query("UPDATE cgl_questions SET status='Draft' WHERE id=$1",[bankId])
    const bankReview=await request(`/master/mocks/${m1.data.mock.id}/review`,{user:2})
    assert.equal(bankReview.status,200);assert.ok(bankReview.data.results.some(q=>q.content_withdrawn))
    const stale=await request('/master/mocks',{method:'POST',user:2,body:micro});assert.equal(stale.status,201)
    const staleId=(await db.query('SELECT source_id FROM cgl_master_items WHERE mock_id=$1 LIMIT 1',[stale.data.mock.id])).rows[0].source_id
    await db.query("UPDATE cgl_questions SET status='Draft' WHERE id=$1",[staleId])
    const staleLaunch=await request(`/master/mocks/${stale.data.mock.id}/launch`,{method:'POST',user:2})
    assert.equal(staleLaunch.status,409);assert.equal(staleLaunch.data.code,'CONTENT_WITHDRAWN')

    // Reviewed AI questions can be editorially labelled; labels never invent
    // difficulty, override bank ratings, or expose generated solutions.
    const {rows:[source]}=await db.query('SELECT id FROM cgl_pyq_questions WHERE paper_id=$1 ORDER BY position LIMIT 1',[paperId])
    const aiContent={passages:[],questions:[{question_type:'Standard_MCQ',question_text_en:'Fictional generated question?',question_text_hi:'काल्पनिक सवाल?',options:JSON.parse(options),correct_option_index:0,solution_basic:'Fictional solution',solution_trick:'Fictional trick',ideal_time_seconds:20,passage_ref:null}]}
    const {rows:[batch]}=await db.query(`INSERT INTO cgl_ai_batches(source_question_id,exam_stage,format,subject,topic,sub_topic,generator_model,solver_model,auditor_model,content,verification,content_sha256,verification_sha256)
      VALUES($1,'Tier_1','single_concept','Quant','Number Systems','Decimals','fixture-gen','fixture-solve','fixture-audit',$2,$3,$4,$4) RETURNING id`,
      [source.id,JSON.stringify(aiContent),JSON.stringify({blind_solver:true,checks:[{}]}),'3'.repeat(64)])
    await db.query("UPDATE cgl_ai_batches SET status='Published',reviewed_by='Fixture reviewer',review_notes='Fictional batch reviewed',reviewed_at=now() WHERE id=$1",[batch.id])
    await labelMasterQuestion(client,{kind:'AI',id:batch.id,part:1,difficulty:'Hard',mains_level:false,reviewer:'Fixture reviewer',notes:'Fictional difficulty classification'})
    for(let i=0;i<14;i++)await addBank(db,{stage:'Tier_1',subject:'Quant',topic:'Number Systems',subtopic:'Decimals',difficulty:'Hard'})
    const aiMicro=await request('/master/mocks',{method:'POST',user:1,body:{...micro,difficulty:'Hard'}})
    assert.equal(aiMicro.status,201,JSON.stringify(aiMicro.data))
    const labels=(await db.query("SELECT source_kind,difficulty,label_snapshot FROM cgl_master_items WHERE mock_id=$1 AND source_kind='AI'",[aiMicro.data.mock.id])).rows
    assert.equal(labels.length,1);assert.equal(labels[0].difficulty,'Hard');assert.equal(labels[0].label_snapshot.reviewer,'Fixture reviewer')
    await assert.rejects(labelMasterQuestion(client,{kind:'Bank',id:items[0].source_id,difficulty:'Hard',mains_level:false,reviewer:'Fixture reviewer',notes:'Attempted override is rejected'}),/cannot override/)
    const aiLaunch=await request(`/master/mocks/${aiMicro.data.mock.id}/launch`,{method:'POST',user:1});assert.equal(aiLaunch.status,200);noKeys(aiLaunch.data)
    await request(`/master/mocks/${aiMicro.data.mock.id}/submit`,{method:'POST',user:1,body:{answers:[]}})
    const aiPosition=(await db.query("SELECT position FROM cgl_master_items WHERE mock_id=$1 AND source_kind='AI'",[aiMicro.data.mock.id])).rows[0].position
    const aiMentor=await request(`/attempts/master/${aiMicro.data.mock.id}/mentor`,{method:'POST',user:1,body:{position:aiPosition,intent:'step',language:'en'}})
    assert.equal(aiMentor.status,200,JSON.stringify(aiMentor.data));assert.equal(mentorCalls.at(-1).reviewed_trick_solution,'Fictional trick')
    await labelMasterQuestion(client,{kind:'AI',id:batch.id,part:1,difficulty:'Medium',mains_level:false,reviewer:'Second reviewer',notes:'Fictional revised classification'})
    const labelAudit=(await db.query('SELECT COUNT(*)::int n FROM cgl_master_label_history WHERE source_kind=$1 AND source_id=$2',['AI',batch.id])).rows[0]
    assert.equal(labelAudit.n,2)
    assert.equal((await db.query("SELECT label_snapshot->>'difficulty' AS difficulty FROM cgl_master_items WHERE mock_id=$1 AND source_kind='AI'",[aiMicro.data.mock.id])).rows[0].difficulty,'Hard','Past test labels remain snapshotted')

    // Direct historical API attempt records are included in the new engine's
    // seen pool; an intact passage with one seen child is avoided if two fully
    // unseen singleton questions can satisfy the request.
    await db.query("INSERT INTO cgl_pyq_attempts(user_id,mode,paper_id,score,max_score,results) VALUES(2,'Chapter',NULL,0,2,$1)",[JSON.stringify([{question_id:String(source.id)}])])
    const historicalUnseen=await request('/master/mocks',{method:'POST',user:2,body:{category:'PYQ_Topic',subject:'Quant',chapter:'Fixture chapter',count:2}})
    assert.equal(historicalUnseen.status,201,JSON.stringify(historicalUnseen.data));assert.equal(historicalUnseen.data.mock.duration_seconds,120);assert.equal(historicalUnseen.data.mock.selection.reused_questions,0)
    const historicalIds=(await db.query('SELECT source_id FROM cgl_master_items WHERE mock_id=$1',[historicalUnseen.data.mock.id])).rows.map(x=>String(x.source_id))
    assert.ok(!historicalIds.includes(String(source.id)))
    await request(`/master/mocks/${historicalUnseen.data.mock.id}/cancel`,{method:'POST',user:2})
    const shift=await request('/master/mocks',{method:'POST',user:1,body:{category:'PYQ_Shift',paper_id:String(paperId)}})
    assert.equal(shift.status,201,JSON.stringify(shift.data));assert.equal(shift.data.mock.question_count,4)
    const paper=await request(`/master/mocks/${shift.data.mock.id}/launch`,{method:'POST',user:1});assert.equal(paper.status,200);assert.equal(paper.data.questions.length,4);noKeys(paper.data)
    const pgrade=await request(`/master/mocks/${shift.data.mock.id}/submit`,{method:'POST',user:1,body:{answers:[{position:1,selected_option_index:0},{position:2,selected_option_index:1}]}})
    assert.equal(pgrade.status,200,JSON.stringify(pgrade.data));assert.equal(pgrade.data.summary.score,3.5);assert.equal(pgrade.data.summary.max_score,6);assert.equal(pgrade.data.summary.void_count,2)
    const repeat=await request('/master/mocks',{method:'POST',user:1,body:{category:'PYQ_Shift',paper_id:String(paperId)}})
    assert.equal(repeat.status,201);assert.equal(repeat.data.mock.selection.reused_questions,4,'Fixed paper repeats are flagged, not substituted')
    const repeatedPaper=await request(`/master/mocks/${repeat.data.mock.id}/launch`,{method:'POST',user:1});assert.ok(repeatedPaper.data.questions.every(q=>q.previously_seen))
    await request(`/master/mocks/${repeat.data.mock.id}/cancel`,{method:'POST',user:1})
    const topic=await request('/master/mocks',{method:'POST',user:1,body:{category:'PYQ_Topic',subject:'Quant',chapter:'Fixture chapter',count:2}})
    assert.equal(topic.status,201,JSON.stringify(topic.data));assert.equal(topic.data.mock.selection.reused_questions,2)
    const topicRows=(await db.query('SELECT group_key,COUNT(*)::int n FROM cgl_master_items WHERE mock_id=$1 AND group_key IS NOT NULL GROUP BY group_key',[topic.data.mock.id])).rows
    assert.ok(topicRows.every(row=>row.n===2),'Historical passage units remain intact')
    await request(`/master/mocks/${topic.data.mock.id}/cancel`,{method:'POST',user:1})
    await withdrawPyqPaper(client,{paperId,reviewer:'Fixture editor',notes:'Fictional withdrawal test'})
    const after=await request(`/master/mocks/${shift.data.mock.id}/review`,{user:1})
    assert.equal(after.status,200);assert.equal(after.data.summary.score,3.5);assert.ok(after.data.results.every(q=>q.content_withdrawn));noKeys(after.data.results)
    const aiAfter=await request(`/master/mocks/${aiMicro.data.mock.id}/review`,{user:1})
    assert.ok(aiAfter.data.results.some(q=>q.content_withdrawn),'AI derivatives are redacted when their PYQ source is withdrawn')
    assert.equal((await request(`/attempts/master/${aiMicro.data.mock.id}/mentor`,{method:'POST',user:1,body:{position:aiPosition,intent:'step',language:'en'}})).status,409)
    // Requested player profile unlocks every Tier I subject under one clock,
    // but preserves the independent 2026 notice profile tested above.
    const free=await request('/master/mocks',{method:'POST',user:2,body:{category:'Full_Tier1'}})
    assert.equal(free.status,201,JSON.stringify(free.data))
    const freeId=free.data.mock.id,freeStart=await request(`/master/mocks/${freeId}/launch`,{method:'POST',user:2})
    assert.equal(freeStart.data.questions.length,100);assert.equal(freeStart.data.timer.current_modules.length,4);noKeys(freeStart.data)
    assert.match(freeStart.headers.get('cache-control'),/no-store/,'live session responses must not be cached')
    const progress={position:26,selected_option_index:1,visited:true,marked_for_review:true,elapsed_ms:2345,device_id:'fictional-device-00001',client_revision:2}
    assert.equal((await request(`/master/mocks/${freeId}/responses`,{method:'PUT',user:2,body:{answers:[progress]}})).status,200)
    const retryProgress=await request(`/master/mocks/${freeId}/responses`,{method:'PUT',user:2,body:{answers:[progress]}})
    assert.deepEqual(retryProgress.data.ignored_positions,[],'identical revision retry is idempotent')
    const staleProgress=await request(`/master/mocks/${freeId}/responses`,{method:'PUT',user:2,body:{answers:[{...progress,client_revision:1,selected_option_index:0}]}})
    assert.deepEqual(staleProgress.data.ignored_positions,[26],'out-of-order response cannot overwrite newer progress')
    const collision=await request(`/master/mocks/${freeId}/responses`,{method:'PUT',user:2,body:{answers:[{...progress,selected_option_index:0}]}})
    assert.deepEqual(collision.data.ignored_positions,[26],'conflicting duplicate revision is reported')
    const restored=(await request(`/master/mocks/${freeId}/active`,{user:2})).data.questions.find(q=>q.position===26)
    assert.equal(restored.selected_option_index,1);assert.equal(restored.visited,true);assert.equal(restored.marked_for_review,true);assert.equal(restored.time_spent_ms,2345,'time retries are idempotent')
    const freeReview=await request(`/attempts/master/${freeId}/submit`,{method:'POST',user:2,body:{answers:[]}})
    assert.equal(freeReview.status,200);assert.equal(freeReview.data.results.find(q=>q.position===26).time_spent_ms,2345)
    assert.equal(freeReview.data.analytics.screening.max_score,200);assert.equal(freeReview.data.analytics.screening.delivered,true)
    assert.equal(freeReview.data.analytics.timing.by_outcome.wrong.total_seconds,2.345)
    const simulationBody={shifts:[[{score:-1,count:1},{score:1,count:1}],[{score:-2,count:1},{score:2,count:1}]]}
    const savedBefore=(await db.query('SELECT summary FROM cgl_master_mocks WHERE id=$1',[freeId])).rows[0].summary
    const simulation=await request(`/attempts/master/${freeId}/simulate`,{method:'POST',user:2,body:simulationBody})
    assert.equal(simulation.status,200,JSON.stringify(simulation.data));assert.equal(simulation.data.simulation.raw_score,freeReview.data.analytics.screening.score)
    assert.deepEqual((await db.query('SELECT summary FROM cgl_master_mocks WHERE id=$1',[freeId])).rows[0].summary,savedBefore,'simulation does not rewrite stored history')
    assert.equal((await request(`/attempts/master/${freeId}/simulate`,{method:'POST',user:1,body:simulationBody})).status,404)
    assert.equal((await request(`/attempts/master/${freeId}/simulate`,{method:'POST',body:simulationBody})).status,401)
    const ownedReview=await request(`/attempts/master/${freeId}`,{user:2});assert.equal(ownedReview.status,200);assert.match(ownedReview.headers.get('cache-control'),/no-store/)
    assert.equal((await request(`/attempts/master/${freeId}`,{user:1})).status,404)
    assert.ok((await request('/attempts/master?stage=Tier_1',{user:2})).data.mocks.some(m=>String(m.id)===String(freeId)))

    const hall=await request('/master/mocks',{method:'POST',user:2,body:{category:'Full_Tier2'}})
    assert.equal(hall.status,201,JSON.stringify(hall.data));const hallId=hall.data.mock.id
    const hallStart=await request(`/master/mocks/${hallId}/launch`,{method:'POST',user:2})
    assert.equal(hallStart.data.questions.length,60);assert.equal(hallStart.data.timer.current_section,'Section_I');assert.equal(hallStart.data.timer.current_modules.length,2);noKeys(hallStart.data)
    assert.equal((await request(`/attempts/master/${hallId}/submit`,{method:'POST',user:2,body:{answers:[]}})).data.code,'SECTION_LOCKED','final submission cannot bypass locked sections')
    assert.equal((await request(`/master/mocks/${hallId}/responses`,{method:'PUT',user:2,body:{answers:[{position:61,selected_option_index:0}]}})).data.code,'MODULE_LOCKED')
    const advance=await request(`/master/mocks/${hallId}/advance`,{method:'POST',user:2,body:{section:'Section_I'}})
    assert.equal(advance.status,200,JSON.stringify(advance.data));assert.equal(advance.data.timer.current_section,'Section_II');assert.equal(advance.data.questions.length,70);noKeys(advance.data)
    assert.equal((await request(`/attempts/master/${hallId}/submit`,{method:'POST',user:2,body:{answers:[]}})).data.code,'SECTION_LOCKED')
    const retry=await request(`/master/mocks/${hallId}/advance`,{method:'POST',user:2,body:{section:'Section_I'}})
    assert.equal(retry.data.timer.current_section,'Section_II','retry does not skip a section')
    assert.equal((await request(`/master/mocks/${hallId}/responses`,{method:'PUT',user:2,body:{answers:[{position:1,selected_option_index:0}]}})).data.code,'MODULE_LOCKED')
    const nextSection=await request(`/master/mocks/${hallId}/advance`,{method:'POST',user:2,body:{section:'Section_II'}})
    assert.equal(nextSection.data.timer.current_section,'Section_III');assert.equal(nextSection.data.questions.length,20)
    const hallReview=await request(`/master/mocks/${hallId}/submit`,{method:'POST',user:2,body:{answers:[]}})
    assert.equal(hallReview.data.analytics.merit.max_score,390);assert.equal(hallReview.data.analytics.computer.assessments.UR.status,'Not_Qualified')

    // A source withdrawal preserves the recorded score but must not support a
    // new percentile projection from an incomplete reviewed full mock.
    await db.query(`UPDATE cgl_questions SET status='Draft' WHERE id=(SELECT q.id FROM cgl_questions q
      JOIN cgl_master_items i ON i.source_kind='Bank' AND i.source_id=q.id
      WHERE i.mock_id=$1 AND q.passage_set_id IS NULL LIMIT 1)`,[freeId])
    const withdrawnReview=await request(`/attempts/master/${freeId}`,{user:2})
    assert.equal(withdrawnReview.data.summary.score,freeReview.data.summary.score)
    assert.equal(withdrawnReview.data.analytics.screening.content_available,false)
    assert.equal((await request(`/attempts/master/${freeId}/simulate`,{method:'POST',user:2,body:simulationBody})).status,409)

    // Cascading account deletion is not blocked by immutable master items.
    await db.query('BEGIN');await db.query('DELETE FROM users WHERE id=2');await db.query('ROLLBACK')
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM attempts')).rows[0].n,1,'Existing learner history is preserved')
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',['wrong',MASTER_MIGRATION_VERSION])
    assert.equal((await request('/master/mocks',{user:1})).data.code,'SSC_CGL_MASTER_CHECKSUM_MISMATCH')
    assert.equal((await request('/mock-tests')).status,200)
  }finally{await f.close()}
})

test('module timers use the official 30/30/40/20/15 boundaries and never expose future modules',()=>{
  const mock={started_at:'2026-01-01T00:00:00Z',expires_at:'2026-01-01T02:15:00Z',modules:TIER2_MODULES}
  const at=seconds=>timingState(mock,new Date(Date.parse(mock.started_at)+seconds*1000))
  assert.equal(at(0).current_module.code,'Section_I_A');assert.equal(at(1799).current_module.code,'Section_I_A')
  assert.equal(at(1800).current_module.code,'Section_I_B');assert.equal(at(3600).current_module.code,'Section_II_A')
  assert.equal(at(6000).current_module.code,'Section_II_B');assert.equal(at(7200).current_module.code,'Section_III');assert.equal(at(8100).state,'Expired')
})

test('requested section timing groups Tier II modules and retains single Tier I timer',()=>{
  const start=new Date('2026-01-01T00:00:00Z'),mock={category:'Full_Tier2',specification:{timing_profile:'exam_hall_v1'},started_at:start,expires_at:new Date(+start+8100e3),modules:TIER2_MODULES}
  const at=seconds=>timingState(mock,new Date(+start+seconds*1000))
  assert.equal(at(0).current_section,'Section_I');assert.equal(at(3599).current_section,'Section_I')
  assert.equal(at(3600).current_section,'Section_II');assert.equal(at(7199).current_section,'Section_II')
  assert.equal(at(7200).current_section,'Section_III');assert.equal(at(8100).state,'Expired')
  const tier1={category:'Full_Tier1',specification:{timing_profile:'exam_hall_v1'},started_at:start,expires_at:new Date(+start+3600e3),modules:TIER1_MODULES}
  assert.equal(timingState(tier1,new Date(+start+1800e3)).current_modules.length,4,'all Tier I sections remain navigable halfway through')
  assert.equal(timingState(tier1,new Date(+start+3600e3)).state,'Expired')
  const sectional={category:'Sectional_Tier2',specification:{timing_profile:'exam_hall_v1'},started_at:start,expires_at:new Date(+start+3600e3),modules:TIER2_MODULES.slice(2,4)}
  assert.equal(timingState(sectional,new Date(+start+2500e3)).current_modules.length,2,'sectional subjects share one clock')
  mock.early_advances=[{section_code:'Section_I',advanced_at:new Date(+start+600e3)}]
  assert.equal(at(600).current_section,'Section_II');assert.equal(at(4200).current_section,'Section_III')
})

test('solver exhausts eligible unseen groups before LRU reuse without splitting sets',async()=>{
  const units=Array.from({length:7},(_,i)=>({key:`set${i}`,module_code:'M',items:Array.from({length:2},(_,j)=>({source_kind:'Bank',source_id:String(2*i+j+1),source_part:0,subject:'Quant',topic:'Fixture',difficulty:'Medium'}))}))
  const seen=new Map(units.slice(0,3).flatMap((unit,i)=>unit.items.map(item=>[sourceKey(item),`2025-01-0${i+1}`])))
  const result=await selectMasterUnits(units,{category:'Micro'},[{code:'M',question_count:10}],seen)
  assert.equal(result.reused_questions,2);assert.equal(result.unseen_questions,8);assert.ok(result.units.some(u=>u.key==='set0'))
  await assert.rejects(selectMasterUnits(units,{category:'Micro'},[{code:'M',question_count:9}],seen),error=>error.code==='INSUFFICIENT_REVIEWED_CONTENT')
})

test('master migration failure rolls back without deleting user history',async()=>{
  const f=await fixture(),{db,client}=f
  try{
    await migrateSscCgl(client,{resetLegacyBank:true})
    const fail={query:async(sql,args)=>{if(sql.startsWith('-- Additive per-learner master assembler.')||sql.startsWith('-- Additive exam-player progress;')){await client.query(sql,args);throw new Error('injected master migration failure')}return client.query(sql,args)}}
    await assert.rejects(migrateMasterAssembler(fail),/injected master migration failure/)
    const {rows:[state]}=await db.query(`SELECT to_regclass('public.cgl_master_mocks') AS mocks,(SELECT COUNT(*)::int FROM cgl_schema_migrations WHERE version=$1) AS migration,
      (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM attempts) AS history`,[MASTER_MIGRATION_VERSION])
    assert.deepEqual(state,{mocks:null,migration:0,users:2,history:1})
    assert.equal((await migrateMasterAssembler(client)).applied,true)
    const formats=await f.request('/master/formats');assert.equal(formats.status,200);assert.equal(formats.data.assembler.ok,true)
    assert.equal(formats.data.optional_sources.pyq.ok,false);assert.equal(formats.data.optional_sources.ca.ok,false)
    assert.equal((await f.request('/master/mocks',{method:'POST',user:1,body:{category:'Full_Tier1'}})).data.code,'INSUFFICIENT_REVIEWED_CONTENT')
    assert.equal((await f.request('/master/mocks',{method:'POST',user:1,body:{category:'PYQ_Shift',paper_id:'1'}})).status,503)
    assert.equal((await f.request('/master/mocks',{method:'POST',user:1,body:{category:'CA_Annual',stage:'Tier_1',year:2025}})).status,503)
  }finally{await f.close()}
})

test('player migration upgrades an existing master installation atomically without clearing history',async()=>{
  const f=await fixture(),{client,db}=f
  try{
    await migrateSscCgl(client,{resetLegacyBank:true})
    const sql=await readFile(new URL('../migrations/005_ssc_cgl_master_assembler.sql',import.meta.url),'utf8')
    await client.query(sql)
    await db.query('INSERT INTO cgl_schema_migrations(version,checksum) VALUES($1,$2)',[MASTER_MIGRATION_VERSION,MASTER_MIGRATION_CHECKSUM])
    const failing={query:async(sql,args)=>{if(sql.startsWith('-- Additive exam-player progress;')){await client.query(sql,args);throw new Error('injected player migration failure')}return client.query(sql,args)}}
    await assert.rejects(migrateMasterAssembler(failing),/injected player/)
    assert.equal((await db.query("SELECT to_regclass('public.cgl_master_player_progress') IS NOT NULL AS present")).rows[0].present,false)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM attempts')).rows[0].n,1)
    const upgrade=await migrateMasterAssembler(client);assert.equal(upgrade.applied,false);assert.equal(upgrade.player_applied,true)
    assert.equal((await migrateMasterAssembler(client)).player_applied,false)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_schema_migrations WHERE version=$1',[PLAYER_MIGRATION_VERSION])).rows[0].n,1)
  }finally{await f.close()}
})

test('integer optimizer agrees with brute force on repeat count and recency across grouped pools',async()=>{
  let random=9812;const next=max=>{random=(random*1664525+1013904223)>>>0;return random%max}
  for(let trial=0;trial<16;trial++){
    let id=0
    const units=Array.from({length:7},(_,i)=>({key:`unit-${i}`,module_code:'M',items:Array.from({length:1+next(3)},()=>({
      source_kind:'Bank',source_id:String(++id),source_part:0,subject:'Quant',topic:'Fixture',difficulty:'Medium'}))}))
    const seen=new Map()
    for(const unit of units)for(const item of unit.items)if(next(4)===0)seen.set(sourceKey(item),`2025-01-${String(1+next(20)).padStart(2,'0')}`)
    const ranked=[...seen].sort((a,b)=>Number(new Date(a[1]))-Number(new Date(b[1]))||a[0].localeCompare(b[0]))
    const rank=new Map(ranked.map(([key],i)=>[key,i+1])),target=1+next(9)
    let optimum=null
    for(let mask=0;mask<(1<<units.length);mask++){
      const picked=units.filter((_,i)=>mask&(1<<i)).flatMap(u=>u.items)
      if(picked.length!==target)continue
      const cost=[picked.filter(q=>seen.has(sourceKey(q))).length,picked.reduce((sum,q)=>sum+(rank.get(sourceKey(q))||0),0)]
      if(!optimum||cost[0]<optimum[0]||(cost[0]===optimum[0]&&cost[1]<optimum[1]))optimum=cost
    }
    if(!optimum){await assert.rejects(selectMasterUnits(units,{category:'Micro'},[{code:'M',question_count:target}],seen),error=>error.code==='INSUFFICIENT_REVIEWED_CONTENT');continue}
    const result=await selectMasterUnits(units,{category:'Micro'},[{code:'M',question_count:target}],seen)
    const picked=result.units.flatMap(unit=>unit.items)
    assert.equal(picked.length,target)
    assert.deepEqual([result.reused_questions,picked.reduce((sum,q)=>sum+(rank.get(sourceKey(q))||0),0)],optimum,`trial ${trial}`)
  }
})


test('public projection strips nested answer fields without deleting learner selections',()=>{
  const original={selected_option_index:1,chart_data:{correct_option_index:2,correctAnswer:'B',answer_status:'Single',final_key_url:'https://example.invalid/key',nested:[{solution_basic:'secret',is_correct:true,values:[1,2]}]}}
  assert.deepEqual(redactPublicQuestion(original),{selected_option_index:1,chart_data:{nested:[{values:[1,2]}]}})
  assert.equal(original.chart_data.correct_option_index,2,'Redaction does not mutate the review source')
})

test('summary counts all stages and consecutive India-calendar days per user',async()=>{
  const f=await fixture(),{db,client,request}=f
  try{
    await migrateSscCgl(client,{resetLegacyBank:true});await migrateMasterAssembler(client)
    async function submitted(user,stage,daysAgo,answered=true){
      const modules=JSON.stringify([{code:'Fixture',section:'Practice',subject:'Quant',question_count:1,duration_seconds:null,correct_marks:2,wrong_deduction:.5}])
      const {rows:[m]}=await db.query(`INSERT INTO cgl_master_mocks(user_id,category,exam_stage,title,specification,modules,question_count,selection,expires_at)
        VALUES($1,'Micro',$2,'Fictional summary fixture','{}',$3,1,'{}',now()+interval '1 day') RETURNING id`,[user,stage,modules])
      await db.query(`INSERT INTO cgl_master_items(mock_id,position,module_code,source_kind,source_id,source_part,subject,correct_marks,wrong_deduction,counts_for_merit)
        VALUES($1,1,'Fixture','Bank',$1,0,'Quant',2,0.5,false)`,[m.id])
      await db.query("UPDATE cgl_master_mocks SET status='Prepared' WHERE id=$1",[m.id])
      await db.query("UPDATE cgl_master_mocks SET status='Active',started_at=now() WHERE id=$1",[m.id])
      if(answered)await db.query('INSERT INTO cgl_master_responses(mock_id,position,selected_option_index) VALUES($1,1,0)',[m.id])
      await db.query(`UPDATE cgl_master_mocks SET status='Submitted',summary='{}',submitted_at=(((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date-$2::int)::timestamp AT TIME ZONE 'Asia/Kolkata') WHERE id=$1`,[m.id,daysAgo])
    }
    for(const [stage,day] of [['Tier_1',0],['Tier_2',1],['Tier_1',3],['Tier_2',4]])await submitted(1,stage,day)
    for(const day of [1,2,4])await submitted(2,'Tier_1',day)
    await submitted(2,'Tier_2',0,false)
    const one=(await request('/master/summary',{user:1})).data,two=(await request('/master/summary',{user:2})).data
    assert.deepEqual(one.stages,{Tier_1:2,Tier_2:2});assert.equal(one.current_streak,2,'a gap ends the streak')
    const recent=(await request('/master/mocks?status=Submitted',{user:1})).data.mocks
    assert.deepEqual(recent.map(m=>new Date(m.submitted_at).getTime()),recent.map(m=>new Date(m.submitted_at).getTime()).sort((a,b)=>b-a),'submitted history sorts by submission time')
    assert.deepEqual(two.stages,{Tier_1:3,Tier_2:1});assert.equal(two.current_streak,2,'an empty submission does not extend the streak, while yesterday keeps it alive')
  }finally{await f.close()}
})

test('Mentor is owner-only and submitted-only, grounds answers in the review, respects permissions and never invents PYQs',async()=>{
  let onRelease=null;const inner=createMentorLimiter({perUser:100,global:200}),limiter={enter(user){const release=inner.enter(user);return release?()=>{release();onRelease?.()}:null}}
  const calls=[],cfg={provider:{complete:async(context)=>{calls.push(context);return 'Fictional short explanation.'}},allowBank:false,limiter}
  const f=await fixture(cfg),{db,client,request}=f
  try{
    await migrateSscCgl(client,{resetLegacyBank:true});await migratePyqAi(client);await migrateMasterAssembler(client)
    for(let i=0;i<15;i++)await addBank(db,{stage:'Tier_1',subject:'Quant',topic:'Number Systems',subtopic:'Decimals',difficulty:'Medium'})
    const paper=await buildPyq(db),restrictedPaper=await buildPyq(db,{code:'RESTRICTED',allowExternal:false,importHash:'3'})
    const draft=await request('/master/mocks',{method:'POST',user:1,body:{category:'Micro',stage:'Tier_1',subject:'Quant',topic:'Number Systems',sub_topic:'Decimals',count:15,difficulty:'Medium'}})
    assert.equal(draft.status,201,JSON.stringify(draft.data));const id=draft.data.mock.id,path=`/attempts/master/${id}/mentor`,body={position:1,intent:'trick',language:'en'}
    assert.equal((await request(path,{method:'POST',body})).status,401)
    assert.equal((await request(path,{method:'POST',body,user:2})).status,404)
    assert.equal((await request(path,{method:'POST',body,user:1})).status,409,'prepared practice cannot reveal solutions')
    const live=await request(`/master/mocks/${id}/launch`,{method:'POST',user:1});assert.equal(live.status,200);noKeys(live.data)
    assert.equal((await request(path,{method:'POST',body,user:1})).status,409,'active practice cannot reveal solutions')
    const submit=await request(`/master/mocks/${id}/submit`,{method:'POST',user:1,body:{answers:[{position:1,selected_option_index:1}]}});assert.equal(submit.status,200)
    const before=(await db.query('SELECT summary FROM cgl_master_mocks WHERE id=$1',[id])).rows[0].summary
    assert.equal((await request(path,{method:'POST',user:1,body:{...body,question:'injected question',solution_basic:'injected'}})).status,400)
    const denied=await request(path,{method:'POST',user:1,body});assert.equal(denied.status,403);assert.equal(denied.data.code,'MENTOR_RIGHTS_REQUIRED');assert.equal(calls.length,0)
    cfg.allowBank=true
    const ok=await request(path,{method:'POST',user:1,body});assert.equal(ok.status,200,JSON.stringify(ok.data));assert.match(ok.headers.get('cache-control'),/no-store/)
    assert.equal(ok.data.answer,'Fictional short explanation.');assert.match(calls[0].question,/Fictional practice question/)
    assert.equal(calls[0].reviewed_basic_solution,'Fictional basic solution');assert.equal(calls[0].reviewed_trick_solution,'Fictional shortcut')
    assert.deepEqual(calls[0].learner_choice,{index:1,label:'B',text:'Fixture B',is_correct:false});assert.deepEqual(calls[0].reviewed_correct_option_indices,[0])
    const hindi=await request(path,{method:'POST',user:1,body:{...body,intent:'eliminate',language:'hi'}});assert.equal(hindi.status,200);assert.equal(calls[1].learner_choice.text,'विकल्प ब');assert.equal(calls[1].reviewed_basic_solution,'काल्पनिक समाधान');assert.equal(calls[1].reviewed_trick_solution,'Fictional shortcut')
    assert.equal((await request(path,{method:'POST',user:1,body:{...body,intent:'custom',message:'x'.repeat(501)}})).status,400)
    const local=await request(path,{method:'POST',user:1,body:{...body,intent:'pyq'}});assert.equal(local.status,200,JSON.stringify(local.data));assert.equal(local.data.items.length,0);assert.match(local.data.message,/No published/)
    cfg.provider=null;const unavailable=await request(path,{method:'POST',user:1,body});assert.equal(unavailable.status,503);assert.equal(unavailable.data.code,'MENTOR_NOT_CONFIGURED');cfg.provider={complete:async(context)=>{calls.push(context);return 'Safe reply'}}
    assert.deepEqual((await db.query('SELECT summary FROM cgl_master_mocks WHERE id=$1',[id])).rows[0].summary,before,'Mentor never alters learner history')
    // Closing the drawer aborts the provider request and releases the source
    // locks and concurrency slot, without changing the saved review.
    let markStarted,markAborted
    const started=new Promise(resolve=>{markStarted=resolve}),aborted=new Promise(resolve=>{markAborted=resolve})
    cfg.provider={complete:(_context,{signal})=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>{markAborted();reject(new Error('request aborted'))},{once:true});markStarted()})}
    const controller=new AbortController(),pending=request(path,{method:'POST',user:1,body,signal:controller.signal}).catch(error=>error)
    await started;const released=new Promise(resolve=>{onRelease=resolve});controller.abort();const error=await pending
    assert.equal(error.name,'AbortError');await aborted;await released;onRelease=null
    cfg.provider={complete:async(context)=>{calls.push(context);return 'Safe reply'}}
    assert.equal((await request(path,{method:'POST',user:1,body})).status,200,'a disconnected request does not leave locks held')
    // Real (fictional fixture) PYQ rows, not AI-invented examples.
    const prepare=await request('/master/mocks',{method:'POST',user:1,body:{category:'PYQ_Shift',paper_id:String(paper)}});assert.equal(prepare.status,201,JSON.stringify(prepare.data));const pyqId=prepare.data.mock.id
    await request(`/master/mocks/${pyqId}/launch`,{method:'POST',user:1});await request(`/master/mocks/${pyqId}/submit`,{method:'POST',user:1,body:{answers:[]}})
    const pyqPath=`/attempts/master/${pyqId}/mentor`
    const related=await request(pyqPath,{method:'POST',user:1,body:{position:1,intent:'pyq',language:'en'}})
    assert.equal(related.status,200,JSON.stringify(related.data));assert.ok(related.data.items.length>0);assert.ok(related.data.items.every(q=>q.question.includes('Fictional historical question')))
    assert.ok(related.data.items.every(q=>q.paper_url==='https://example.invalid/paper'))
    assert.equal((await request(pyqPath,{method:'POST',user:1,body:{position:3,intent:'trick',language:'en'}})).status,409,'void keys are not explained as correct')
    const pyqAnswer=await request(pyqPath,{method:'POST',user:1,body:{position:1,intent:'step',language:'en'}});assert.equal(pyqAnswer.status,200,JSON.stringify(pyqAnswer.data))
    const restricted=await request('/master/mocks',{method:'POST',user:1,body:{category:'PYQ_Shift',paper_id:String(restrictedPaper)}});assert.equal(restricted.status,201,JSON.stringify(restricted.data));const rid=restricted.data.mock.id
    await request(`/master/mocks/${rid}/launch`,{method:'POST',user:1});await request(`/master/mocks/${rid}/submit`,{method:'POST',user:1,body:{answers:[]}})
    const noRights=await request(`/attempts/master/${rid}/mentor`,{method:'POST',user:1,body:{position:1,intent:'step',language:'en'}});assert.equal(noRights.status,403);assert.equal(noRights.data.code,'MENTOR_RIGHTS_REQUIRED')
    const item=(await db.query('SELECT source_id FROM cgl_master_items WHERE mock_id=$1 AND position=1',[id])).rows[0]
    await db.query("UPDATE cgl_questions SET status='Draft' WHERE id=$1",[item.source_id])
    const withdrawn=await request(path,{method:'POST',user:1,body});assert.equal(withdrawn.status,409);assert.equal(withdrawn.data.code,'MENTOR_CONTENT_UNAVAILABLE')
    await withdrawPyqPaper(client,{paperId:String(paper),reviewer:'Fixture reviewer',notes:'Synthetic permission withdrawn'})
    assert.equal((await request(pyqPath,{method:'POST',user:1,body:{position:1,intent:'pyq',language:'en'}})).status,409)
  }finally{await f.close()}
})
