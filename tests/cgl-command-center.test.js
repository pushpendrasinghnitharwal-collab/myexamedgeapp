import test from 'node:test'
import assert from 'node:assert/strict'
import {STAGES,stageSubjects,sectionals,fullSpec,sectionSpec,coverageLabel,calculateInsights,syllabusOptions,YEARS,MONTHS,CA_CATEGORIES} from '../src/lib/cglModel.js'

test('stage controls have the correct SSC formats and explicit historical slots',()=>{
  assert.equal(STAGES.Tier_1.questions,100);assert.equal(STAGES.Tier_1.minutes,60)
  assert.equal(STAGES.Tier_2.questions,150);assert.equal(STAGES.Tier_2.minutes,135)
  assert.equal(stageSubjects('Tier_1').length,4);assert.equal(stageSubjects('Tier_2').length,5)
  assert.deepEqual(sectionals('Tier_2').map(x=>[x.count,x.minutes]),[[60,60],[70,60],[20,15]])
  assert.deepEqual(fullSpec('Tier_1'),{category:'Full_Tier1'});assert.deepEqual(sectionSpec('Tier_2','Section_I'),{category:'Sectional_Tier2',section:'Section_I'})
  assert.deepEqual(YEARS,[2021,2022,2023,2024,2025]);assert.equal(MONTHS.length,12)
  assert.equal(CA_CATEGORIES.find(c=>c.name==='Defence').code,'Military_Exercises');assert.equal(coverageLabel(null),'Status unavailable')
})
test('radar uses actual delivered scored questions and only recorded foreground time',()=>{
  const reviews=[{mock:{id:'1',exam_stage:'Tier_1'},results:[{position:1,subject:'Quant',topic:'Geometry',is_correct:true},{position:2,subject:'Quant',topic:'Geometry',is_correct:false},{position:3,subject:'English',topic:'Grammar',is_correct:false},{position:4,subject:'Quant',topic:'Algebra',not_delivered:true,is_correct:false},{position:5,content_withdrawn:true,is_correct:false}]}]
  const got=calculateInsights(reviews,'Tier_1',(_id,pos)=>pos===1?24:pos===2?36:null)
  assert.equal(got.rows.find(r=>r.code==='Quant').accuracy,50);assert.equal(got.rows.find(r=>r.code==='Quant').avgSeconds,30)
  assert.equal(got.rows.find(r=>r.code==='English').avgSeconds,null);assert.equal(got.rows.find(r=>r.code==='Computer_Knowledge').accuracy,null)
  assert.equal(got.weak[0].topic,'Grammar');assert.equal(calculateInsights(reviews,'Tier_2').answered,0)
})
test('syllabus mappings keep only the selected stage',()=>{
  assert.deepEqual(syllabusOptions([{subject:'Quant',topic:'A',sub_topic:'One',exam_stage:'Both'},{subject:'Quant',topic:'B',sub_topic:'Two',exam_stage:'Tier_2'}],'Tier_1','Quant'),[{topic:'A',subtopics:['One']}])
})

test('question timing stores only scoped, positive local durations and can be cleared',async()=>{
  const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)}
  try{
    const {addQuestionTime,questionSeconds,questionTimes,clearQuestionTimes}=await import('../src/lib/cglTelemetry.js')
    addQuestionTime('service:1','42',1,1200);addQuestionTime('service:1','42',1,800);addQuestionTime('service:2','42',1,5000)
    assert.equal(questionSeconds('service:1','42',1),2);assert.equal(questionSeconds('service:2','42',1),5)
    assert.equal(questionSeconds('service:1','42',2),null);assert.equal(questionSeconds('service:3','42',1),null)
    assert.deepEqual(questionTimes('service:1','42'),{'1':2000});assert.deepEqual(questionTimes('service:3','42'),{})
    assert.doesNotMatch([...store.values()].join(' '),/password|question_text|selected_option/)
    clearQuestionTimes();assert.equal(questionSeconds('service:1','42',1),null);assert.deepEqual(questionTimes('service:1','42'),{})
  }finally{delete globalThis.localStorage}
})

