import {ContentError,integer,onlyKeys,text} from './content-utils.js'
import {reviewMasterMock} from './master-service.js'
import {sourceAvailability} from './master-sources.js'
import {redactPublicQuestion} from './public-question.js'
import {MentorError,mentorProviderFromEnv} from './mentor-provider.js'

const INTENTS=['trick','eliminate','step','pyq','custom']
const PROMPTS={trick:'Explain a quick exam approach to this reviewed question; do not promise a 20-second solve.',eliminate:'Explain how to eliminate the wrong options using the reviewed key and solution.',step:'Explain how the key step in the reviewed solution follows, without inventing missing information.',custom:'Answer the learner’s doubt about this question.'}
function requestInput(body){
  onlyKeys(body,['position','intent','language','message'],'mentor request')
  integer(body.position,'position',1,300)
  if(!INTENTS.includes(body.intent))throw new ContentError('Invalid mentor prompt')
  if(!['en','hi'].includes(body.language))throw new ContentError('Invalid mentor language')
  if(body.intent==='custom')text(body.message,'message',{max:500})
  else if(body.message!==undefined)throw new ContentError('message is only accepted for custom doubts')
  return {position:body.position,intent:body.intent,language:body.language,...(body.intent==='custom'?{message:body.message.trim()}:{})}
}
const unavailable=()=>new MentorError('MENTOR_CONTENT_UNAVAILABLE','This question is not available for Mentor review.',409)
const rights=()=>new MentorError('MENTOR_RIGHTS_REQUIRED','AI Mentor is unavailable for this question because external-processing permission has not been established.',403)
function localized(value,lang){return typeof value==='string'?value:value&&typeof value==='object'?(value[lang]||value.en||value.hi||''):''}
function field(q,base,lang){return lang==='hi'?(q[`${base}_hi`]||q[`${base}_en`]||q[base]||''):(q[`${base}_en`]||q[base]||q[`${base}_hi`]||'')}
function contextFor(q,input){
  const passage=q.passage||{},chart=passage.chart_data?redactPublicQuestion(passage.chart_data):null
  const chartJson=chart?JSON.stringify(chart):''
  const hasVisual=!!(q.media_url||q.media_svg_or_url||passage.media_svg_or_url||passage.media_url)
  const correct=q.correct_option_indices??(Number.isInteger(q.correct_option_index)?[q.correct_option_index]:[])
  const context={request:PROMPTS[input.intent],response_language:input.language==='hi'?'Hinglish (Hindi in Roman script)':'English or concise Hinglish',
    learner_message:input.message??null,subject:q.subject,topic:q.topic,question:field(q,'question_text',input.language),
    passage:field(passage,'passage_text',input.language)||field(passage,'text',input.language)||null,
    chart_data:chartJson&&chartJson.length<=8000?chart:null,visual_or_chart_unavailable:hasVisual||chartJson.length>8000,
    options:(q.options||[]).map((option,index)=>({label:String.fromCharCode(65+index),text:localized(option,input.language)})),
    reviewed_correct_option_indices:correct,learner_choice:q.selected_option_index===null||q.selected_option_index===undefined?null:{index:q.selected_option_index,
      label:String.fromCharCode(65+q.selected_option_index),text:localized(q.options?.[q.selected_option_index],input.language),is_correct:q.is_correct},
    reviewed_basic_solution:field(q,'solution_basic',input.language)||field(q,'explanation',input.language)||null,
    reviewed_trick_solution:field(q,'solution_trick',input.language)||null}
  if(!context.question||!context.options.length||!correct.length||JSON.stringify(context).length>24000)throw new MentorError('MENTOR_CONTEXT_UNAVAILABLE','This question is too large or incomplete for the text-only Mentor. Please use its reviewed solution.',409)
  return context
}

