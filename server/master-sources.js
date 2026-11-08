import {ContentError} from './content-utils.js'
import {caStatus} from './ca-api.js'
import {pyqStatus} from './pyq-api.js'
import {sourceKey,MasterSelectionError} from './master-solver.js'

const MAX_SOURCE_ROWS=20000
const checked=rows=>{if(rows.length>MAX_SOURCE_ROWS)throw new MasterSelectionError('ASSEMBLER_POOL_TOO_LARGE','The eligible source pool is too large; narrow the scope');return rows}
const keyOf=(kind,id,part=0)=>`${kind}:${id}:${part}`
const moduleFor=(modules,subject)=>modules.find(m=>m.subject===subject)?.code??null

export async function sourceAvailability(query){
  const [pyq,ca]=await Promise.all([pyqStatus(query,{withCounts:false}),caStatus(query,{withCounts:false})])
  return {pyq,ca}
}
export async function learnerSeen(client,userId,availability){
  const seen=new Map()
  const add=(kind,id,part,time)=>{
    if(id==null||!time)return
    const key=keyOf(kind,String(id),Number(part)||0),old=seen.get(key)
    if(!old||new Date(time)>new Date(old))seen.set(key,time)
  }
  const {rows:own}=await client.query('SELECT source_kind,source_id,source_part,last_seen_at FROM cgl_master_seen WHERE user_id=$1',[userId])
  for(const r of own)add(r.source_kind,r.source_id,r.source_part,r.last_seen_at)
  const {rows:bank}=await client.query(`SELECT q.question_id AS id,MAX(COALESCE(a.submitted_at,a.started_at)) AS seen_at
    FROM cgl_user_attempts a JOIN cgl_mock_test_questions q ON q.mock_test_id=a.mock_test_id
    WHERE a.user_id=$1 GROUP BY q.question_id`,[userId])
  for(const r of bank)add('Bank',r.id,0,r.seen_at)
  if(availability.pyq.ok){
    const {rows:paper}=await client.query(`SELECT item->>'question_id' AS id,MAX(a.submitted_at) AS seen_at FROM cgl_pyq_attempts a
      CROSS JOIN LATERAL jsonb_array_elements(a.results) item WHERE a.user_id=$1 AND item->>'question_id' ~ '^[0-9]+$' GROUP BY item->>'question_id'`,[userId])
    for(const r of paper)add('PYQ',r.id,0,r.seen_at)
    const {rows:ai}=await client.query(`SELECT a.batch_id,item->>'question_number' AS part,MAX(a.submitted_at) AS seen_at FROM cgl_ai_attempts a
      CROSS JOIN LATERAL jsonb_array_elements(a.results) item WHERE a.user_id=$1 AND item->>'question_number' ~ '^[0-9]+$' GROUP BY a.batch_id,item->>'question_number'`,[userId])
    for(const r of ai)add('AI',r.batch_id,r.part,r.seen_at)
  }
  if(availability.ca.ok){
    const {rows:ca}=await client.query(`SELECT item->>'question_id' AS id,MAX(a.submitted_at) AS seen_at FROM cgl_ca_attempts a
      CROSS JOIN LATERAL jsonb_array_elements(a.results) item WHERE a.user_id=$1 AND item->>'question_id' ~ '^[0-9]+$' GROUP BY item->>'question_id'`,[userId])
    for(const r of ca)add('CA',r.id,0,r.seen_at)
  }
  return seen
}
export async function learnerReservations(client,userId,excludeMock=null){
  const {rows}=await client.query(`SELECT i.source_kind,i.source_id,i.source_part FROM cgl_master_items i
    JOIN cgl_master_mocks m ON m.id=i.mock_id WHERE m.user_id=$1 AND m.expires_at>NOW()
    AND (m.status='Prepared' OR (m.status='Active' AND i.delivered_at IS NULL))
    AND ($2::bigint IS NULL OR m.id<>$2)`,[userId,excludeMock])
  return new Set(rows.map(sourceKey))
}
async function labelsFor(client){
  const {rows}=await client.query('SELECT source_kind,source_id,source_part,difficulty,mains_level,reviewer,notes,updated_at FROM cgl_master_question_labels')
  return new Map(rows.map(r=>[sourceKey(r),r]))
}
function eligible(item,spec){
  if(spec.category!=='Micro')return true
  if(item.subject!==spec.subject||(spec.topic&&item.topic!==spec.topic)||(spec.sub_topic&&item.sub_topic!==spec.sub_topic))return false
  if(spec.difficulty==='Mains_Level')return item.mains_level===true
  return !spec.difficulty||item.difficulty===spec.difficulty
}
function finalizeGroups(groups,spec,reserved){
  return [...groups.values()].filter(unit=>unit.items.length===unit.total&&unit.items.every(item=>eligible(item,spec))&&!unit.items.some(item=>reserved.has(sourceKey(item))))
}