test('exam player palette distinguishes all five states and local recovery is account scoped', async()=>{
  const {paletteState,loadPlayer,savePlayer,clearPlayerData}=await import('../src/lib/cglPlayerStore.js')
  assert.equal(paletteState({selected_option_index:null,visited:false}), 'not-visited')
  assert.equal(paletteState({selected_option_index:null,visited:true}), 'not-answered')
  assert.equal(paletteState({selected_option_index:0,visited:true}), 'answered')
  assert.equal(paletteState({selected_option_index:null,visited:true,marked_for_review:true}), 'marked')
  assert.equal(paletteState({selected_option_index:3,visited:true,marked_for_review:true}), 'answered-marked')
  const data=new Map(),previous=globalThis.localStorage
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}
  try{
    const record={current:4,positions:{4:{selected_option_index:1,marked_for_review:true,elapsed_ms:2345,dirty:true}}}
    assert.equal(savePlayer('account-a','42',record),true);assert.deepEqual(loadPlayer('account-a','42'),record)
    assert.deepEqual(loadPlayer('account-b','42'),{positions:{},current:null})
    clearPlayerData();assert.deepEqual(loadPlayer('account-a','42'),{positions:{},current:null})
  }finally{globalThis.localStorage=previous}
})

test('player countdown accounts for sleep and backwards wall-clock changes without overriding the server', async()=>{
  const {timerAnchor,remainingSeconds}=await import('../src/lib/cglPlayerClock.js')
  const timer={state:'Active',module_remaining_seconds:60,server_now:'2026-01-01T00:00:00.250Z',deadline:'2026-01-01T00:01:00.000Z'}
  const anchor=timerAnchor(timer,10_000,500)
  assert.equal(remainingSeconds(anchor,10_000,500),60)
  assert.equal(remainingSeconds(anchor,11_250,1_750),59)
  assert.equal(remainingSeconds(anchor,70_000,1_750),0,'wall time advances if the monotonic clock stalls during sleep')
  assert.equal(remainingSeconds(anchor,1_000,10_500),50,'a backwards wall-clock change cannot add exam time')
  assert.equal(timerAnchor({state:'Active',module_remaining_seconds:null},0,0),null)
  assert.equal(remainingSeconds(null,0,0),null)
})

test('DI data tables retain exact values, translations and unrecognized metadata', async()=>{
  const {chartTable,displayCell}=await import('../src/lib/cglChartData.js')
  const records=chartTable([{year:2021,profit:0},{year:2022,profit:-2.5,change:'10%'}])
  assert.deepEqual(records.columns,['year','profit','change'])
  assert.deepEqual(records.rows,[[2021,0,null],[2022,-2.5,'10%']])
  const series=chartTable({title:'Revenue',labels:[{en:'East',hi:'पूर्व'},'West'],datasets:[{label:'2025',data:[3.25,0],unit:'crore'}],source:'Fixture'})
  assert.deepEqual(series.rows,[[{en:'East',hi:'पूर्व'},3.25],['West',0]])
  assert.deepEqual(series.extra,{title:'Revenue',source:'Fixture',series_details:[{unit:'crore'}]})
  assert.equal(displayCell(series.rows[0][0],'hi'),'पूर्व')
  const suppliedHeaders=chartTable({headers:['Year','Value'],rows:[[2024,10],[2025,25]],unit:'kg'})
  assert.deepEqual(suppliedHeaders.rows,[[2024,10],[2025,25]])
  assert.deepEqual(suppliedHeaders.extra,{unit:'kg'})
  assert.equal(chartTable({labels:['A','B'],datasets:[{label:'X',data:[1]}]}),null,'mismatched series use the full structured fallback rather than dropping values')
})

test('an older active-session refresh cannot overwrite a newer saved local answer', async()=>{
  const {snapshotPlayerRevisions,mergePlayerProgress}=await import('../src/lib/cglPlayerStore.js')
  const server={questions:[{position:1,selected_option_index:0,visited:true,marked_for_review:false}]}
  const pending={positions:{1:{selected_option_index:2,visited:true,marked_for_review:true,rev:5,dirty:true}},current:1}
  const startedWhilePending=snapshotPlayerRevisions(pending.positions)
  const acknowledged={...pending,positions:{1:{...pending.positions[1],dirty:false}}}
  assert.equal(mergePlayerProgress(server,acknowledged,startedWhilePending).positions[1].selected_option_index,2)
  const startedClean=snapshotPlayerRevisions({1:{...acknowledged.positions[1],rev:4}})
  assert.equal(mergePlayerProgress(server,acknowledged,startedClean).positions[1].selected_option_index,2)
  const noLocalChange=snapshotPlayerRevisions(acknowledged.positions)
  assert.equal(mergePlayerProgress(server,acknowledged,noLocalChange).positions[1].selected_option_index,0)
  assert.equal(mergePlayerProgress(server,acknowledged).positions[1].selected_option_index,0)
})

