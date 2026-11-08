import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,writeFile,rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl } from '../migration-core.js'
import { migratePyqAi, PYQ_MIGRATION_CHECKSUM, PYQ_MIGRATION_VERSION } from '../pyq-migration.js'
import { fileDigest } from '../content-utils.js'
import { ingestPyqManifest, normalizePyqManifest, publishPyqPaper, withdrawPyqPaper } from '../pyq-ingest.js'
import { generateIsomorphic, publishAiBatch, withdrawAiBatch } from '../ai-question-engine.js'
import { checkNumericExpression, evaluateExpression, parseNumericOption } from '../ai-arithmetic.js'
import { createOpenAICompatibleProvider } from '../ai-provider.js'
import { createCglRouter } from '../cgl-api.js'

// All names, questions and evidence below are synthetic test fixtures, never
// presented as actual SSC questions or included in any production seed.
async function fixture() {
  const dir=await mkdtemp(path.join(os.tmpdir(),'cgl-pyq-fixture-'))
  const evidence={paper:path.join(dir,'paper'),finalKey:path.join(dir,'key'),rights:path.join(dir,'rights')}
  await Promise.all(Object.entries(evidence).map(([name,p])=>writeFile(p,`fictional fixture evidence ${name}`)))
  const db=await PGlite.create()
  await db.exec("CREATE TABLE users(id SERIAL PRIMARY KEY); INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES; CREATE TABLE attempts(id INT PRIMARY KEY); INSERT INTO attempts VALUES (1)")
  const client={query:(sql,args)=>sql.includes('DROP TABLE IF EXISTS mock_test_questions;') || sql.startsWith('-- Additive vault and AI draft tables.')
    ? db.exec(sql).then(()=>({rows:[]})) : db.query(sql,args),release:()=>{}}
  const manifest={schema_version:1,paper:{cycle_year:2021,exam_stage:'Tier_2',paper_code:'FIXTURE',exam_date:'2022-08-08',shift_label:'Fixture shift',title:'FICTIONAL TEST ONLY',duration_seconds:7200,expected_questions:4},
    source:{paper_url:'https://example.invalid/paper',final_key_url:'https://example.invalid/key',final_key_type:'Final',paper_sha256:await fileDigest(evidence.paper),final_key_sha256:await fileDigest(evidence.finalKey),rights_sha256:await fileDigest(evidence.rights),rights_reference:'Synthetic permission for tests',source_description:'Fictional test data only',allow_derivatives:true,allow_external_processing:true,redacted:true},
    sections:[{code:'QUANT',label:'Math fixture',position:1,expected_questions:2,correct_marks:2,wrong_deduction:0.5},{code:'ENG',label:'English fixture',position:2,expected_questions:2,correct_marks:1,wrong_deduction:0.25}],
    passages:[{ref:'P1',text_en:'A fictional source passage for isolated automated tests.',text_hi:null}],
    questions:[
      {source_question_ref:'f1',section_code:'QUANT',position:1,subject:'Quant',chapter:'Percentages',canonical:{subject:'Quant',topic:'Fundamental Arithmetical Operations',sub_topic:'Percentages',exam_stage:'Tier_2'},question_text_en:'Fixture: what is 10% of 60?',options:[{en:'3'},{en:'6'},{en:'9'},{en:'12'}],answer_status:'Single',correct_option_indices:[1],solution_basic:'Fixture explanation',solution_trick:'Fixture shortcut'},
      {source_question_ref:'f2',section_code:'QUANT',position:2,subject:'Quant',chapter:'Percentages',question_text_en:'Fixture: select an accepted option?',options:[{en:'A'},{en:'B'},{en:'C'},{en:'D'}],answer_status:'Multiple',correct_option_indices:[0,2]},
      {source_question_ref:'f3',section_code:'ENG',position:3,subject:'English',chapter:'Comprehension',canonical:{subject:'English',topic:'Comprehension',sub_topic:'Comprehension passage',exam_stage:'Tier_2'},passage_ref:'P1',question_text_en:'Fixture: what does the passage describe?',options:[{en:'A test'},{en:'A train'},{en:'A house'},{en:'A river'}],answer_status:'Single',correct_option_indices:[0]},
      {source_question_ref:'f4',section_code:'ENG',position:4,subject:'English',chapter:'Comprehension',passage_ref:'P1',question_text_en:'Fixture: an excluded question?',options:[{en:'A'},{en:'B'},{en:'C'},{en:'D'}],answer_status:'Void',correct_option_indices:[],void_policy:'Excluded'},
    ]}
  return {db,client,manifest,evidence,close:async()=>{await db.close();await rm(dir,{recursive:true,force:true})}}
}
const numericCandidate=()=>({isomorphism_explanation:'Same percentage operation using different numbers.',passages:[],questions:[{question_type:'Standard_MCQ',question_text_en:'What is 20% of 150?',question_text_hi:'150 का 20% क्या है?',options:[{en:'20',hi:'२०'},{en:'30',hi:'३०'},{en:'40',hi:'४०'},{en:'50',hi:'५०'}],correct_option_index:1,solution_basic:'Calculate 150 times 20 divided by 100 to get 30.',solution_trick:'One fifth of 150 equals 30.',ideal_time_seconds:20,passage_ref:null,verification_expression:{op:'div',args:[{op:'mul',args:[150,20]},100]}}]})
const audit={isomorphic:true,original_enough:true,basic_correct:true,trick_correct:true,translation_consistent:true,expression_matches_wording:true,notes:'Both methods and the translation are consistent.'}
function fakeProvider({candidate=numericCandidate(),solverIndex=1,auditResult=audit,record=[]}={}) {
  return {models:{generator:'fake-gen',solver:'fake-independent',auditor:'fake-audit'},async complete(role,{user}){record.push({role,user});
    if(role==='generator')return structuredClone(candidate)
    if(role==='solver')return {answer_index:solverIndex,unique_correct:true,well_posed:true,steps:'Independent steps give the selected answer.'}
    return structuredClone(auditResult)}}
}
function tripleCandidate() {
  const passages=[1,2,3].map(n=>({ref:`p${n}`,text_en:`Original fictional reading passage number ${n} with sufficient contextual detail.`,text_hi:`यह काल्पनिक अनुच्छेद संख्या ${n} है, जिसमें पर्याप्त विवरण है।`}))
  const questions=passages.flatMap((p,pn)=>[1,2,3,4].map(n=>({question_type:'Passage_Based',question_text_en:`In passage ${pn+1}, what is the answer to question ${n}?`,question_text_hi:`अनुच्छेद ${pn+1} में प्रश्न ${n} का उत्तर क्या है?`,options:[{en:'Option A',hi:'विकल्प क'},{en:'Option B',hi:'विकल्प ख'},{en:'Option C',hi:'विकल्प ग'},{en:'Option D',hi:'विकल्प घ'}],correct_option_index:0,solution_basic:'The relevant passage explicitly supports the first answer.',solution_trick:'Eliminate unsupported options using the passage.',ideal_time_seconds:40,passage_ref:p.ref,verification_expression:null})))
  return {isomorphism_explanation:'Original passages exercise similar comprehension skills.',passages,questions}
}

