import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeMasterAttempt,simulateTier1Normalization} from '../cgl-analytics.js'
import {TIER1_MODULES,TIER2_MODULES} from '../master-formats.js'

function fakeAttempt(modules,category,stage,scores){
  let pos=0
  const items=modules.flatMap(module=>Array.from({length:module.question_count},()=>({position:++pos,module_code:module.code,subject:module.subject,delivered_at:'2026-01-01'})))
  const results=items.map(item=>({position:item.position,subject:item.subject,selected_option_index:null,is_correct:null,time_spent_ms:0,ideal_time_seconds:20}))
  const rows=modules.map((module,index)=>({module_code:module.code,question_count:module.question_count,score:scores[index],max_score:module.question_count*module.correct_marks,correct:0,wrong:0,skipped:module.question_count}))
  const score=scores.reduce((n,v)=>n+v,0),merit=scores.slice(0,4).reduce((n,v)=>n+v,0)
  const summary={modules:rows,score,max_score:modules.reduce((n,m)=>n+m.question_count*m.correct_marks,0),screening_score:stage==='Tier_1'?score:null,
    merit_score:stage==='Tier_2'?merit:null,actual_merit_max_score:stage==='Tier_2'?390:null,computer_score:stage==='Tier_2'?scores[4]:null,computer_max_score:stage==='Tier_2'?60:null}
  return {mock:{category,exam_stage:stage,modules},summary,results,items}
}

test('Tier II merit excludes computer and checks each minimum only when its section was delivered',()=>{
  const a=fakeAttempt(TIER2_MODULES,'Full_Tier2','Tier_2',[30,24,40,23,18])
  let report=analyzeMasterAttempt(a.mock,a.summary,a.results,a.items)
  assert.equal(report.merit.score,117);assert.equal(report.merit.max_score,390)
  assert.deepEqual([report.merit.section_i.score,report.merit.section_i.max_score],[54,180])
  assert.deepEqual([report.merit.section_ii.score,report.merit.section_ii.max_score],[63,210])
  assert.equal(report.merit.section_i.assessments.UR.status,'Qualified')
  assert.equal(report.merit.section_ii.assessments.UR.status,'Qualified')
  assert.equal(report.computer.assessments.UR.minimum_marks,18)
  assert.equal(report.computer.assessments.UR.status,'Qualified')
  assert.equal(report.computer.assessments.OBC_EWS.minimum_marks,15)
  assert.equal(report.computer.assessments.Others.minimum_marks,12)
  a.summary.computer_score=17
  report=analyzeMasterAttempt(a.mock,a.summary,a.results,a.items)
  assert.equal(report.computer.assessments.UR.status,'Not_Qualified')
  assert.equal(report.computer.assessments.OBC_EWS.status,'Qualified')
  const computerItem=a.items.find(q=>q.subject==='Computer_Knowledge')
  computerItem.delivered_at=null
  report=analyzeMasterAttempt(a.mock,a.summary,a.results,a.items)
  assert.equal(report.computer.assessments.UR.status,'Not_Assessed','undelivered computer must not be called a fail')
  computerItem.delivered_at='2026-01-01';a.results.find(q=>q.position===computerItem.position).content_withdrawn=true
  report=analyzeMasterAttempt(a.mock,a.summary,a.results,a.items)
  assert.equal(report.computer.delivered,true);assert.equal(report.computer.content_available,false)
  assert.equal(report.computer.assessments.UR.status,'Not_Assessed','withdrawn computer content cannot support a minimum assessment')
  a.mock.category='Micro'
  assert.equal(analyzeMasterAttempt(a.mock,a.summary,a.results,a.items).merit,null,'short practice is never scaled to /390')
})

test('Tier I reports raw scores and minimums without inventing subject cutoffs',()=>{
  const a=fakeAttempt(TIER1_MODULES,'Full_Tier1','Tier_1',[20,25,30,15])
  const report=analyzeMasterAttempt(a.mock,a.summary,a.results,a.items)
  assert.equal(report.screening.score,90);assert.equal(report.screening.max_score,200)
  assert.deepEqual(report.screening.minimums,{UR:60,OBC_EWS:50,Others:40})
  assert.equal(report.screening.section_cutoffs_available,false)
  assert.equal(report.subject_scores.length,4)
  assert.equal(report.projection.percentile,null);assert.equal(report.projection.normalized_score,null)
  a.results[0].content_withdrawn=true
  assert.equal(analyzeMasterAttempt(a.mock,a.summary,a.results,a.items).screening.content_available,false)
})

test('time buckets exclude unavailable and void questions, flag strictly over twice ideal, and preserve missing time',()=>{
  const a=fakeAttempt(TIER1_MODULES,'Full_Tier1','Tier_1',[0,0,0,0])
  a.results=[
    {position:1,subject:'Quant',is_correct:true,selected_option_index:0,time_spent_ms:41000,ideal_time_seconds:20},
    {position:2,subject:'Quant',is_correct:true,selected_option_index:0,time_spent_ms:40000,ideal_time_seconds:20},
    {position:3,subject:'English',is_correct:false,selected_option_index:1,time_spent_ms:15000,ideal_time_seconds:10},
    {position:4,subject:'English',is_correct:null,selected_option_index:null,time_spent_ms:2500,ideal_time_seconds:1},
    {position:5,is_correct:null,selected_option_index:null,time_spent_ms:0},
    {position:6,is_correct:null,selected_option_index:null,time_spent_ms:9000,answer_status:'Void'},
    {position:7,not_delivered:true},{position:8,content_withdrawn:true},
  ]
  const {timing}=analyzeMasterAttempt(a.mock,a.summary,a.results,a.items)
  assert.deepEqual(timing.by_outcome.correct,{questions:2,tracked_questions:2,total_seconds:81,average_seconds:40.5})
  assert.deepEqual(timing.by_outcome.skipped,{questions:2,tracked_questions:1,total_seconds:2.5,average_seconds:2.5})
  assert.deepEqual(timing.time_traps.map(x=>x.position),[1,4])
  assert.equal(timing.unavailable_questions,2);assert.equal(timing.void_questions,1)
  a.results=[{position:1,selected_option_index:null,is_correct:null,time_spent_ms:0}]
  assert.equal(analyzeMasterAttempt(a.mock,a.summary,a.results,a.items).timing.by_outcome.skipped.total_seconds,null)
})

test('explicit shift simulation includes ties, interpolates, averages and never extrapolates',()=>{
  const output=simulateTier1Normalization(100,{shifts:[[{score:80,count:1},{score:100,count:1},{score:120,count:1}],[{score:80,count:1},{score:100,count:1},{score:120,count:1}]]})
  assert.equal(output.percentile,75);assert.equal(output.normalized_score,102.5)
  assert.deepEqual(output.equivalent_scores.map(s=>s.score),[100,105])
  assert.equal(output.equivalent_scores[0].participants,4)
  const sparse=simulateTier1Normalization(0,{shifts:[[{score:1,count:9}],[{score:10,count:100}]]})
  assert.equal(sparse.percentile,10);assert.equal(sparse.normalized_score,null);assert.equal(sparse.status,'insufficient_range')
  for(const body of [{shifts:[[]]}, {shifts:[[{score:201,count:1}],[{score:0,count:1}]]},{shifts:[[{score:1,count:0}],[{score:0,count:1}]]},
    {shifts:[[{score:'',count:1}],[{score:0,count:1}]]},{shifts:[[{score:1,count:1,name:'Personal data'}],[{score:0,count:1}]]}]){
    assert.throws(()=>simulateTier1Normalization(0,body))
  }
})
