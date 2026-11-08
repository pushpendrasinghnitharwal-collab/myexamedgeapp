import {redactPublicQuestion} from './public-question.js'
import {lockLearnerContent} from './learner-content-lock.js'
import { Router } from 'express'
import { ContentError } from './content-utils.js'
import { CA_CATEGORIES,CA_CATEGORY_CODES,AWARD_GROUPS,CA_EDITORIAL_WEIGHT_VERSION } from './data/ssc-cgl-ca-categories.js'
import { indiaToday,monthBounds,weekBounds,yearBounds,validId } from './ca-dates.js'
import { CA_MIGRATION_CHECKSUM,CA_MIGRATION_VERSION } from './ca-migration.js'

const asyncRoute=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next)
const round=n=>Math.round((n+Number.EPSILON)*100)/100
const availableMock=`m.status='Published' AND NOT EXISTS (
  SELECT 1 FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id JOIN cgl_ca_events e ON e.id=i.event_id
  WHERE i.mock_id=m.id AND (q.status<>'Published' OR e.status<>'Published'))`
export async function caStatus(query,{withCounts=true}={}) {
  const {rows:[tables]}=await query(`SELECT to_regclass('public.cgl_ca_imports') IS NOT NULL AS imports,
    to_regclass('public.cgl_ca_sources') IS NOT NULL AS sources,to_regclass('public.cgl_ca_events') IS NOT NULL AS events,
    to_regclass('public.cgl_ca_questions') IS NOT NULL AS questions,to_regclass('public.cgl_ca_mocks') IS NOT NULL AS mocks,
    to_regclass('public.cgl_ca_mock_items') IS NOT NULL AS items,to_regclass('public.cgl_ca_attempts') IS NOT NULL AS attempts`)
  if(!Object.values(tables).every(Boolean))return {ok:false,code:'SSC_CGL_CA_MIGRATION_REQUIRED'}
  const {rows:[version]}=await query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1',[CA_MIGRATION_VERSION])
  if(!version)return {ok:false,code:'SSC_CGL_CA_MIGRATION_REQUIRED'}
  if(version.checksum!==CA_MIGRATION_CHECKSUM)return {ok:false,code:'SSC_CGL_CA_CHECKSUM_MISMATCH'}
  if(!withCounts)return {ok:true,schema_version:CA_MIGRATION_VERSION}
  const {rows:[counts]}=await query(`SELECT (SELECT COUNT(*)::int FROM cgl_ca_events WHERE status='Published') AS events,
    (SELECT COUNT(*)::int FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id WHERE q.status='Published' AND e.status='Published') AS questions,
    (SELECT COUNT(*)::int FROM cgl_ca_mocks m WHERE ${availableMock}) AS mocks`)
  return {ok:true,schema_version:CA_MIGRATION_VERSION,counts}
}
function scalar(value,label) {if(value!==undefined&&typeof value!=='string')throw new ContentError(`Invalid ${label}`);return value??null}
function stageParam(req){const stage=scalar(req.query.stage,'stage');if(stage&&!['Tier_1','Tier_2'].includes(stage))throw new ContentError('Invalid stage');return stage}
function filters(req) {
  const stage=stageParam(req),yearRaw=scalar(req.query.year,'year'),monthRaw=scalar(req.query.month,'month'),weekRaw=scalar(req.query.week,'week'),kind=scalar(req.query.kind,'kind'),category=scalar(req.query.category,'category'),award=scalar(req.query.award_group,'award_group')
  if(yearRaw!==null&&!['2025','2026'].includes(yearRaw))throw new ContentError('Invalid year')
  if(monthRaw!==null&&!/^(?:[1-9]|1[0-2])$/.test(monthRaw))throw new ContentError('Invalid month')
  if(weekRaw!==null&&!/^[1-5]$/.test(weekRaw))throw new ContentError('Invalid week')
  if(kind!==null&&!['Monthly','Weekly','Annual','Category'].includes(kind))throw new ContentError('Invalid mock kind')
  if(category!==null&&!CA_CATEGORY_CODES.includes(category))throw new ContentError('Invalid category')
  if(award!==null&&(!AWARD_GROUPS.includes(award)||(category!==null&&category!=='Awards')))throw new ContentError('Invalid award group')
  return {stage,year:yearRaw===null?null:Number(yearRaw),month:monthRaw===null?null:Number(monthRaw),week:weekRaw===null?null:Number(weekRaw),kind,category,award}
}
function parseAnswers(value,limit) {
  if(!Array.isArray(value)||value.length>limit)throw new ContentError('answers must be an array no larger than the mock')
  const out=new Map()
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['question_id','selected_option_index'].includes(k)))throw new ContentError('Invalid answer object')
    const id=validId(item.question_id),selected=item.selected_option_index
    if(out.has(id)||(selected!==null&&(!Number.isInteger(selected)||selected<0||selected>3)))throw new ContentError('Answers must be unique, with a null or zero-based 0–3 selection')
    out.set(id,selected)
  }
  return out
}
function statusFor({start,end,today,count,target,available,category=false}){
  if(available)return 'Available'
  if(start>today)return 'Upcoming'
  if(!category&&end>=today)return 'In_Progress'
  return count>=target?'Ready_To_Assemble':'Awaiting_Content'
}
const responseNote='Practice mock only; editorial selection weights are not verified SSC/TCS frequency data.'

