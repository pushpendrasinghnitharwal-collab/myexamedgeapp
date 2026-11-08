import {sourceKey} from './master-solver.js'

const unique=xs=>[...new Set(xs.map(String))]
const noContent=()=>({available:false})
const bankPublic=r=>({question_text_en:r.question_text_en,question_text_hi:r.question_text_hi,question_type:r.question_type,options:r.options,
  media_svg_or_url:r.media_svg_or_url,ideal_time_seconds:r.ideal_time_seconds,
  passage:r.passage_set_id?{id:String(r.passage_set_id),set_type:r.set_type,passage_text_en:r.passage_text_en,passage_text_hi:r.passage_text_hi,media_svg_or_url:r.set_media,chart_data:r.chart_data}:null})
const bankReview=r=>({correct_option_index:r.correct_option_index,solution_basic:r.solution_basic,solution_basic_hi:r.solution_basic_hi,
  solution_trick:r.solution_trick,solution_trick_hi:r.solution_trick_hi,source:{url:r.source_url,citation:r.source_citation}})

// Explicit public-field projections prevent leaking keys, explanations, model
// verification, or boosters in an active question payload.
export async function loadMasterContent(client,items,{lock=false,availability,source=null,pyqDerivatives=false}={}){
  const result=new Map(items.map(item=>[sourceKey(item),noContent()]))
  const bank=items.filter(i=>i.source_kind==='Bank')
  if(bank.length){
    const ids=unique(bank.map(i=>i.source_id)),sets=unique(bank.map(i=>i.group_key?.match(/^Bank:set:(\d+)$/)?.[1]).filter(Boolean))
    if(lock){
      // Match the question-before-set lock order used by bank publication
      // and question updates, avoiding a question/set deadlock.
      await client.query('SELECT id FROM cgl_questions WHERE id=ANY($1::bigint[]) ORDER BY id FOR SHARE',[ids])
      if(sets.length)await client.query('SELECT id FROM cgl_question_sets WHERE id=ANY($1::bigint[]) ORDER BY id FOR SHARE',[sets])
    }
    const {rows}=await client.query(`SELECT q.id,q.status,q.exam_stage,q.subject,q.topic,q.sub_topic,q.difficulty,q.question_type,q.passage_set_id,
      q.question_text_en,q.question_text_hi,q.options,q.media_svg_or_url,q.ideal_time_seconds,q.correct_option_index,q.solution_basic,q.solution_basic_hi,q.solution_trick,q.solution_trick_hi,q.source_url,q.source_citation,
      ps.status AS set_status,ps.set_type,ps.passage_text_en,ps.passage_text_hi,ps.media_svg_or_url AS set_media,ps.chart_data
      FROM cgl_questions q LEFT JOIN cgl_question_sets ps ON ps.id=q.passage_set_id WHERE q.id=ANY($1::bigint[])`,[ids])
    const byId=new Map(rows.map(r=>[String(r.id),r]))
    for(const item of bank){const r=byId.get(String(item.source_id)),expected=r?.passage_set_id?`Bank:set:${r.passage_set_id}`:null
      if(!r||r.status!=='Published'||(r.passage_set_id&&r.set_status!=='Published')||r.subject!==item.subject||r.topic!==item.topic||r.sub_topic!==item.sub_topic||r.difficulty!==item.difficulty||expected!==item.group_key)continue
      result.set(sourceKey(item),{available:true,public:bankPublic(r),review:bankReview(r),stage:r.exam_stage})
    }
  }
  const pyq=items.filter(i=>i.source_kind==='PYQ')
  if(pyq.length&&availability.pyq.ok){
    const ids=unique(pyq.map(i=>i.source_id))
    if(lock)await client.query(`SELECT p.id FROM cgl_pyq_papers p JOIN cgl_pyq_questions q ON q.paper_id=p.id WHERE q.id=ANY($1::bigint[]) ORDER BY p.id FOR SHARE OF p`,[ids])
    const {rows}=await client.query(`SELECT q.id,q.paper_id,q.position,q.subject,q.chapter,q.sub_chapter,q.passage_ref,q.question_text_en,q.question_text_hi,q.translation_note,q.media_url,q.options,
      q.answer_status,q.correct_option_indices,q.void_policy,q.solution_basic,q.solution_trick,p.status AS paper_status,p.allow_derivatives,p.paper_url,p.final_key_url,
      p.cycle_year,p.exam_stage,to_char(p.exam_date,'YYYY-MM-DD') AS exam_date,p.shift_label,p.paper_code,
      ps.text_en AS passage_en,ps.text_hi AS passage_hi,ps.translation_note AS passage_translation
      FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id LEFT JOIN cgl_pyq_passages ps ON (ps.paper_id,ps.passage_ref)=(q.paper_id,q.passage_ref)
      WHERE q.id=ANY($1::bigint[])`,[ids])
    const byId=new Map(rows.map(r=>[String(r.id),r]))
    for(const item of pyq){const r=byId.get(String(item.source_id)),expected=r?.passage_ref?`PYQ:set:${r.paper_id}:${r.passage_ref}`:null
      if(!r||r.paper_status!=='Published'||(pyqDerivatives&&!r.allow_derivatives)||r.subject!==item.subject||r.chapter!==item.topic||r.sub_chapter!==item.sub_topic||expected!==item.group_key||(source?.type==='PYQ'&&String(source.id)!==String(r.paper_id)))continue
      result.set(sourceKey(item),{available:true,public:{question_text_en:r.question_text_en,question_text_hi:r.question_text_hi,translation_note:r.translation_note,
        options:r.options,media_url:r.media_url,passage:r.passage_ref?{ref:r.passage_ref,text_en:r.passage_en,text_hi:r.passage_hi,translation_note:r.passage_translation}:null,
        historical_source:{cycle_year:r.cycle_year,exam_stage:r.exam_stage,exam_date:r.exam_date,shift_label:r.shift_label,paper_code:r.paper_code}},
        review:{answer_status:r.answer_status,correct_option_indices:r.correct_option_indices,void_policy:r.void_policy,solution_basic:r.solution_basic,solution_trick:r.solution_trick,
          source:{paper_url:r.paper_url,final_key_url:r.final_key_url}},stage:r.exam_stage})
    }
  }
  const ai=items.filter(i=>i.source_kind==='AI')
  if(ai.length&&availability.pyq.ok){
    const ids=unique(ai.map(i=>i.source_id))
    if(lock){
      await client.query(`SELECT p.id FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id
        WHERE b.id=ANY($1::bigint[]) ORDER BY p.id FOR SHARE OF p`,[ids])
      await client.query('SELECT id FROM cgl_ai_batches WHERE id=ANY($1::bigint[]) ORDER BY id FOR SHARE',[ids])
    }
    const {rows}=await client.query(`SELECT b.id,b.status,b.exam_stage,b.subject,b.topic,b.sub_topic,b.content,p.status AS paper_status,p.allow_derivatives
      FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE b.id=ANY($1::bigint[])`,[ids])
    const byId=new Map(rows.map(r=>[String(r.id),r]))
    for(const item of ai){
      const b=byId.get(String(item.source_id)),q=b?.content?.questions?.[Number(item.source_part)-1],ref=q?.passage_ref??null,passage=ref?b?.content?.passages?.find(p=>p.ref===ref):null
      const expected=ref?`AI:set:${b.id}:${ref}`:null
      if(!b||b.status!=='Published'||b.paper_status!=='Published'||!b.allow_derivatives||!q||(ref&&!passage)||b.subject!==item.subject||b.topic!==item.topic||b.sub_topic!==item.sub_topic||expected!==item.group_key)continue
      result.set(sourceKey(item),{available:true,public:{question_text_en:q.question_text_en,question_text_hi:q.question_text_hi,question_type:q.question_type,
        options:q.options,ideal_time_seconds:q.ideal_time_seconds,passage:passage?{ref:passage.ref,text_en:passage.text_en,text_hi:passage.text_hi}:null},
        review:{correct_option_index:q.correct_option_index,solution_basic:q.solution_basic,solution_trick:q.solution_trick},stage:b.exam_stage})
    }
  }
  const ca=items.filter(i=>i.source_kind==='CA')
  if(ca.length&&availability.ca.ok){
    const ids=unique(ca.map(i=>i.source_id));let mockAvailable=true
    if(source?.type==='CA'){
      const {rows:[m]}=await client.query(`SELECT status FROM cgl_ca_mocks WHERE id=$1${lock?' FOR SHARE':''}`,[source.id]);mockAvailable=m?.status==='Published'
    }
    if(lock)await client.query(`SELECT q.id FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id WHERE q.id=ANY($1::bigint[]) ORDER BY q.id FOR SHARE OF q,e`,[ids])
    const {rows}=await client.query(`SELECT q.id,q.status AS question_status,q.content,e.status AS event_status,e.category,e.award_group,to_char(e.event_date,'YYYY-MM-DD') AS event_date,
      e.static_title_en,e.static_title_hi,e.static_fact_en,e.static_fact_hi,e.static_link_en,e.static_link_hi,e.static_translation_note,to_char(e.static_as_of,'YYYY-MM-DD') AS static_as_of,
      s.title AS event_source_title,s.source_url AS event_source_url,t.title AS static_source_title,t.source_url AS static_source_url
      FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id
      WHERE q.id=ANY($1::bigint[])`,[ids])
    const byId=new Map(rows.map(r=>[String(r.id),r]))
    for(const item of ca){const r=byId.get(String(item.source_id))
      if(!mockAvailable||!r||r.question_status!=='Published'||r.event_status!=='Published')continue
      result.set(sourceKey(item),{available:true,public:{question_text_en:r.content.question_text_en,question_text_hi:r.content.question_text_hi,options:r.content.options,
        ideal_time_seconds:r.content.ideal_time_seconds,category:r.category,award_group:r.award_group,event_date:r.event_date},
        review:{correct_option_index:r.content.correct_option_index,explanation_en:r.content.explanation_en,explanation_hi:r.content.explanation_hi,
          event_source:{title:r.event_source_title,url:r.event_source_url,event_date:r.event_date},
          static_gk_booster:{label:'Static GK Booster Box',title_en:r.static_title_en,title_hi:r.static_title_hi,fact_en:r.static_fact_en,fact_hi:r.static_fact_hi,
            link_en:r.static_link_en,link_hi:r.static_link_hi,translation_note:r.static_translation_note,as_of:r.static_as_of,source:{title:r.static_source_title,url:r.static_source_url}}}})
    }
  }
  return result
}