test('PYQ vault migration, provenance, historical scoring, AI checks and HTTP privacy',async()=>{
  const f=await fixture(),{db,client,manifest,evidence}=f
  const app=express();app.use(express.json())
  const auth=(req,res,next)=>{if(!['1','2'].includes(req.get('x-test-user')))return res.status(401).json({error:'Missing token'});req.userId=Number(req.get('x-test-user'));next()}
  app.use('/api/cgl',createCglRouter({pool:{connect:async()=>client},query:client.query,auth}))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const url=`http://127.0.0.1:${server.address().port}/api/cgl`
  const get=async(path,user)=>{const r=await fetch(url+path,{headers:user?{'x-test-user':String(user)}:{}});return {status:r.status,body:await r.json()}}
  const post=async(path,body,user)=>{const r=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json',...(user?{'x-test-user':String(user)}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
  try {
    await assert.rejects(migratePyqAi(client),/001/)
    await migrateSscCgl(client,{resetLegacyBank:true})
    assert.equal((await get('/pyq/papers')).body.code,'SSC_CGL_PYQ_MIGRATION_REQUIRED')
    assert.equal((await get('/health')).status,200)
    assert.equal((await migratePyqAi(client)).applied,true);assert.equal((await migratePyqAi(client)).applied,false)
    assert.deepEqual((await get('/pyq/papers')).body.papers,[])
    await assert.rejects(ingestPyqManifest(client,manifest,{...evidence,finalKey:evidence.rights}),/digest mismatch/)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_pyq_papers')).rows[0].n,0)
    assert.throws(()=>normalizePyqManifest({...manifest,candidate_roll_number:'PII'}),/unsupported fields/)
    assert.throws(()=>normalizePyqManifest({...manifest,source:{...manifest.source,final_key_type:'Tentative'}}),/final key/)
    assert.throws(()=>normalizePyqManifest({...manifest,source:{...manifest.source,paper_url:'https://example.invalid/paper?token=secret'}}),/without credentials/)
    const partial=structuredClone(manifest);partial.paper.cycle_year=2022;partial.questions=partial.questions.slice(0,1)
    const incomplete=await ingestPyqManifest(client,partial,evidence)
    await assert.rejects(publishPyqPaper(client,{paperId:incomplete.paper_id,reviewer:'Fixture reviewer',notes:'Fictional complete review'}),/complete/i)
    assert.equal((await get(`/pyq/papers/${incomplete.paper_id}`)).status,404)
    const changed=structuredClone(partial);changed.questions[0].question_text_en='Changed after import'
    await assert.rejects(ingestPyqManifest(client,changed,evidence),/cannot remove or change/)
    const replaced=await ingestPyqManifest(client,changed,evidence,{replaceDraft:true})
    assert.equal(replaced.replaced,true);assert.equal(String(replaced.paper_id),String(incomplete.paper_id))
    const invalidReplacement=structuredClone(changed);invalidReplacement.questions[0].canonical.topic='Nonexistent fixture topic'
    await assert.rejects(ingestPyqManifest(client,invalidReplacement,evidence,{replaceDraft:true}),/foreign key/i)
    assert.equal((await db.query('SELECT question_text_en FROM cgl_pyq_questions WHERE paper_id=$1',[incomplete.paper_id])).rows[0].question_text_en,'Changed after import','failed replacement is atomic')
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_pyq_import_history WHERE paper_id=$1',[incomplete.paper_id])).rows[0].n,2,'old draft snapshot retained')
    const completed=structuredClone(manifest);completed.paper.cycle_year=2022;completed.questions[0].question_text_en=changed.questions[0].question_text_en
    const extended=await ingestPyqManifest(client,completed,evidence)
    assert.equal(extended.extended,true);assert.equal(String(extended.paper_id),String(incomplete.paper_id))
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_pyq_questions WHERE paper_id=$1',[incomplete.paper_id])).rows[0].n,4)
    assert.equal((await ingestPyqManifest(client,partial,evidence)).imported,false,'replaying an older partial snapshot is idempotent')
    const imported=await ingestPyqManifest(client,manifest,evidence)
    assert.equal(imported.imported,true);assert.equal(imported.status,'Draft')
    assert.equal((await ingestPyqManifest(client,manifest,evidence)).imported,false)
    assert.equal((await get('/pyq/chapters')).body.chapters.length,0)
    await publishPyqPaper(client,{paperId:imported.paper_id,reviewer:'Fixture reviewer',notes:'Fictional source, key, content and rights inspected'})
    await assert.rejects(db.query('UPDATE cgl_pyq_questions SET question_text_en=$1 WHERE paper_id=$2',['changed',imported.paper_id]),/immutable/)
    const list=await get('/pyq/papers?cycle_year=2021&stage=Tier_2')
    assert.equal(list.body.papers.length,1);assert.equal(list.body.papers[0].cycle_year,2021);assert.equal(list.body.papers[0].exam_date,'2022-08-08')
    assert.ok(!('final_key_url' in list.body.papers[0]))
    const paper=await get(`/pyq/papers/${imported.paper_id}`)
    assert.equal(paper.body.paper.questions.length,4);assert.ok(!('final_key_url' in paper.body.paper))
    assert.ok(!('correct_option_indices' in paper.body.paper.questions[0]));assert.ok(!('solution_basic' in paper.body.paper.questions[0]))
    assert.equal(paper.body.paper.sections[0].correct_marks,'2.00');assert.equal(paper.body.paper.sections[1].correct_marks,'1.00')
    assert.equal((await get('/pyq/chapters?subject=Quant')).body.chapters[0].question_count,2)
    const page=await get('/pyq/chapters/questions?subject=Quant&chapter=Percentages&limit=1')
    assert.equal(page.body.questions.length,1);assert.equal(page.body.pagination.next_offset,1)
    assert.equal((await get('/pyq/chapters/questions?subject=Quant&chapter=Percentages&limit=301')).status,400)
    const qs=paper.body.paper.questions
    assert.equal((await post('/pyq/grade',{mode:'Paper',paper_id:imported.paper_id,answers:[]},null)).status,401)
    const grade=await post('/pyq/grade',{mode:'Paper',paper_id:imported.paper_id,answers:[{question_id:qs[0].id,selected_option_index:0},{question_id:qs[1].id,selected_option_index:2}]},1)
    assert.equal(grade.status,201);assert.equal(grade.body.attempt.score,1.5);assert.equal(grade.body.attempt.max_score,5)
    assert.deepEqual(grade.body.attempt.results[1].correct_option_indices,[0,2]);assert.equal(grade.body.attempt.results[3].maximum_marks,0)
    assert.equal((await get(`/pyq/attempts/${grade.body.attempt.id}`,2)).status,404)
    assert.equal((await get(`/pyq/attempts/${grade.body.attempt.id}`,1)).status,200)
    assert.equal((await post('/pyq/grade',{mode:'Chapter',answers:[{question_id:qs[0].id,selected_option_index:1},{question_id:qs[0].id,selected_option_index:1}]},1)).status,400)

    let trace=[]
    const good=await generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_1',format:'single_concept'},fakeProvider({record:trace}))
    assert.equal(good.status,'Verified_Draft');assert.equal((await get('/generated')).body.batches.length,0)
    const blind=trace.find(x=>x.role==='solver').user.question
    assert.ok(!('correct_option_index' in blind) && !('solution_basic' in blind) && !('verification_expression' in blind))
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_1',format:'single_concept'},fakeProvider({solverIndex:0})),/solver rejected/)
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_1',format:'single_concept'},fakeProvider({auditResult:{...audit,trick_correct:false}})),/audit rejected/)
    const bad=numericCandidate();bad.questions[0].verification_expression={op:'div',args:[1,0]}
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_1',format:'single_concept'},fakeProvider({candidate:bad})),/zero/)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM cgl_ai_batches')).rows[0].n,1,'rejections persist no generated batch')
    await publishAiBatch(client,{batchId:good.batch_id,reviewer:'Expert fixture',notes:'Human reviewed every step and translation'})
    const displayed=await get(`/generated/${good.batch_id}`)
    assert.equal(displayed.status,200);assert.match(displayed.body.batch.kind,/not official PYQ/)
    assert.ok(!('correct_option_index' in displayed.body.batch.questions[0]));assert.ok(!('solution_trick' in displayed.body.batch.questions[0]))
    const aiGrade=await post(`/generated/${good.batch_id}/grade`,{answers:[{question_number:1,selected_option_index:1}]},1)
    assert.equal(aiGrade.status,201);assert.equal(aiGrade.body.attempt.correct_count,1);assert.match(aiGrade.body.attempt.results[0].solution_trick,/fifth/)
    assert.equal((await get(`/generated-attempts/${aiGrade.body.attempt.id}`,2)).status,404)
    const mainsQuestion=(type,stem)=>({isomorphism_explanation:'Same conceptual structure with an original presentation.',passages:[],questions:[{question_type:type,question_text_en:stem,question_text_hi:'यह एक काल्पनिक बहु-चरणीय अभ्यास प्रश्न है।',options:[{en:'A',hi:'क'},{en:'B',hi:'ख'},{en:'C',hi:'ग'},{en:'D',hi:'घ'}],correct_option_index:0,solution_basic:'Use the given conditions to derive the first option.',solution_trick:'Eliminate the other options using the constraints.',ideal_time_seconds:90,passage_ref:null,verification_expression:null}]})
    const mainsDraft=await generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_2',format:'mains_multi_step'},fakeProvider())
    assert.equal(mainsDraft.status,'Verified_Draft')
    const statements=mainsQuestion('Multi_Statement','Statement I: a condition. Statement II: another condition. Which is true?')
    assert.equal((await generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_2',format:'multi_statement'},fakeProvider({candidate:statements,solverIndex:0}))).status,'Verified_Draft')
    const matching=mainsQuestion('Match_The_Column','Match Column I: A, B with Column II: 1, 2. Which pairing is valid?')
    assert.equal((await generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_2',format:'match_column'},fakeProvider({candidate:matching,solverIndex:0}))).status,'Verified_Draft')
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_1',format:'match_column'},fakeProvider({candidate:matching})),/Tier I/)
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:qs[0].id,stage:'Tier_2',format:'statistics_probability'},fakeProvider()),/Statistics and Probability/)

    const triple=tripleCandidate()
    const badTriple=structuredClone(triple);badTriple.questions.pop();badTriple.questions.push({...structuredClone(badTriple.questions[0]),question_text_en:'An extra distinct question about the first passage?'})
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:qs[2].id,stage:'Tier_2',format:'reading_triple'},fakeProvider({candidate:badTriple,solverIndex:0})),/four or five/)
    const tripleBatch=await generateIsomorphic(client,{sourceQuestionId:qs[2].id,stage:'Tier_2',format:'reading_triple'},fakeProvider({candidate:triple,solverIndex:0}))
    assert.equal(tripleBatch.questions,12)
    await publishAiBatch(client,{batchId:tripleBatch.batch_id,reviewer:'Expert fixture',notes:'Reviewed all three passages and twelve answer keys'})
    const triplePublic=await get(`/generated/${tripleBatch.batch_id}`)
    assert.equal(triplePublic.body.batch.passages.length,3);assert.equal(triplePublic.body.batch.questions.length,12)
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM attempts')).rows[0].n,1)
    await assert.rejects(db.query(`UPDATE cgl_ai_batches SET status='Withdrawn',withdrawn_by='fixture',withdrawal_notes='A valid reason',withdrawn_at=NOW(),content='{}'::jsonb WHERE id=$1`,[good.batch_id]),/immutable/)
    assert.equal((await withdrawAiBatch(client,{batchId:good.batch_id,reviewer:'Fixture editor',notes:'Fictional batch withdrawal test'})).withdrawn,true)
    assert.equal((await get(`/generated/${good.batch_id}`)).status,404)
    const retiredAiAttempt=await get(`/generated-attempts/${aiGrade.body.attempt.id}`,1)
    assert.equal(retiredAiAttempt.status,200,'AI attempt history retained')
    assert.equal(retiredAiAttempt.body.attempt.results[0].content_withdrawn,true)
    assert.ok(!('solution_basic' in retiredAiAttempt.body.attempt.results[0]))
    assert.equal((await get(`/generated/${tripleBatch.batch_id}`)).status,200)
    await assert.rejects(db.query(`UPDATE cgl_pyq_papers SET status='Withdrawn',withdrawn_by='fixture',withdrawal_notes='A valid reason',withdrawn_at=NOW(),title='Changed' WHERE id=$1`,[imported.paper_id]),/immutable/)
    assert.equal((await withdrawPyqPaper(client,{paperId:imported.paper_id,reviewer:'Fixture editor',notes:'Fictional source withdrawal test'})).withdrawn,true)
    await assert.rejects(publishAiBatch(client,{batchId:mainsDraft.batch_id,reviewer:'Fixture editor',notes:'Synthetic review only'}),/source is not currently published/)
    assert.equal((await withdrawPyqPaper(client,{paperId:imported.paper_id,reviewer:'Fixture editor',notes:'Fictional source withdrawal test'})).withdrawn,false)
    assert.equal((await get(`/pyq/papers/${imported.paper_id}`)).status,404)
    assert.equal((await get(`/generated/${tripleBatch.batch_id}`)).status,404,'derivatives hidden when source is withdrawn')
    assert.equal((await get('/generated')).body.batches.length,0)
    const retiredPyqAttempt=await get(`/pyq/attempts/${grade.body.attempt.id}`,1)
    assert.equal(retiredPyqAttempt.status,200,'PYQ attempt history retained')
    assert.equal(retiredPyqAttempt.body.attempt.results[0].content_withdrawn,true)
    assert.ok(!('correct_option_indices' in retiredPyqAttempt.body.attempt.results[0]))
    await assert.rejects(publishPyqPaper(client,{paperId:imported.paper_id,reviewer:'Fixture editor',notes:'Fictional review only'}),/Withdrawn/)
    await assert.rejects(db.query('UPDATE cgl_pyq_questions SET question_text_en=$1 WHERE paper_id=$2',['changed',imported.paper_id]),/immutable/)
    const corrected=structuredClone(manifest);corrected.questions[0].question_text_en+=' corrected fixture'
    const newVersion=await ingestPyqManifest(client,corrected,evidence)
    assert.notEqual(String(newVersion.paper_id),String(imported.paper_id),'corrected source is a new immutable version')
    await publishPyqPaper(client,{paperId:newVersion.paper_id,reviewer:'Fixture editor',notes:'Synthetic correction reviewed'})
    assert.equal((await get('/pyq/papers?cycle_year=2021')).body.papers.length,1)
    assert.equal((await get(`/generated/${tripleBatch.batch_id}`)).status,404,'old derivatives stay hidden')
    const special=structuredClone(manifest)
    special.paper={...special.paper,cycle_year:2025,paper_code:'FICTIONAL-2025',exam_date:'2026-01-18',shift_label:'Fixture only',expected_questions:3}
    special.sections=[{code:'MIX',label:'Fictional mixed section',position:1,expected_questions:3,correct_marks:3,wrong_deduction:1}]
    special.passages=[]
    special.questions=[
      {source_question_ref:'stat',section_code:'MIX',position:1,subject:'Quant',chapter:'Statistics',canonical:{subject:'Quant',topic:'Statistics and Probability',sub_topic:'Mean',exam_stage:'Tier_2'},question_text_en:'Fictional source: what is the mean of 2 and 4?',options:[{en:'2'},{en:'3'},{en:'4'},{en:'5'}],answer_status:'Single',correct_option_indices:[1]},
      {source_question_ref:'reason',section_code:'MIX',position:2,subject:'Reasoning',chapter:'Puzzles',canonical:{subject:'Reasoning',topic:'Logical Reasoning',sub_topic:'Problem solving',exam_stage:'Tier_2'},question_text_en:'Fictional source puzzle: which arrangement works?',options:[{en:'A'},{en:'B'},{en:'C'},{en:'D'}],answer_status:'Single',correct_option_indices:[0]},
      {source_question_ref:'void',section_code:'MIX',position:3,subject:'Reasoning',chapter:'Puzzles',question_text_en:'Fictional all-awarded void question?',options:[{en:'A'},{en:'B'},{en:'C'},{en:'D'}],answer_status:'Void',correct_option_indices:[],void_policy:'All_Awarded'},
    ]
    const specialPaper=await ingestPyqManifest(client,special,evidence)
    await publishPyqPaper(client,{paperId:specialPaper.paper_id,reviewer:'Fixture editor',notes:'Fictional source and marking rules reviewed'})
    const specialPublic=(await get(`/pyq/papers/${specialPaper.paper_id}`)).body.paper
    assert.equal(specialPublic.exam_date,'2026-01-18');assert.equal(specialPublic.cycle_year,2025)
    const awarded=await post('/pyq/grade',{mode:'Paper',paper_id:specialPaper.paper_id,answers:[]},1)
    assert.equal(awarded.body.attempt.score,3);assert.equal(awarded.body.attempt.max_score,9)
    const stats=numericCandidate();stats.questions[0].question_text_en='What is the mean of 3, 6, and 9?';stats.questions[0].question_text_hi='3, 6 और 9 का औसत क्या है?'
    stats.questions[0].options=[{en:'4',hi:'४'},{en:'5',hi:'५'},{en:'6',hi:'६'},{en:'7',hi:'७'}];stats.questions[0].correct_option_index=2
    stats.questions[0].solution_basic='Add 3, 6, and 9, then divide 18 by 3 to obtain 6.';stats.questions[0].solution_trick='The three equally spaced numbers have the middle value as their mean.'
    stats.questions[0].verification_expression={op:'div',args:[{op:'add',args:[{op:'add',args:[3,6]},9]},3]}
    const statBatch=await generateIsomorphic(client,{sourceQuestionId:specialPublic.questions[0].id,stage:'Tier_2',format:'statistics_probability'},fakeProvider({candidate:stats,solverIndex:2}))
    assert.equal(statBatch.status,'Verified_Draft')
    const puzzle=mainsQuestion('Standard_MCQ','A new fictional arrangement puzzle has four possible orders. Which order works?')
    const puzzleBatch=await generateIsomorphic(client,{sourceQuestionId:specialPublic.questions[1].id,stage:'Tier_2',format:'reasoning_puzzle'},fakeProvider({candidate:puzzle,solverIndex:0}))
    assert.equal(puzzleBatch.status,'Verified_Draft')
    const restricted=structuredClone(special);restricted.paper.cycle_year=2024;restricted.paper.paper_code='NO-DERIVATIVES';restricted.source.allow_derivatives=false;restricted.source.allow_external_processing=false
    const restrictedPaper=await ingestPyqManifest(client,restricted,evidence)
    await publishPyqPaper(client,{paperId:restrictedPaper.paper_id,reviewer:'Fixture editor',notes:'Synthetic source may be redistributed only'})
    const restrictedQ=(await get(`/pyq/papers/${restrictedPaper.paper_id}`)).body.paper.questions[0].id
    await assert.rejects(generateIsomorphic(client,{sourceQuestionId:restrictedQ,stage:'Tier_2',format:'statistics_probability'},fakeProvider()),/rights/)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',['altered',PYQ_MIGRATION_VERSION])
    assert.equal((await get('/pyq/papers')).body.code,'SSC_CGL_PYQ_CHECKSUM_MISMATCH')
    assert.equal((await get('/mock-tests')).status,200)
    await db.query('UPDATE cgl_schema_migrations SET checksum=$1 WHERE version=$2',[PYQ_MIGRATION_CHECKSUM,PYQ_MIGRATION_VERSION])
  } finally {await new Promise(resolve=>server.close(resolve));await f.close()}
})