export function createCaRouter({pool,query,auth}){
  const router=Router(),ready=asyncRoute(async(_req,res,next)=>{const state=await caStatus(query,{withCounts:false});if(!state.ok)return res.status(503).json(state);next()})
  // One source-backed, human-reviewed fact for the dashboard. The event's
  // actual date is returned so older published material is never presented as
  // if it happened today. No news or answer keys are generated here.
  router.get('/current-affairs/capsule',ready,asyncRoute(async(_req,res)=>{
    const today=indiaToday()
    const {rows:[event]}=await query(`SELECT e.id,to_char(e.event_date,'YYYY-MM-DD') AS event_date,e.category,e.title_en,e.fact_en,
      s.title AS source_title,s.source_url FROM cgl_ca_events e JOIN cgl_ca_sources s ON s.id=e.event_source_id
      WHERE e.status='Published' AND s.allow_republication AND e.event_date<=$1::date
      ORDER BY e.event_date DESC,e.id DESC LIMIT 1`,[today])
    res.json({as_of:today,capsule:event??null})
  }))
  router.get('/current-affairs/categories',ready,asyncRoute(async(_req,res)=>{
    res.json({categories:CA_CATEGORIES.map(c=>({...c,award_groups:c.code==='Awards'?AWARD_GROUPS:undefined})),weight_version:CA_EDITORIAL_WEIGHT_VERSION,note:responseNote})
  }))
  router.get('/current-affairs/coverage',ready,asyncRoute(async(req,res)=>{
    const stage=stageParam(req)||'Tier_1',today=indiaToday()
    const {rows:facts}=await query(`SELECT to_char(e.event_date,'YYYY-MM-DD') AS event_date,e.category,e.award_group,COUNT(q.id)::int AS questions
      FROM cgl_ca_events e LEFT JOIN cgl_ca_questions q ON q.event_id=e.id AND q.status='Published'
      WHERE e.status='Published' AND e.event_date<=$1::date GROUP BY e.event_date,e.category,e.award_group`,[today])
    const {rows:mocks}=await query(`SELECT m.id,m.kind,m.year,m.month,m.week,m.category,m.award_group,
      to_char(m.period_end,'YYYY-MM-DD') AS period_end,to_char(m.as_of_date,'YYYY-MM-DD') AS as_of_date
      FROM cgl_ca_mocks m WHERE ${availableMock} AND m.exam_stage=$1 ORDER BY m.period_end DESC,m.id DESC`,[stage])
    const count=(start,end,category=null,award=null)=>facts.filter(f=>f.event_date>=start&&f.event_date<=end&&(!category||f.category===category)&&(!award||f.award_group===award)).reduce((n,f)=>n+f.questions,0)
    const find=(kind,year,month=null,week=null,category=null,award=null)=>mocks.find(m=>m.kind===kind&&m.year===year&&m.month===month&&m.week===week&&m.category===category&&m.award_group===award)??null
    const categoryCoverage=(year,month,bounds,category,award=null)=>{
      const num=count(bounds.start,bounds.end,category,award),snapshot=find('Category',year,month,null,category,award),id=snapshot?.id??null
      const result={category,...(award?{award_group:award}:{}),required_questions:20,available_questions:num,mock_id:id,
        snapshot_as_of:snapshot?.as_of_date??null,snapshot_period_end:snapshot?.period_end??null,
        snapshot_stale:!!snapshot&&snapshot.period_end<(bounds.end<today?bounds.end:today),
        status:statusFor({start:bounds.start,end:bounds.end,today,count:num,target:20,available:id,category:true})}
      if(category==='Awards'&&!award)result.award_groups=AWARD_GROUPS.map(group=>categoryCoverage(year,month,bounds,category,group))
      return result
    }
    const months=[],annual=[]
    for(const year of [2025,2026]){
      const y=yearBounds(year),n=count(y.start,y.end),id=find('Annual',year)?.id??null
      const missingMonths=Array.from({length:12},(_,i)=>i+1).filter(month=>{const b=monthBounds(year,month);return count(b.start,b.end)===0})
      let yearStatus=statusFor({start:y.start,end:y.end,today,count:n,target:100,available:id})
      if(yearStatus==='Ready_To_Assemble'&&missingMonths.length)yearStatus='Awaiting_Month_Coverage'
      annual.push({year,period_start:y.start,period_end:y.end,required_questions:100,available_questions:n,missing_months:missingMonths,mock_id:id,status:yearStatus,
        categories:CA_CATEGORIES.map(c=>categoryCoverage(year,null,y,c.code))})
      for(let month=1;month<=12;month++){
        const b=monthBounds(year,month),available=count(b.start,b.end),mockId=find('Monthly',year,month)?.id??null
        const weeks=Array.from({length:Math.ceil(b.days/7)},(_,index)=>{
          const week=index+1,w=weekBounds(year,month,week),num=count(w.start,w.end),wid=find('Weekly',year,month,week)?.id??null
          return {week,period_start:w.start,period_end:w.end,partial_window:w.partial_window,required_questions:20,available_questions:num,mock_id:wid,status:statusFor({start:w.start,end:w.end,today,count:num,target:20,available:wid})}
        })
        const categories=CA_CATEGORIES.map(c=>categoryCoverage(year,month,b,c.code))
        months.push({year,month,period_start:b.start,period_end:b.end,required_questions:50,available_questions:available,mock_id:mockId,
          status:statusFor({start:b.start,end:b.end,today,count:available,target:50,available:mockId}),weeks,categories})
      }
    }
    res.json({as_of:today,time_zone:'Asia/Kolkata',stage,months,annual,note:responseNote})
  }))
  router.get('/current-affairs/mocks',ready,asyncRoute(async(req,res)=>{
    const f=filters(req),limitRaw=scalar(req.query.limit,'limit')??'100',offsetRaw=scalar(req.query.offset,'offset')??'0'
    if(!/^\d{1,6}$/.test(limitRaw)||!/^\d{1,6}$/.test(offsetRaw))throw new ContentError('Invalid pagination')
    const limit=Number(limitRaw),offset=Number(offsetRaw);if(limit<1||limit>100)throw new ContentError('limit must be 1–100')
    const {rows}=await query(`SELECT m.id,m.kind,m.exam_stage,m.year,m.month,m.week,m.category,m.award_group,m.title,m.target_count,m.correct_marks,m.wrong_deduction,
      to_char(m.period_start,'YYYY-MM-DD') AS period_start,to_char(m.period_end,'YYYY-MM-DD') AS period_end,to_char(m.as_of_date,'YYYY-MM-DD') AS as_of_date,m.selection_policy
      FROM cgl_ca_mocks m WHERE ${availableMock} AND ($1::text IS NULL OR m.exam_stage=$1) AND ($2::int IS NULL OR m.year=$2)
      AND ($3::int IS NULL OR m.month=$3) AND ($4::int IS NULL OR m.week=$4) AND ($5::text IS NULL OR m.kind=$5)
      AND ($6::text IS NULL OR m.category=$6) AND ($7::text IS NULL OR m.award_group=$7) ORDER BY m.year DESC,m.month NULLS LAST,m.id DESC LIMIT $8 OFFSET $9`,
      [f.stage,f.year,f.month,f.week,f.kind,f.category,f.award,limit+1,offset])
    res.json({mocks:rows.slice(0,limit),pagination:{limit,offset,has_more:rows.length>limit,next_offset:rows.length>limit?offset+limit:null},note:responseNote})
  }))
  router.get('/current-affairs/mocks/:id',ready,asyncRoute(async(req,res)=>{
    const id=validId(req.params.id)
    const {rows:[mock]}=await query(`SELECT m.id,m.kind,m.exam_stage,m.year,m.month,m.week,m.category,m.award_group,m.title,m.target_count,m.correct_marks,m.wrong_deduction,
      to_char(m.period_start,'YYYY-MM-DD') AS period_start,to_char(m.period_end,'YYYY-MM-DD') AS period_end,to_char(m.as_of_date,'YYYY-MM-DD') AS as_of_date,m.selection_policy
      FROM cgl_ca_mocks m WHERE m.id=$1 AND ${availableMock}`,[id])
    if(!mock)return res.status(404).json({error:'Current-affairs mock not found'})
    const {rows}=await query(`SELECT q.id,i.position,q.content,e.category,e.award_group,to_char(e.event_date,'YYYY-MM-DD') AS event_date
      FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id JOIN cgl_ca_events e ON e.id=i.event_id WHERE i.mock_id=$1 AND q.status='Published' AND e.status='Published' ORDER BY i.position`,[id])
    if(rows.length!==mock.target_count)return res.status(404).json({error:'Current-affairs mock not found'})
    const questions=rows.map(r=>({id:r.id,position:r.position,category:r.category,award_group:r.award_group,event_date:r.event_date,question_text_en:r.content.question_text_en,
      question_text_hi:r.content.question_text_hi,options:r.content.options,ideal_time_seconds:r.content.ideal_time_seconds}))
    res.json({mock:{...mock,kind_label:'AI-generated, reviewed practice; not an official SSC paper',questions:questions.map(redactPublicQuestion)},note:responseNote})
  }))
  router.post('/current-affairs/mocks/:id/attempts',ready,auth,asyncRoute(async(req,res)=>{
    const id=validId(req.params.id),client=await pool.connect()
    try{
      await client.query('BEGIN')
      await lockLearnerContent(client,req.userId)
      const {rows:[mock]}=await client.query(`SELECT m.id,m.kind,m.exam_stage,m.target_count,m.correct_marks,m.wrong_deduction FROM cgl_ca_mocks m WHERE m.id=$1 AND ${availableMock} FOR SHARE OF m`,[id])
      if(!mock){await client.query('ROLLBACK');return res.status(404).json({error:'Current-affairs mock not found'})}
      const answers=parseAnswers(req.body?.answers,mock.target_count)
      const {rows}=await client.query(`SELECT q.id,q.status AS question_status,q.content,e.status AS event_status,e.id AS event_id,i.position,
        e.category,e.award_group,to_char(e.event_date,'YYYY-MM-DD') AS event_date,e.static_title_en,e.static_title_hi,e.static_fact_en,e.static_fact_hi,e.static_link_en,e.static_link_hi,
        e.static_translation_note,to_char(e.static_as_of,'YYYY-MM-DD') AS static_as_of,s.title AS event_source_title,s.source_url AS event_source_url,
        t.title AS static_source_title,t.source_url AS static_source_url FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id
        JOIN cgl_ca_events e ON e.id=i.event_id JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id
        WHERE i.mock_id=$1 ORDER BY i.position FOR SHARE OF q,e`,[id])
      const expected=new Set(rows.map(r=>String(r.id)))
      if(rows.length!==mock.target_count||rows.some(r=>r.question_status!=='Published'||r.event_status!=='Published'))throw new ContentError('Mock content is no longer available')
      if([...answers.keys()].some(key=>!expected.has(key)))throw new ContentError('Answers must refer to questions in this mock')
      let score=0,correct=0,wrong=0,skipped=0
      const summaries=rows.map(row=>{
        const selected=answers.has(String(row.id))?answers.get(String(row.id)):null
        const isCorrect=selected===null?null:selected===row.content.correct_option_index
        const marks=isCorrect===null?0:isCorrect?Number(mock.correct_marks):-Number(mock.wrong_deduction)
        if(isCorrect===null)skipped++;else if(isCorrect)correct++;else wrong++
        score=round(score+marks)
        return {question_id:String(row.id),selected_option_index:selected,is_correct:isCorrect,awarded_marks:marks}
      })
      const max=round(Number(mock.correct_marks)*rows.length)
      const {rows:[attempt]}=await client.query('INSERT INTO cgl_ca_attempts(user_id,mock_id,score,max_score,results) VALUES($1,$2,$3,$4,$5) RETURNING id,submitted_at',
        [req.userId,id,score,max,JSON.stringify(summaries)])
      const results=summaries.map((answer,index)=>({...answer,...reviewFor(rows[index])}))
      await client.query('COMMIT')
      res.status(201).json({attempt:{...attempt,mock_id:id,exam_stage:mock.exam_stage,score,max_score:max,correct,wrong,skipped,results},note:responseNote})
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }))
  router.get('/current-affairs/attempts',ready,auth,asyncRoute(async(req,res)=>{
    const {rows}=await query('SELECT id,mock_id,score,max_score,submitted_at FROM cgl_ca_attempts WHERE user_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 100',[req.userId])
    res.json({attempts:rows})
  }))
  router.get('/current-affairs/attempts/:id',ready,auth,asyncRoute(async(req,res)=>{
    const id=validId(req.params.id)
    const {rows:[attempt]}=await query(`SELECT a.id,a.mock_id,a.score,a.max_score,a.results,a.submitted_at,m.status AS mock_status
      FROM cgl_ca_attempts a JOIN cgl_ca_mocks m ON m.id=a.mock_id WHERE a.id=$1 AND a.user_id=$2`,[id,req.userId])
    if(!attempt)return res.status(404).json({error:'Attempt not found'})
    const {rows}=await query(`SELECT q.id,q.status AS question_status,q.content,e.status AS event_status,e.id AS event_id,i.position,
      e.category,e.award_group,to_char(e.event_date,'YYYY-MM-DD') AS event_date,e.static_title_en,e.static_title_hi,e.static_fact_en,e.static_fact_hi,e.static_link_en,e.static_link_hi,
      e.static_translation_note,to_char(e.static_as_of,'YYYY-MM-DD') AS static_as_of,s.title AS event_source_title,s.source_url AS event_source_url,
      t.title AS static_source_title,t.source_url AS static_source_url FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id
      JOIN cgl_ca_events e ON e.id=i.event_id JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id
      WHERE i.mock_id=$1 ORDER BY i.position`,[attempt.mock_id])
    const byId=new Map(rows.map(row=>[String(row.id),row]))
    attempt.results=attempt.results.map(answer=>{
      const row=byId.get(String(answer.question_id))
      if(attempt.mock_status!=='Published'||!row||row.question_status!=='Published'||row.event_status!=='Published')return {...answer,content_withdrawn:true}
      return {...answer,...reviewFor(row)}
    })
    delete attempt.mock_status
    res.json({attempt})
  }))
  router.use((error,_req,res,next)=>{if(error instanceof ContentError)return res.status(400).json({error:error.message});next(error)})
  return router
}
function reviewFor(row){
  return {correct_option_index:row.content.correct_option_index,explanation_en:row.content.explanation_en,explanation_hi:row.content.explanation_hi,
    event_source:{title:row.event_source_title,url:row.event_source_url,event_date:row.event_date},static_gk_booster:{label:'Static GK Booster Box',
      title_en:row.static_title_en,title_hi:row.static_title_hi,fact_en:row.static_fact_en,fact_hi:row.static_fact_hi,link_en:row.static_link_en,link_hi:row.static_link_hi,
      translation_note:row.static_translation_note,as_of:row.static_as_of,source:{title:row.static_source_title,url:row.static_source_url}}}
}