test('review filters distinguish skipped, withdrawn, void and tracked slow questions',async()=>{
  const {filteredReview,reviewOutcome}=await import('../src/lib/cglReviewModel.js')
  const rows=[{position:1,subject:'Quant',is_correct:true,time_spent_ms:20000},{position:2,subject:'English',is_correct:false,time_spent_ms:0},
    {position:3,subject:'Quant',selected_option_index:null,is_correct:null,time_spent_ms:30000},{position:4,not_delivered:true},
    {position:5,content_withdrawn:true},{position:6,answer_status:'Void',selected_option_index:null,time_spent_ms:99999}]
  assert.deepEqual(filteredReview(rows,'slowest').map(q=>q.position),[3,1])
  assert.deepEqual(filteredReview(rows,'traps','all',new Set([3])).map(q=>q.position),[3])
  assert.deepEqual(filteredReview(rows,'skipped').map(q=>q.position),[3,4])
  assert.deepEqual(filteredReview(rows,'correct','Quant').map(q=>q.position),[1])
  assert.equal(reviewOutcome(rows[4]),'withdrawn');assert.equal(reviewOutcome(rows[5]),'void')
})

test('personal score targets are account scoped and shift histograms reject malformed data',async()=>{
  const {loadReviewTargets,saveReviewTargets,saveReviewTarget,clearReviewTargets,parseShiftHistogram}=await import('../src/lib/cglReviewModel.js')
  const previous=globalThis.localStorage,data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}
  try{
    assert.equal(saveReviewTargets('a',{Quant:'28.5',English:'',Reasoning:'51'}),true)
    assert.deepEqual(loadReviewTargets('a'),{Quant:'28.5'});assert.deepEqual(loadReviewTargets('b'),{})
    assert.equal(saveReviewTarget('a','English','30'),true);assert.deepEqual(loadReviewTargets('a'),{Quant:'28.5',English:'30'})
    assert.equal(saveReviewTarget('a','Quant','51'),false);assert.equal(saveReviewTarget('a','English',''),true);assert.deepEqual(loadReviewTargets('a'),{Quant:'28.5'})
    clearReviewTargets();assert.deepEqual(loadReviewTargets('a'),{})
    assert.deepEqual(parseShiftHistogram('score,count\n-2.5,10\n100, 25'),[{score:-2.5,count:10},{score:100,count:25}])
    assert.throws(()=>parseShiftHistogram('100,person-name'));assert.throws(()=>parseShiftHistogram('200.5,2'));assert.throws(()=>parseShiftHistogram('5.2,1'))
  }finally{globalThis.localStorage=previous}
})

test('review recovers legacy device-only time without double-counting synced time or hidden content',async()=>{
  const {mergeReviewTimes}=await import('../src/lib/cglReviewModel.js')
  const blank={questions:1,tracked_questions:0,total_seconds:null,average_seconds:null}
  const timing={by_outcome:{correct:{...blank,questions:2,tracked_questions:1,total_seconds:10,average_seconds:10},wrong:{...blank},skipped:{...blank}},time_traps:[]}
  const rows=[{position:1,is_correct:true,time_spent_ms:10000,ideal_time_seconds:5},{position:2,is_correct:true,time_spent_ms:0,ideal_time_seconds:20},
    {position:3,is_correct:false,time_spent_ms:0,ideal_time_seconds:10},{position:4,selected_option_index:null,is_correct:null,time_spent_ms:0},
    {position:5,content_withdrawn:true},{position:6,not_delivered:true},{position:7,answer_status:'Void',is_correct:true,ideal_time_seconds:1}]
  const result=mergeReviewTimes(rows,timing,{1:99999,2:41000,3:10000,4:5000,5:30000,6:40000,7:50000})
  assert.equal(result.deviceOnlyCount,3);assert.equal(result.results[0].time_spent_ms,10000);assert.equal(result.results[1].time_source,'device_only')
  assert.deepEqual(result.timing.by_outcome.correct,{questions:2,tracked_questions:2,total_seconds:51,average_seconds:25.5})
  assert.equal(result.timing.by_outcome.wrong.total_seconds,10);assert.equal(result.timing.by_outcome.skipped.total_seconds,5)
  assert.deepEqual(result.timing.time_traps.map(item=>item.position),[2]);assert.deepEqual(timing.time_traps,[],'backend response is not mutated')
})
