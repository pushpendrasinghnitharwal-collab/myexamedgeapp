import {redactPublicQuestion} from './public-question.js'
import {lockLearnerContent} from './learner-content-lock.js'
import { Router } from 'express'
import { ContentError } from './content-utils.js'
import { PYQ_MIGRATION_CHECKSUM, PYQ_MIGRATION_VERSION } from './pyq-migration.js'

const asyncRoute=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next)
const positiveId=value=>typeof value==='string' && /^[1-9][0-9]{0,17}$/.test(value)

export async function pyqStatus(query,{withCounts=true}={}) {
  const {rows:[tables]}=await query(`SELECT to_regclass('public.cgl_pyq_papers') IS NOT NULL AS papers,
    to_regclass('public.cgl_pyq_import_history') IS NOT NULL AS imports,to_regclass('public.cgl_pyq_sections') IS NOT NULL AS sections,to_regclass('public.cgl_pyq_passages') IS NOT NULL AS passages,
    to_regclass('public.cgl_pyq_questions') IS NOT NULL AS questions,to_regclass('public.cgl_pyq_attempts') IS NOT NULL AS attempts,
    to_regclass('public.cgl_ai_batches') IS NOT NULL AS batches,to_regclass('public.cgl_ai_attempts') IS NOT NULL AS ai_attempts`)
  if (!Object.values(tables).every(Boolean)) return {ok:false,code:'SSC_CGL_PYQ_MIGRATION_REQUIRED'}
  const {rows:[version]}=await query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1',[PYQ_MIGRATION_VERSION])
  if (!version) return {ok:false,code:'SSC_CGL_PYQ_MIGRATION_REQUIRED'}
  if (version.checksum!==PYQ_MIGRATION_CHECKSUM) return {ok:false,code:'SSC_CGL_PYQ_CHECKSUM_MISMATCH'}
  if (!withCounts) return {ok:true,schema_version:PYQ_MIGRATION_VERSION}
  const {rows:[counts]}=await query(`SELECT (SELECT COUNT(*)::int FROM cgl_pyq_papers WHERE status='Published') AS papers,
    (SELECT COUNT(*)::int FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE p.status='Published') AS questions,
    (SELECT COUNT(*)::int FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE b.status='Published' AND p.status='Published') AS ai_batches`)
  return {ok:true,schema_version:PYQ_MIGRATION_VERSION,counts}
}
function filters(req) {
  const raw={stage:req.query.stage,cycle_year:req.query.cycle_year,subject:req.query.subject,chapter:req.query.chapter}
  if (Object.values(raw).some(v=>v!==undefined && typeof v!=='string')) throw new ContentError('Invalid filters')
  const stage=raw.stage ?? null, year=raw.cycle_year ?? null, subject=raw.subject ?? null, chapter=raw.chapter ?? null
  if (stage!==null && !['Tier_1','Tier_2'].includes(stage)) throw new ContentError('Invalid stage')
  if (year!==null && !/^202[1-5]$/.test(year)) throw new ContentError('Invalid cycle_year')
  if (subject!==null && (!subject.trim() || subject.length>120)) throw new ContentError('Invalid subject')
  if (chapter!==null && (!chapter.trim() || chapter.length>200)) throw new ContentError('Invalid chapter')
  return {stage,year:year===null?null:Number(year),subject,chapter}
}
function parseAnswers(value,key) {
  if (!Array.isArray(value) || value.length>300) throw new ContentError('answers must be an array of at most 300 items')
  const map=new Map()
  for (const item of value) {
    if (!item || typeof item!=='object' || Array.isArray(item) || Object.keys(item).some(k=>![key,'selected_option_index'].includes(k))) throw new ContentError('Invalid answer object')
    const id=String(item[key] ?? ''),selected=item.selected_option_index
    if (!positiveId(id) || map.has(id) || (selected!==null && (!Number.isInteger(selected) || selected<0 || selected>3))) throw new ContentError('Answer IDs must be unique and selections must be null or 0–3')
    map.set(id,selected)
  }
  return map
}
const round = value => Math.round((value+Number.EPSILON)*100)/100
const publicQuestionFields=`q.id,q.paper_id,q.source_question_ref,q.section_code,q.position,q.subject,q.chapter,q.sub_chapter,q.question_text_en,q.question_text_hi,q.translation_note,q.media_url,q.options,
  q.canonical_subject,q.canonical_topic,q.canonical_sub_topic,q.canonical_stage,q.passage_ref,
  CASE WHEN ps.passage_ref IS NULL THEN NULL ELSE jsonb_build_object('ref',ps.passage_ref,'text_en',ps.text_en,'text_hi',ps.text_hi,'translation_note',ps.translation_note) END AS passage`