export async function dynamicCandidates(client,spec,modules,availability,reserved){
  if(spec.category==='PYQ_Topic')return pyqTopicCandidates(client,spec,modules,availability,reserved)
  const groups=new Map(),labels=await labelsFor(client),subjects=[...new Set(modules.map(m=>m.subject))]
  const {rows:bankRaw}=await client.query(`SELECT q.id,q.exam_stage,q.subject,q.topic,q.sub_topic,q.difficulty,q.passage_set_id,ps.set_type,ps.status AS set_status,
    CASE WHEN q.passage_set_id IS NULL THEN 1 ELSE (SELECT COUNT(*)::int FROM cgl_questions child WHERE child.passage_set_id=q.passage_set_id) END AS child_count
    FROM cgl_questions q LEFT JOIN cgl_question_sets ps ON ps.id=q.passage_set_id
    WHERE q.status='Published' AND q.exam_stage IN ($1,'Both') AND q.subject=ANY($2::text[]) ORDER BY q.id LIMIT $3`,[spec.stage,subjects,MAX_SOURCE_ROWS+1])
  for(const row of checked(bankRaw)){
    if(row.passage_set_id&&row.set_status!=='Published')continue
    const source_kind='Bank',source_id=String(row.id),source_part=0,label=labels.get(keyOf(source_kind,source_id)),groupKey=row.passage_set_id?`Bank:set:${row.passage_set_id}`:`Bank:q:${source_id}`
    const item={source_kind,source_id,source_part,group_key:row.passage_set_id?groupKey:null,subject:row.subject,topic:row.topic,sub_topic:row.sub_topic,
      difficulty:row.difficulty,mains_level:row.exam_stage==='Tier_2'||label?.mains_level===true,set_type:row.set_type??null,label_snapshot:label??null}
    const unit=groups.get(groupKey)||{key:groupKey,total:row.child_count,module_code:moduleFor(modules,row.subject),items:[]}
    unit.items.push(item);groups.set(groupKey,unit)
  }
  if(availability.pyq.ok){
    const {rows:batches}=await client.query(`SELECT b.id,b.exam_stage,b.subject,b.topic,b.sub_topic,b.content FROM cgl_ai_batches b
      JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id
      WHERE b.status='Published' AND p.status='Published' AND p.allow_derivatives AND b.exam_stage=$1 AND b.subject=ANY($2::text[])
      ORDER BY b.id LIMIT $3`,[spec.stage,subjects,MAX_SOURCE_ROWS+1])
    for(const batch of checked(batches)){
      if(!Array.isArray(batch.content?.questions)||!Array.isArray(batch.content?.passages))continue
      for(const [index,q] of batch.content.questions.entries()){
        const part=index+1,source_kind='AI',source_id=String(batch.id),label=labels.get(keyOf(source_kind,source_id,part)),ref=q.passage_ref??null
        if(ref&&!batch.content.passages.some(p=>p.ref===ref))continue
        const groupKey=ref?`AI:set:${source_id}:${ref}`:`AI:q:${source_id}:${part}`
        const item={source_kind,source_id,source_part:part,group_key:ref?groupKey:null,subject:batch.subject,topic:batch.topic,sub_topic:batch.sub_topic,
          difficulty:label?.difficulty??null,mains_level:batch.exam_stage==='Tier_2',set_type:ref?'Reading_Comprehension':null,label_snapshot:label??null}
        const count=ref?batch.content.questions.filter(question=>question.passage_ref===ref).length:1
        const unit=groups.get(groupKey)||{key:groupKey,total:count,module_code:moduleFor(modules,batch.subject),items:[]}
        unit.items.push(item);groups.set(groupKey,unit)
      }
    }
  }
  if(availability.ca.ok&&subjects.includes('General_Awareness')){
    const {rows:cas}=await client.query(`SELECT q.id,e.event_date FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id
      WHERE q.status='Published' AND e.status='Published' AND e.event_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date ORDER BY q.id LIMIT $1`,[MAX_SOURCE_ROWS+1])
    for(const row of checked(cas)){
      const source_kind='CA',source_id=String(row.id),label=labels.get(keyOf(source_kind,source_id)),groupKey=`CA:q:${source_id}`
      const item={source_kind,source_id,source_part:0,group_key:null,subject:'General_Awareness',topic:'Current Events',sub_topic:'Current events',difficulty:label?.difficulty??null,
        mains_level:label?.mains_level===true,set_type:null,label_snapshot:label??null}
      groups.set(groupKey,{key:groupKey,total:1,module_code:moduleFor(modules,item.subject),items:[item]})
    }
  }
  return finalizeGroups(groups,spec,reserved)
}
async function pyqTopicCandidates(client,spec,modules,availability,reserved){
  if(!availability.pyq.ok)throw new MasterSelectionError(availability.pyq.code,'The PYQ vault migration is required')
  const {rows:raw}=await client.query(`SELECT q.id,q.paper_id,q.passage_ref,q.subject,q.chapter,q.sub_chapter,q.position,
    s.correct_marks,s.wrong_deduction,
    CASE WHEN q.passage_ref IS NULL THEN 1 ELSE (SELECT COUNT(*)::int FROM cgl_pyq_questions child WHERE child.paper_id=q.paper_id AND child.passage_ref=q.passage_ref) END AS child_count
    FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id JOIN cgl_pyq_sections s ON (s.paper_id,s.section_code)=(q.paper_id,q.section_code)
    WHERE p.status='Published' AND p.allow_derivatives AND q.subject=$1 AND q.chapter=$2 AND ($3::text IS NULL OR q.sub_chapter=$3)
    AND ($4::text IS NULL OR p.exam_stage=$4) AND ($5::int IS NULL OR p.cycle_year=$5) ORDER BY p.cycle_year,q.paper_id,q.position LIMIT $6`,
    [spec.subject,spec.chapter,spec.sub_chapter,spec.stage,spec.cycle_year,MAX_SOURCE_ROWS+1])
  const groups=new Map()
  for(const row of checked(raw)){
    const groupKey=row.passage_ref?`PYQ:set:${row.paper_id}:${row.passage_ref}`:`PYQ:q:${row.id}`
    const item={source_kind:'PYQ',source_id:String(row.id),source_part:0,group_key:row.passage_ref?groupKey:null,subject:row.subject,topic:row.chapter,sub_topic:row.sub_chapter,difficulty:null,
      set_type:row.passage_ref?'Historical_Passage':null,correct_marks:Number(row.correct_marks),wrong_deduction:Number(row.wrong_deduction),counts_for_merit:false}
    const unit=groups.get(groupKey)||{key:groupKey,total:row.child_count,module_code:modules[0].code,items:[]};unit.items.push(item);groups.set(groupKey,unit)
  }
  return finalizeGroups(groups,spec,reserved)
}