test('safe arithmetic and provider validation fail closed',async()=>{
  assert.deepEqual(evaluateExpression({op:'mul',args:[2,{op:'div',args:[3,4]}]}),{n:3n,d:2n})
  assert.equal(checkNumericExpression({op:'div',args:[1,4]},[{en:'25%'},{en:'50%'},{en:'75%'},{en:'100%'}],0).result,'1/4')
  assert.deepEqual(parseNumericOption('1,50,000'),{n:150000n,d:1n})
  assert.equal(parseNumericOption('1,0'),null)
  assert.throws(()=>evaluateExpression({op:'eval',args:[1,2]}),/Unsupported/)
  assert.throws(()=>checkNumericExpression({op:'add',args:[2,3]},[{en:'5'},{en:'5.0'},{en:'2'},{en:'3'}],0),/non-unique/)
  assert.throws(()=>createOpenAICompatibleProvider({baseUrl:'https://example.invalid/v1',apiKey:'secret',generatorModel:'same',solverModel:'same',auditorModel:'audit'}),/different solver/)
  let call
  const provider=createOpenAICompatibleProvider({baseUrl:'https://example.invalid/v1',apiKey:'fixture-secret',generatorModel:'g',solverModel:'s',auditorModel:'a',fetchImpl:async(url,options)=>{call={url,options};return new Response(JSON.stringify({choices:[{message:{content:'{"answer_index":1}'}}]}),{status:200})}})
  assert.equal((await provider.complete('solver',{system:'system',user:{question:'fixture'}})).answer_index,1)
  assert.equal(call.options.redirect,'error');assert.equal(call.url,'https://example.invalid/v1/chat/completions')
  assert.ok(!JSON.stringify(provider.models).includes('fixture-secret'))
})

test('migration 003 rolls back all DDL on a late failure and preserves prior data',async()=>{
  const f=await fixture(),{db,client}=f
  try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const fail={query:async(sql,args)=>{
      if (sql.startsWith('-- Additive vault and AI draft tables.')) {await client.query(sql,args);throw new Error('injected migration failure')}
      return client.query(sql,args)
    }}
    await assert.rejects(migratePyqAi(fail),/injected migration failure/)
    const {rows:[state]}=await db.query(`SELECT to_regclass('public.cgl_pyq_papers') AS vault,
      (SELECT COUNT(*)::int FROM cgl_schema_migrations WHERE version=$1) AS migration,
      (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM attempts) AS history`,[PYQ_MIGRATION_VERSION])
    assert.deepEqual(state,{vault:null,migration:0,users:2,history:1})
  } finally {await f.close()}
})