export function createPyqRouter({pool,query,auth}) {
  const router=Router()
  const ready=asyncRoute(async (_req,res,next)=>{const status=await pyqStatus(query,{withCounts:false});if(!status.ok)return res.status(503).json(status);next()})
  router.get('/pyq/papers',ready,asyncRoute(async(req,res)=>{
    const f=filters(req)
    const {rows}=await query(`SELECT id,cycle_year,exam_stage,paper_code,to_char(exam_date,'YYYY-MM-DD') AS exam_date,shift_label,title,duration_seconds,expected_questions,paper_url,source_description
      FROM cgl_pyq_papers p WHERE status='Published' AND ($1::int IS NULL OR cycle_year=$1) AND ($2::text IS NULL OR exam_stage=$2)
      AND (($3::text IS NULL AND $4::text IS NULL) OR EXISTS (SELECT 1 FROM cgl_pyq_questions q WHERE q.paper_id=p.id AND ($3::text IS NULL OR q.subject=$3) AND ($4::text IS NULL OR q.chapter=$4)))
      ORDER BY cycle_year DESC,exam_date,shift_label,paper_code`,[f.year,f.stage,f.subject,f.chapter])
    res.json({papers:rows,note:'Cycle year and actual exam date are distinct; historical paper rules are stored per source.'})
  }))
  router.get('/pyq/papers/:id',ready,asyncRoute(async(req,res)=>{
    if (!positiveId(req.params.id)) throw new ContentError('Invalid paper ID')
    const {rows:[paper]}=await query(`SELECT id,cycle_year,exam_stage,paper_code,to_char(exam_date,'YYYY-MM-DD') AS exam_date,shift_label,title,duration_seconds,expected_questions,paper_url,source_description
      FROM cgl_pyq_papers WHERE id=$1 AND status='Published'`,[req.params.id])
    if(!paper)return res.status(404).json({error:'Paper not found'})
    const {rows:sections}=await query('SELECT section_code,label,position,expected_questions,correct_marks,wrong_deduction FROM cgl_pyq_sections WHERE paper_id=$1 ORDER BY position',[req.params.id])
    const {rows:questions}=await query(`SELECT ${publicQuestionFields} FROM cgl_pyq_questions q LEFT JOIN cgl_pyq_passages ps ON (ps.paper_id,ps.passage_ref)=(q.paper_id,q.passage_ref) WHERE q.paper_id=$1 ORDER BY q.position`,[req.params.id])
    res.json({paper:{...paper,sections,questions:questions.map(redactPublicQuestion)}})
  }))
  router.get('/pyq/chapters',ready,asyncRoute(async(req,res)=>{
    const f=filters(req)
    const {rows}=await query(`SELECT q.subject,q.chapter,COUNT(*)::int AS question_count,COUNT(DISTINCT p.id)::int AS paper_count
      FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id
      WHERE p.status='Published' AND ($1::int IS NULL OR p.cycle_year=$1) AND ($2::text IS NULL OR p.exam_stage=$2)
        AND ($3::text IS NULL OR q.subject=$3) AND ($4::text IS NULL OR q.chapter=$4)
      GROUP BY q.subject,q.chapter ORDER BY q.subject,q.chapter`,[f.year,f.stage,f.subject,f.chapter])
    res.json({chapters:rows,note:'Chapter labels are editorial classifications, not SSC weightages.'})
  }))
  router.get('/pyq/chapters/questions',ready,asyncRoute(async(req,res)=>{
    const f=filters(req)
    if(!f.subject || !f.chapter) throw new ContentError('subject and chapter are required')
    const limitRaw=req.query.limit ?? '100',offsetRaw=req.query.offset ?? '0'
    if (typeof limitRaw!=='string' || typeof offsetRaw!=='string' || !/^[0-9]{1,6}$/.test(limitRaw) || !/^[0-9]{1,6}$/.test(offsetRaw)) throw new ContentError('Invalid pagination')
    const limit=Number(limitRaw),offset=Number(offsetRaw)
    if (limit<1 || limit>300) throw new ContentError('limit must be between 1 and 300')
    const {rows}=await query(`SELECT ${publicQuestionFields},p.cycle_year,p.exam_stage,to_char(p.exam_date,'YYYY-MM-DD') AS exam_date,p.shift_label,p.paper_code
      FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id LEFT JOIN cgl_pyq_passages ps ON (ps.paper_id,ps.passage_ref)=(q.paper_id,q.passage_ref)
      WHERE p.status='Published' AND q.subject=$1 AND q.chapter=$2 AND ($3::int IS NULL OR p.cycle_year=$3) AND ($4::text IS NULL OR p.exam_stage=$4)
      ORDER BY p.cycle_year DESC,p.exam_date,q.position,q.id LIMIT $5 OFFSET $6`,[f.subject,f.chapter,f.year,f.stage,limit+1,offset])
    const hasMore=rows.length>limit
    res.json({questions:rows.slice(0,limit).map(redactPublicQuestion),pagination:{limit,offset,has_more:hasMore,next_offset:hasMore?offset+limit:null}})
  }))
  router.post('/pyq/grade',ready,auth,asyncRoute(async(req,res)=>{
    const mode=req.body?.mode,answers=parseAnswers(req.body?.answers,'question_id'),paperId=req.body?.paper_id == null?null:String(req.body.paper_id)
    if(!['Paper','Chapter'].includes(mode) || (mode==='Paper' && !positiveId(paperId)) || (mode==='Chapter' && (paperId!==null || !answers.size))) throw new ContentError('Paper mode requires paper_id; Chapter mode requires question answers without paper_id')
    const client=await pool.connect()
    try {
      await client.query('BEGIN')
      await lockLearnerContent(client,req.userId)
      const sql=`SELECT q.id,q.answer_status,q.correct_option_indices,q.void_policy,q.solution_basic,q.solution_trick,s.correct_marks,s.wrong_deduction
        FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id JOIN cgl_pyq_sections s ON (s.paper_id,s.section_code)=(q.paper_id,q.section_code)
        WHERE p.status='Published' AND ${mode==='Paper'?'q.paper_id=$1':'q.id=ANY($1::bigint[])'} ORDER BY q.position,q.id FOR SHARE OF p`
      const {rows}=await client.query(sql,[mode==='Paper'?paperId:[...answers.keys()]])
      const expected=new Set(rows.map(q=>String(q.id)))
      if (!rows.length || [...answers.keys()].some(id=>!expected.has(id)) || (mode==='Chapter' && rows.length!==answers.size)) throw new ContentError('Answers must refer to published questions in the requested paper or deck')
      let score=0,max=0
      const results=rows.map(q=>{
        const selected=answers.has(String(q.id))?answers.get(String(q.id)):null
        const correct=Number(q.correct_marks),wrong=Number(q.wrong_deduction)
        let awarded=0,isCorrect=null,maximum=correct
        if(q.answer_status==='Void') { if(q.void_policy==='Excluded') maximum=0; else awarded=correct }
        else if(selected!==null){isCorrect=q.correct_option_indices.includes(selected);awarded=isCorrect?correct:-wrong}
        score=round(score+awarded);max=round(max+maximum)
        return {question_id:q.id,selected_option_index:selected,answer_status:q.answer_status,correct_option_indices:q.correct_option_indices,void_policy:q.void_policy,is_correct:isCorrect,awarded_marks:awarded,maximum_marks:maximum,solution_basic:q.solution_basic,solution_trick:q.solution_trick}
      })
      const {rows:[attempt]}=await client.query(`INSERT INTO cgl_pyq_attempts(user_id,mode,paper_id,score,max_score,results) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,submitted_at`,[req.userId,mode,paperId,score,max,JSON.stringify(results)])
      await client.query('COMMIT');res.status(201).json({attempt:{...attempt,mode,paper_id:paperId,score,max_score:max,results},note:'Raw practice score uses each source section’s stated historical marking rules; mixed-year chapter totals are not official SSC results.'})
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }))
  router.get('/pyq/attempts',ready,auth,asyncRoute(async(req,res)=>{
    const {rows}=await query('SELECT id,mode,paper_id,score,max_score,submitted_at FROM cgl_pyq_attempts WHERE user_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 100',[req.userId])
    res.json({attempts:rows})
  }))
  router.get('/pyq/attempts/:id',ready,auth,asyncRoute(async(req,res)=>{
    if(!positiveId(req.params.id))throw new ContentError('Invalid attempt ID')
    const {rows:[attempt]}=await query('SELECT id,mode,paper_id,score,max_score,results,submitted_at FROM cgl_pyq_attempts WHERE id=$1 AND user_id=$2',[req.params.id,req.userId])
    if(!attempt)return res.status(404).json({error:'Attempt not found'})
    const ids=attempt.results.map(item=>String(item.question_id))
    const {rows:states}=await query(`SELECT q.id,p.status FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE q.id=ANY($1::bigint[])`,[ids])
    const available=new Set(states.filter(item=>item.status==='Published').map(item=>String(item.id)))
    attempt.results=attempt.results.map(item=>{
      if (available.has(String(item.question_id))) return item
      const {correct_option_indices,answer_status,void_policy,solution_basic,solution_trick,...history}=item
      return {...history,content_withdrawn:true}
    })
    res.json({attempt})
  }))
  router.get('/generated',ready,asyncRoute(async(req,res)=>{
    const f=filters(req)
    const {rows}=await query(`SELECT b.id,b.exam_stage,b.format,b.subject,b.topic,b.sub_topic,b.created_at FROM cgl_ai_batches b
      JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id
      WHERE b.status='Published' AND p.status='Published' AND ($1::text IS NULL OR b.exam_stage=$1) AND ($2::text IS NULL OR b.subject=$2)
        AND ($3::int IS NULL OR p.cycle_year=$3) AND ($4::text IS NULL OR q.chapter=$4) ORDER BY b.id DESC LIMIT 100`,[f.stage,f.subject,f.year,f.chapter])
    res.json({batches:rows,kind:'AI-generated practice, not official PYQ'})
  }))
  router.get('/generated/:id',ready,asyncRoute(async(req,res)=>{
    if(!positiveId(req.params.id))throw new ContentError('Invalid batch ID')
    const {rows:[batch]}=await query("SELECT b.id,b.exam_stage,b.format,b.subject,b.topic,b.sub_topic,b.content FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE b.id=$1 AND b.status='Published' AND p.status='Published'",[req.params.id])
    if(!batch)return res.status(404).json({error:'AI batch not found'})
    const questions=batch.content.questions.map((q,index)=>({question_number:index+1,question_type:q.question_type,question_text_en:q.question_text_en,question_text_hi:q.question_text_hi,options:q.options,ideal_time_seconds:q.ideal_time_seconds,passage_ref:q.passage_ref}))
    const passages=batch.content.passages
    delete batch.content
    res.json({batch:{...batch,kind:'AI-generated practice, not official PYQ',passages:redactPublicQuestion(passages),questions:questions.map(redactPublicQuestion)}})
  }))
  router.post('/generated/:id/grade',ready,auth,asyncRoute(async(req,res)=>{
    if(!positiveId(req.params.id))throw new ContentError('Invalid batch ID')
    const answers=parseAnswers(req.body?.answers,'question_number'),client=await pool.connect()
    try {
      await client.query('BEGIN')
      await lockLearnerContent(client,req.userId)
      const {rows:[batch]}=await client.query("SELECT b.content FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE b.id=$1 AND b.status='Published' AND p.status='Published' FOR SHARE OF b,p",[req.params.id])
      if(!batch)throw new ContentError('Published AI batch not found')
      const questions=batch.content.questions
      if([...answers.keys()].some(id=>Number(id)>questions.length))throw new ContentError('Answer refers to an unknown question')
      let count=0
      const results=questions.map((q,i)=>{const selected=answers.has(String(i+1))?answers.get(String(i+1)):null;const correct=selected===null?null:selected===q.correct_option_index;if(correct)count++;return {question_number:i+1,selected_option_index:selected,is_correct:correct,correct_option_index:q.correct_option_index,solution_basic:q.solution_basic,solution_trick:q.solution_trick}})
      const {rows:[attempt]}=await client.query('INSERT INTO cgl_ai_attempts(user_id,batch_id,correct_count,question_count,results) VALUES($1,$2,$3,$4,$5) RETURNING id,submitted_at',[req.userId,req.params.id,count,questions.length,JSON.stringify(results)])
      await client.query('COMMIT');res.status(201).json({attempt:{...attempt,batch_id:req.params.id,correct_count:count,question_count:questions.length,results}})
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }))
  router.get('/generated-attempts',ready,auth,asyncRoute(async(req,res)=>{
    const {rows}=await query('SELECT id,batch_id,correct_count,question_count,submitted_at FROM cgl_ai_attempts WHERE user_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 100',[req.userId])
    res.json({attempts:rows})
  }))
  router.get('/generated-attempts/:id',ready,auth,asyncRoute(async(req,res)=>{
    if(!positiveId(req.params.id))throw new ContentError('Invalid attempt ID')
    const {rows:[attempt]}=await query(`SELECT a.id,a.batch_id,a.correct_count,a.question_count,a.results,a.submitted_at,
      (b.status='Published' AND p.status='Published') AS content_available
      FROM cgl_ai_attempts a JOIN cgl_ai_batches b ON b.id=a.batch_id JOIN cgl_pyq_questions q ON q.id=b.source_question_id
      JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE a.id=$1 AND a.user_id=$2`,[req.params.id,req.userId])
    if(!attempt)return res.status(404).json({error:'Attempt not found'})
    if (!attempt.content_available) attempt.results=attempt.results.map(item=>{
      const {correct_option_index,solution_basic,solution_trick,...history}=item
      return {...history,content_withdrawn:true}
    })
    delete attempt.content_available
    res.json({attempt})
  }))
  router.use((error,_req,res,next)=>{if(error instanceof ContentError)return res.status(400).json({error:error.message});next(error)})
  return router
}