export async function fixedSource(client,spec,availability){
  if(spec.category==='PYQ_Shift'){
    if(!availability.pyq.ok)throw new MasterSelectionError(availability.pyq.code,'The PYQ vault migration is required')
    const {rows:[paper]}=await client.query(`SELECT id,title,exam_stage,cycle_year,paper_code,to_char(exam_date,'YYYY-MM-DD') AS exam_date,shift_label,duration_seconds,expected_questions
      FROM cgl_pyq_papers WHERE id=$1 AND status='Published'`,[spec.paper_id])
    if(!paper)throw new MasterSelectionError('CONTENT_PENDING','The requested reviewed PYQ paper is not available')
    const {rows}=await client.query(`SELECT q.id,q.subject,q.chapter,q.sub_chapter,q.position,q.passage_ref,s.correct_marks,s.wrong_deduction
      FROM cgl_pyq_questions q JOIN cgl_pyq_sections s ON (s.paper_id,s.section_code)=(q.paper_id,q.section_code)
      WHERE q.paper_id=$1 ORDER BY q.position`,[paper.id])
    if(rows.length!==paper.expected_questions)throw new MasterSelectionError('CONTENT_PENDING','The PYQ paper is not complete')
    const module={code:'PYQ_Shift',section:'Historical_Paper',subject:'Historical_Paper',question_count:rows.length,duration_seconds:paper.duration_seconds,
      correct_marks:null,wrong_deduction:null,counts_for_merit:false,qualifying_only:false}
    const items=rows.map(row=>({source_kind:'PYQ',source_id:String(row.id),source_part:0,group_key:row.passage_ref?`PYQ:set:${paper.id}:${row.passage_ref}`:null,
      subject:row.subject,topic:row.chapter,sub_topic:row.sub_chapter,difficulty:null,correct_marks:Number(row.correct_marks),wrong_deduction:Number(row.wrong_deduction),counts_for_merit:false,module_code:module.code}))
    return {title:paper.title,stage:paper.exam_stage,modules:[module],items,source:{type:'PYQ',...paper},fixed:true}
  }
  if(!availability.ca.ok)throw new MasterSelectionError(availability.ca.code,'The current-affairs migration is required')
  const kind=spec.ca_category?'Category':spec.category==='CA_Monthly'?'Monthly':'Annual',month=spec.category==='CA_Monthly'?spec.month:null
  const {rows:[mock]}=await client.query(`SELECT m.id,m.title,m.exam_stage,m.target_count,m.correct_marks,m.wrong_deduction,m.year,m.month,
    to_char(m.period_start,'YYYY-MM-DD') AS period_start,to_char(m.period_end,'YYYY-MM-DD') AS period_end
    FROM cgl_ca_mocks m WHERE m.status='Published' AND m.kind=$1 AND m.exam_stage=$2 AND m.year=$3 AND m.month IS NOT DISTINCT FROM $4::int
      AND m.category IS NOT DISTINCT FROM $5::text AND m.award_group IS NULL
      AND NOT EXISTS (SELECT 1 FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id JOIN cgl_ca_events e ON e.id=i.event_id
        WHERE i.mock_id=m.id AND (q.status<>'Published' OR e.status<>'Published')) ORDER BY m.period_end DESC,m.id DESC LIMIT 1`,[kind,spec.stage,spec.year,month,spec.ca_category??null])
  if(!mock)throw new MasterSelectionError('CONTENT_PENDING','The reviewed current-affairs mock is not available for this completed period')
  const {rows}=await client.query(`SELECT q.id,e.category FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id
    JOIN cgl_ca_events e ON e.id=i.event_id WHERE i.mock_id=$1 AND q.status='Published' AND e.status='Published' ORDER BY i.position`,[mock.id])
  if(rows.length!==mock.target_count)throw new MasterSelectionError('CONTENT_PENDING','The reviewed current-affairs mock is incomplete')
  const module={code:'Current_Affairs',section:'Practice',subject:'General_Awareness',question_count:rows.length,duration_seconds:null,
    correct_marks:Number(mock.correct_marks),wrong_deduction:Number(mock.wrong_deduction),counts_for_merit:false,qualifying_only:false}
  const items=rows.map(row=>({source_kind:'CA',source_id:String(row.id),source_part:0,group_key:null,subject:'General_Awareness',topic:'Current Events',sub_topic:'Current events',difficulty:null,
    correct_marks:module.correct_marks,wrong_deduction:module.wrong_deduction,counts_for_merit:false,module_code:module.code}))
  return {title:mock.title,stage:mock.exam_stage,modules:[module],items,source:{type:'CA',id:mock.id,year:mock.year,month:mock.month,period_start:mock.period_start,period_end:mock.period_end},fixed:true}
}

export async function validateSyllabus(client,spec){
  if(spec.category!=='Micro'||!spec.topic)return
  const {rows:[row]}=await client.query(`SELECT 1 AS ok FROM cgl_syllabus WHERE subject=$1 AND topic=$2 AND exam_stage IN ($3,'Both')
    AND ($4::text IS NULL OR sub_topic=$4) LIMIT 1`,[spec.subject,spec.topic,spec.stage,spec.sub_topic])
  if(!row)throw new ContentError('The selected topic/sub-topic is not in the stage syllabus; use canonical syllabus names')
}