// Recheck and share-lock exactly the target source immediately before sending to
// the provider. Withdrawal cannot race the outbound request. Published content
// used by a master mock is immutable; the reviewed projection remains current.
export async function lockAndCheckSource(client,item,review,allowBank,enforceRights=true){
  if(item.source_kind==='Bank'){
    const {rows:[q]}=await client.query('SELECT status,passage_set_id FROM cgl_questions WHERE id=$1 FOR SHARE',[item.source_id])
    if(!q||q.status!=='Published')throw unavailable()
    if(q.passage_set_id){const {rows:[s]}=await client.query('SELECT status FROM cgl_question_sets WHERE id=$1 FOR SHARE',[q.passage_set_id]);if(s?.status!=='Published')throw unavailable()}
    if(enforceRights&&!allowBank)throw rights();return
  }
  if(item.source_kind==='PYQ'||item.source_kind==='AI'){
    const sql=item.source_kind==='PYQ'
      ?`SELECT p.status,p.allow_derivatives,p.allow_external_processing FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE q.id=$1 FOR SHARE OF p`
      :`SELECT p.status,p.allow_derivatives,p.allow_external_processing FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE b.id=$1 FOR SHARE OF p`
    const {rows:[paper]}=await client.query(sql,[item.source_id]);if(!paper||paper.status!=='Published')throw unavailable()
    if(item.source_kind==='AI'){const {rows:[batch]}=await client.query('SELECT status FROM cgl_ai_batches WHERE id=$1 FOR SHARE',[item.source_id]);if(batch?.status!=='Published')throw unavailable()}
    if(enforceRights&&(!paper.allow_derivatives||!paper.allow_external_processing))throw rights();return
  }
  if(item.source_kind==='CA'){
    if(review.mock.selection?.source?.type==='CA'){
      const {rows:[mock]}=await client.query('SELECT status FROM cgl_ca_mocks WHERE id=$1 FOR SHARE',[review.mock.selection.source.id]);if(mock?.status!=='Published')throw unavailable()
    }
    const {rows:[row]}=await client.query(`SELECT q.status AS q_status,e.status AS e_status,s.allow_derivatives AS event_derivatives,s.allow_external_processing AS event_external,
      t.allow_derivatives AS static_derivatives,t.allow_external_processing AS static_external FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id
      JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id WHERE q.id=$1 FOR SHARE OF q,e`,[item.source_id])
    if(!row||row.q_status!=='Published'||row.e_status!=='Published')throw unavailable()
    if(enforceRights&&(!row.event_derivatives||!row.event_external||!row.static_derivatives||!row.static_external))throw rights();return
  }
  throw unavailable()
}
async function relatedPyqs(client,q,item,review,lang){
  if(!q.subject||!q.topic)return {type:'related_pyq',items:[],message:'No published matching PYQs are available for this topic.'}
  const sources=await sourceAvailability(client.query.bind(client))
  if(!sources.pyq.ok)return {type:'related_pyq',items:[],message:'The reviewed PYQ vault is not available on this service.'}
  let excluded=null
  if(item.source_kind==='PYQ')excluded=item.source_id
  if(item.source_kind==='AI')excluded=(await client.query('SELECT source_question_id FROM cgl_ai_batches WHERE id=$1',[item.source_id])).rows[0]?.source_question_id??null
  const {rows}=await client.query(`SELECT q.id,q.position,q.question_text_en,q.question_text_hi,p.cycle_year,p.exam_stage,to_char(p.exam_date,'YYYY-MM-DD') AS exam_date,
      p.shift_label,p.title,p.paper_url FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id
      WHERE p.status='Published' AND p.allow_derivatives AND p.exam_stage=$3 AND q.answer_status<>'Void'
      AND ((q.canonical_subject=$1 AND q.canonical_topic=$2) OR (q.subject=$1 AND q.chapter=$2)) AND ($4::bigint IS NULL OR q.id<>$4::bigint)
      ORDER BY p.cycle_year DESC,p.exam_date DESC,p.id DESC,q.position LIMIT 4 FOR SHARE OF p`,[q.subject,q.topic,review.mock.exam_stage,excluded])
  return {type:'related_pyq',items:rows.map(row=>({id:String(row.id),position:row.position,question:lang==='hi'?(row.question_text_hi||row.question_text_en):row.question_text_en,
    cycle_year:row.cycle_year,exam_stage:row.exam_stage,exam_date:row.exam_date,shift_label:row.shift_label,title:row.title,paper_url:row.paper_url})),
    message:rows.length?'Published, reviewed questions matching this topic.':'No published matching PYQs are available for this topic.'}
}
async function lockOwner(client,userId,mockId){
  const {rows:[row]}=await client.query("SELECT id FROM cgl_master_mocks WHERE id=$1 AND user_id=$2 AND status='Submitted' FOR SHARE",[mockId,userId])
  if(!row)throw unavailable()
}
export async function askMentor(client,userId,mockId,body,{provider,allowBank,env=process.env,signal}={}){
  const input=requestInput(body)
  // This is the same owner-only, submitted-only review projection used by UI;
  // clients never submit question text, choices, keys or solutions.
  const review=await reviewMasterMock(client,userId,mockId),q=review.results.find(row=>row.position===input.position)
  if(!q||q.not_delivered||q.content_withdrawn||q.answer_status==='Void')throw unavailable()
  const {rows:[item]}=await client.query(`SELECT source_kind,source_id,source_part,delivered_at FROM cgl_master_items WHERE mock_id=$1 AND position=$2`,[mockId,input.position])
  if(!item||!item.delivered_at||item.source_kind!==q.source_kind)throw unavailable()
  if(input.intent==='pyq'){
    await client.query('BEGIN')
    try{await lockOwner(client,userId,mockId);await lockAndCheckSource(client,item,review,false,false);const result=await relatedPyqs(client,q,item,review,input.language);await client.query('COMMIT');return result}
    catch(error){await client.query('ROLLBACK');throw error}
  }
  const configured=provider===undefined?mentorProviderFromEnv(env):provider
  if(!configured||typeof configured.complete!=='function')throw new MentorError('MENTOR_NOT_CONFIGURED','AI Mentor is not configured by the practice service.')
  const context=contextFor(q,input)
  await client.query('BEGIN')
  try{
    await lockOwner(client,userId,mockId)
    await lockAndCheckSource(client,item,review,allowBank===undefined?env.MENTOR_ALLOW_BANK==='true':allowBank===true)
    const answer=await configured.complete(context,{signal})
    if(typeof answer!=='string'||!answer.trim()||answer.length>1800)throw new MentorError('MENTOR_PROVIDER_UNAVAILABLE','AI Mentor returned an unusable response.',502)
    await client.query('COMMIT')
    return {type:'answer',answer:answer.trim(),visual_unavailable:context.visual_or_chart_unavailable,note:'AI guidance can be wrong. Verify against the reviewed solution.'}
  }catch(error){await client.query('ROLLBACK');throw error}
}
