import {ContentError,integer,onlyKeys} from './content-utils.js'
import {createHash} from 'node:crypto'
import {validId} from './ca-dates.js'
import {masterStatus} from './master-migration.js'
import {normalizeMasterSpec,modulesForSpec,titleForSpec,TIER1_EDITORIAL_VERSION,TIER1_EDITORIAL_TOPICS,TIER1_EDITORIAL_SETS,TIER1_DIFFICULTY} from './master-formats.js'
import {selectMasterUnits,sourceKey,MasterSelectionError} from './master-solver.js'
import {sourceAvailability,learnerSeen,learnerReservations,dynamicCandidates,fixedSource,validateSyllabus} from './master-sources.js'
import {loadMasterContent} from './master-content.js'
import {lockLearnerContent} from './learner-content-lock.js'
import {redactPublicQuestion} from './public-question.js'
import {analyzeMasterAttempt,simulateTier1Normalization} from './cgl-analytics.js'

const fixedCategories=new Set(['PYQ_Shift','CA_Monthly','CA_Annual'])
const round=n=>Math.round((n+Number.EPSILON)*100)/100
const validUser=value=>{const n=Number(value);if(!Number.isInteger(n)||n<1||n>2147483647)throw new ContentError('Invalid backend account');return n}
const userLock=lockLearnerContent
const availabilityError=code=>new MasterSelectionError(code,'The required master schema or source is not ready')
const transaction=async(client,fn)=>{await client.query('BEGIN');try{const result=await fn();await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}}

async function checkBankSets(client,items){
  const groups=new Map()
  for(const item of items)if(item.source_kind==='Bank'&&item.group_key){const id=item.group_key.match(/^Bank:set:(\d+)$/)?.[1];if(id)groups.set(id,(groups.get(id)||0)+1)}
  if(!groups.size)return
  const {rows}=await client.query('SELECT passage_set_id,COUNT(*)::int AS n FROM cgl_questions WHERE passage_set_id=ANY($1::bigint[]) GROUP BY passage_set_id',[[...groups.keys()]])
  for(const row of rows)if(groups.get(String(row.passage_set_id))!==row.n)throw new MasterSelectionError('CONTENT_CHANGED','A passage set changed during assembly; retry')
  if(rows.length!==groups.size)throw new MasterSelectionError('CONTENT_CHANGED','A passage set is no longer available')
}
function enrichItems(units,modules){
  return units.flatMap(unit=>unit.items.map(item=>{
    const m=modules.find(row=>row.code===unit.module_code)
    return {...item,module_code:unit.module_code,correct_marks:item.correct_marks??m.correct_marks,wrong_deduction:item.wrong_deduction??m.wrong_deduction,
      counts_for_merit:item.counts_for_merit??m.counts_for_merit}
  }))
}
export async function prepareMasterMock(client,userId,raw){
  userId=validUser(userId);const spec=normalizeMasterSpec(raw)
  return transaction(client,async()=>{
    await userLock(client,userId)
    const schema=await masterStatus(client.query.bind(client));if(!schema.ok)throw availabilityError(schema.code)
    await validateSyllabus(client,spec)
    const availability=await sourceAvailability(client.query.bind(client)),seen=await learnerSeen(client,userId,availability),reserved=await learnerReservations(client,userId)
    let modules,items,title,stage,selection
    if(fixedCategories.has(spec.category)){
      const fixed=await fixedSource(client,spec,availability)
      ;({modules,items,title,stage}=fixed)
      if(spec.timing_profile==='exam_hall_v1'&&['CA_Monthly','CA_Annual'].includes(spec.category)){
        const seconds=(spec.ca_category?15:spec.category==='CA_Monthly'?30:60)*60
        modules=modules.map(m=>({...m,duration_seconds:seconds}))
      }
      const repeated=items.filter(item=>seen.has(sourceKey(item))).length,reservedOverlap=items.filter(item=>reserved.has(sourceKey(item))).length
      selection={fixed_source:true,source:fixed.source,reused_questions:repeated,unseen_questions:items.length-repeated,reserved_overlap:reservedOverlap,
        repeat_reason:repeated?'The fixed reviewed source is preserved in full; seen questions are not substituted':null}
    }else{
      modules=modulesForSpec(spec);title=titleForSpec(spec);stage=spec.stage??null
      const units=await dynamicCandidates(client,spec,modules,availability,reserved)
      const chosen=await selectMasterUnits(units,spec,modules,seen)
      items=enrichItems(chosen.units,modules)
      selection={fixed_source:false,reused_questions:chosen.reused_questions,unseen_questions:chosen.unseen_questions,repeat_reason:chosen.repeat_reason,rule:chosen.rule,
        ...(spec.category==='Full_Tier1'?{editorial_profile_version:TIER1_EDITORIAL_VERSION,editorial_topic_counts:TIER1_EDITORIAL_TOPICS,editorial_set_counts:TIER1_EDITORIAL_SETS,editorial_difficulty_counts:TIER1_DIFFICULTY}:{}),
        note:'A question is unseen until served by this engine or included in an existing recorded backend attempt. Other public reads cannot be associated with a learner.'}
    }
    const target=modules.reduce((n,m)=>n+m.question_count,0)
    if(items.length!==target||new Set(items.map(sourceKey)).size!==items.length)throw new MasterSelectionError('ASSEMBLER_FAILED','The assembled mock has an invalid item count or duplicate identity')
    const contents=await loadMasterContent(client,items,{lock:true,availability,source:selection.source,pyqDerivatives:spec.category==='PYQ_Topic'})
    if(items.some(item=>!contents.get(sourceKey(item))?.available))throw new MasterSelectionError('CONTENT_CHANGED','Source content was withdrawn or changed during assembly; retry')
    if(stage&&items.some(item=>{const qstage=contents.get(sourceKey(item))?.stage;return qstage&&qstage!=='Both'&&qstage!==stage}))throw new MasterSelectionError('CONTENT_CHANGED','Question stage changed during assembly; retry')
    await checkBankSets(client,items)
    // Lock and verify the editorial difficulty labels used by the solver.
    const labeled=items.filter(item=>item.label_snapshot)
    for(const item of labeled){
      const {rows:[current]}=await client.query(`SELECT difficulty,mains_level,reviewer,notes,updated_at FROM cgl_master_question_labels
        WHERE source_kind=$1 AND source_id=$2 AND source_part=$3 FOR SHARE`,[item.source_kind,item.source_id,item.source_part])
      const old=item.label_snapshot
      if(!current||current.difficulty!==old.difficulty||current.mains_level!==old.mains_level||current.reviewer!==old.reviewer||current.notes!==old.notes||
        new Date(current.updated_at).getTime()!==new Date(old.updated_at).getTime())throw new MasterSelectionError('CONTENT_CHANGED','An editorial difficulty label changed during assembly; retry')
    }
    const {rows:[mock]}=await client.query(`INSERT INTO cgl_master_mocks(user_id,category,exam_stage,title,specification,modules,question_count,selection,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+INTERVAL '30 minutes') RETURNING id,created_at,expires_at`,
      [userId,spec.category,stage,title,JSON.stringify(spec),JSON.stringify(modules),target,JSON.stringify(selection)])
    const values=[],placeholders=items.map((item,index)=>{
      const fields=[mock.id,index+1,item.module_code,item.source_kind,item.source_id,item.source_part,item.group_key,item.subject,item.topic??null,item.sub_topic??null,item.difficulty??null,item.label_snapshot?JSON.stringify(item.label_snapshot):null,item.correct_marks,item.wrong_deduction,item.counts_for_merit]
      return `(${fields.map(x=>{values.push(x);return `$${values.length}`}).join(',')})`
    })
    await client.query(`INSERT INTO cgl_master_items(mock_id,position,module_code,source_kind,source_id,source_part,group_key,subject,topic,sub_topic,difficulty,label_snapshot,correct_marks,wrong_deduction,counts_for_merit) VALUES ${placeholders.join(',')}`,values)
    await client.query("UPDATE cgl_master_mocks SET status='Prepared' WHERE id=$1",[mock.id])
    return {mock:{...mock,title,category:spec.category,exam_stage:stage,status:'Prepared',question_count:target,modules,selection,
      duration_seconds:modules.every(m=>m.duration_seconds!==null)?modules.reduce((s,m)=>s+m.duration_seconds,0):null}}
  })
}

// Snapshotted legacy sessions keep their original module locks. The new,
// explicitly non-official practice profile groups modules into navigable periods.
export function timingState(mock,now){
  const currentTime=new Date(now).getTime(),start=new Date(mock.started_at).getTime(),expiry=new Date(mock.expires_at).getTime()
  if(!Number.isFinite(currentTime)||!Number.isFinite(start)||!Number.isFinite(expiry))throw new Error('Invalid test clock')
  const modules=mock.modules,elapsed=Math.max(0,Math.floor((currentTime-start)/1000)),requested=mock.specification?.timing_profile==='exam_hall_v1'
  let groups
  if(requested&&mock.category==='Full_Tier1')groups=[{code:'All_Sections',modules}]
  else if(requested&&mock.category==='Full_Tier2')groups=['Section_I','Section_II','Section_III'].map(code=>({code,modules:modules.filter(m=>m.section===code)}))
  else if(requested&&mock.category==='Sectional_Tier2')groups=[{code:modules[0].section,modules}]
  else groups=modules.map(m=>({code:m.code,modules:[m]}))
  const timestamp=new Date(currentTime).toISOString(),advances=new Map((mock.early_advances||[]).map(a=>[a.section_code,new Date(a.advanced_at).getTime()]))
  let sectionStart=start
  for(const group of groups){
    const duration=group.modules.some(m=>m.duration_seconds===null)?null:group.modules.reduce((n,m)=>n+m.duration_seconds,0)
    const deadline=duration===null?expiry:sectionStart+duration*1000
    const advanced=advances.get(group.code),end=Number.isFinite(advanced)&&advanced>=sectionStart&&advanced<deadline?advanced:deadline
    if(currentTime<end){
      const representative=group.modules.length===1?group.modules[0]:{code:group.code,section:group.code,subject:group.modules.map(m=>m.subject).join(' + '),duration_seconds:duration}
      return {state:'Active',elapsed_seconds:elapsed,current_module:representative,current_section:group.code,current_modules:group.modules.map(m=>m.code),
        deadline:duration===null?null:new Date(deadline).toISOString(),module_remaining_seconds:duration===null?null:Math.max(0,Math.ceil((deadline-currentTime)/1000)),server_now:timestamp,
        can_advance:requested&&mock.category==='Full_Tier2'&&['Section_I','Section_II'].includes(group.code)}
    }
    sectionStart=end
  }
  return {state:'Expired',elapsed_seconds:elapsed,current_module:null,current_section:null,current_modules:[],deadline:null,server_now:timestamp,can_advance:false}
}
async function getOwnedMock(client,userId,id){
  const {rows:[mock]}=await client.query('SELECT *,clock_timestamp() AS current_time FROM cgl_master_mocks WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])
  if(!mock)throw new MasterSelectionError('NOT_FOUND','Master mock not found')
  mock.early_advances=(await client.query('SELECT section_code,advanced_at FROM cgl_master_early_advances WHERE mock_id=$1',[id])).rows
  return mock
}
async function loadItems(client,id){
  const {rows}=await client.query(`SELECT i.*,r.selected_option_index,r.updated_at AS response_updated_at,
    COALESCE(p.visited,FALSE) AS visited,COALESCE(p.marked_for_review,FALSE) AS marked_for_review,
    COALESCE((SELECT SUM(t.elapsed_ms) FROM cgl_master_player_time t WHERE t.mock_id=i.mock_id AND t.position=i.position),0)::bigint AS time_spent_ms
    FROM cgl_master_items i LEFT JOIN cgl_master_responses r ON (r.mock_id,r.position)=(i.mock_id,i.position)
    LEFT JOIN cgl_master_player_progress p ON (p.mock_id,p.position)=(i.mock_id,i.position) WHERE i.mock_id=$1 ORDER BY i.position`,[id])
  return rows
}
function publicItem(item,content){
  return redactPublicQuestion({position:item.position,subject:item.subject,topic:item.topic,sub_topic:item.sub_topic,difficulty:item.difficulty,
    source_kind:item.source_kind,module_code:item.module_code,group_key:item.group_key,visited:item.visited,marked_for_review:item.marked_for_review,time_spent_ms:Number(item.time_spent_ms)||0,time_spent_seconds:(Number(item.time_spent_ms)||0)/1000,previously_seen:item.was_seen_before===true,selected_option_index:item.selected_option_index??null,...content.public})
}
async function dbClock(client){return (await client.query('SELECT clock_timestamp() AS current_time')).rows[0].current_time}
async function deliverModule(client,mock,items,contents,seen,state){
  const active=items.filter(item=>state.current_modules.includes(item.module_code)),fresh=active.filter(item=>!item.delivered_at)
  if(fresh.length){
    const values=[mock.id],rows=fresh.map(item=>{values.push(item.position,seen.has(sourceKey(item)));return `($${values.length-1}::int,$${values.length}::boolean)`})
    await client.query(`UPDATE cgl_master_items i SET delivered_at=clock_timestamp(),was_seen_before=v.was_seen FROM (VALUES ${rows.join(',')}) AS v(position,was_seen)
      WHERE i.mock_id=$1 AND i.position=v.position AND i.delivered_at IS NULL`,values)
    const exposures=[],tuples=fresh.map(item=>{const fields=[mock.user_id,item.source_kind,item.source_id,item.source_part];return `(${fields.map(x=>{exposures.push(x);return `$${exposures.length}`}).join(',')})`})
    await client.query(`INSERT INTO cgl_master_seen(user_id,source_kind,source_id,source_part) VALUES ${tuples.join(',')}
      ON CONFLICT(user_id,source_kind,source_id,source_part) DO UPDATE SET last_seen_at=clock_timestamp(),times_seen=cgl_master_seen.times_seen+1`,exposures)
    for(const item of fresh){item.delivered_at=new Date();item.was_seen_before=seen.has(sourceKey(item))}
  }
  return active.map(item=>publicItem(item,contents.get(sourceKey(item))))
}
async function deliverCurrent(client,mock,items,contents,seen){
  // Recheck the database clock after source/seen queries and after delivery
  // writes. If a section boundary was crossed, roll back its exposure markers
  // and serve only the newly active module.
  for(let attempt=0;attempt<3;attempt++){
    const state=timingState(mock,await dbClock(client))
    if(state.state==='Expired')return {state,questions:[]}
    const before=items.map(i=>[i.delivered_at,i.was_seen_before])
    await client.query('SAVEPOINT master_delivery')
    const questions=await deliverModule(client,mock,items,contents,seen,state)
    const after=timingState(mock,await dbClock(client))
    if(after.state==='Active'&&after.current_section===state.current_section){await client.query('RELEASE SAVEPOINT master_delivery');return {state:after,questions}}
    await client.query('ROLLBACK TO SAVEPOINT master_delivery');await client.query('RELEASE SAVEPOINT master_delivery')
    items.forEach((item,index)=>{[item.delivered_at,item.was_seen_before]=before[index]})
  }
  throw new MasterSelectionError('TIMER_EXPIRED','The timed module changed during delivery; retry')
}
async function activeContent(client,mock,items,availability){
  const contents=await loadMasterContent(client,items,{lock:true,availability,source:mock.selection.source,pyqDerivatives:mock.category==='PYQ_Topic'})
  if(items.some(item=>!contents.get(sourceKey(item))?.available)){
    await client.query("UPDATE cgl_master_mocks SET status='Invalidated' WHERE id=$1",[mock.id])
    return null
  }
  return contents
}
export async function launchMasterMock(client,userId,inputId){
  userId=validUser(userId);const id=validId(inputId)
  return transaction(client,async()=>{
    await userLock(client,userId);const mock=await getOwnedMock(client,userId,id)
    if(mock.status==='Active')return getActiveLocked(client,mock)
    if(mock.status!=='Prepared')throw new MasterSelectionError('INVALID_STATE','Only a prepared mock can be launched')
    if(new Date(mock.current_time)>=new Date(mock.expires_at))throw new MasterSelectionError('PREPARATION_EXPIRED','The prepared mock expired; generate another one')
    const items=await loadItems(client,mock.id),availability=await sourceAvailability(client.query.bind(client))
    const contents=await loadMasterContent(client,items,{lock:true,availability,source:mock.selection.source,pyqDerivatives:mock.category==='PYQ_Topic'})
    if(items.length!==mock.question_count||items.some(item=>!contents.get(sourceKey(item))?.available)){
      await client.query("UPDATE cgl_master_mocks SET status='Invalidated' WHERE id=$1",[mock.id])
      return {invalidated:true,code:'CONTENT_WITHDRAWN',message:'A source was withdrawn; generate another mock'}
    }
    const seen=await learnerSeen(client,userId,availability),reused=items.filter(item=>seen.has(sourceKey(item))).length
    if(!mock.selection.fixed_source){
      const reserved=await learnerReservations(client,userId,mock.id)
      const units=await dynamicCandidates(client,mock.specification,mock.modules,availability,reserved)
      const candidates=new Map(units.flatMap(unit=>unit.items.map(item=>[sourceKey(item),item])))
      const changed=items.some(item=>{const fresh=candidates.get(sourceKey(item));return !fresh||fresh.subject!==item.subject||fresh.topic!==item.topic||fresh.sub_topic!==item.sub_topic||fresh.difficulty!==item.difficulty||fresh.group_key!==item.group_key})
      let best=null
      if(!changed){
        try{best=await selectMasterUnits(units,mock.specification,mock.modules,seen)}
        catch(error){if(error instanceof MasterSelectionError&&error.code==='INSUFFICIENT_REVIEWED_CONTENT')best=null;else throw error}
      }
      const ranks=new Map([...seen.entries()].sort((a,b)=>Number(new Date(a[1]))-Number(new Date(b[1]))||a[0].localeCompare(b[0])).map(([key],index)=>[key,index+1]))
      const cost=list=>list.reduce((n,item)=>n+(ranks.get(sourceKey(item))||0),0)
      if(changed||!best||reused>best.reused_questions||(reused===best.reused_questions&&cost(items)>cost(best.units.flatMap(unit=>unit.items)))){
        await client.query("UPDATE cgl_master_mocks SET status='Invalidated' WHERE id=$1",[mock.id])
        return {invalidated:true,code:'POOL_CHANGED',message:'Available or seen questions changed; generate a fresh mock'}
      }
    }
    const selection={...mock.selection,reused_questions_at_launch:reused,unseen_questions_at_launch:items.length-reused}
    const timed=mock.modules.every(m=>m.duration_seconds!==null),seconds=timed?mock.modules.reduce((n,m)=>n+m.duration_seconds,0):86400
    const {rows:[started]}=await client.query(`UPDATE cgl_master_mocks SET status='Active',started_at=clock_timestamp(),expires_at=clock_timestamp()+($2::int*INTERVAL '1 second'),selection=$3
      WHERE id=$1 RETURNING *,clock_timestamp() AS current_time`,[mock.id,seconds,JSON.stringify(selection)])
    const delivery=await deliverCurrent(client,started,items,contents,seen)
    return {mock:publicMock(started),timer:delivery.state,questions:delivery.questions}
  })
}
async function getActiveLocked(client,mock){
  if(mock.status!=='Active')throw new MasterSelectionError('INVALID_STATE','Mock is not active')
  const items=await loadItems(client,mock.id),availability=await sourceAvailability(client.query.bind(client))
  const contents=await activeContent(client,mock,items,availability)
  if(!contents)return {invalidated:true,code:'CONTENT_WITHDRAWN',message:'A source was withdrawn; this test is unavailable'}
  const seen=await learnerSeen(client,mock.user_id,availability),delivery=await deliverCurrent(client,mock,items,contents,seen)
  return {mock:publicMock(mock),timer:delivery.state,questions:delivery.questions}
}
export async function getActiveMaster(client,userId,inputId){
  userId=validUser(userId);const id=validId(inputId)
  return transaction(client,async()=>{await userLock(client,userId);return getActiveLocked(client,await getOwnedMock(client,userId,id))})
}
function parseResponses(value){
  if(!Array.isArray(value)||value.length>300)throw new ContentError('answers must be an array of at most 300 items')
  const out=new Map()
  for(const item of value){
    onlyKeys(item,['position','selected_option_index','visited','marked_for_review','elapsed_ms','device_id','client_revision'],'answer')
    const pos=integer(item.position,'answer.position',1,300),hasChoice=Object.hasOwn(item,'selected_option_index'),choice=item.selected_option_index
    if(out.has(pos)||(hasChoice&&choice!==null&&(!Number.isInteger(choice)||choice<0||choice>3)))throw new ContentError('Answer positions must be unique and selections must be null or 0–3')
    for(const key of ['visited','marked_for_review'])if(item[key]!==undefined&&typeof item[key]!=='boolean')throw new ContentError(`${key} must be boolean`)
    if(item.elapsed_ms!==undefined){integer(item.elapsed_ms,'elapsed_ms',0,604800000);if(typeof item.device_id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(item.device_id))throw new ContentError('Invalid player device id')}
    else if(item.device_id!==undefined)throw new ContentError('device_id requires elapsed_ms')
    if(item.client_revision!==undefined){integer(item.client_revision,'client_revision',1,2147483647);if(item.elapsed_ms===undefined)throw new ContentError('client_revision requires device time')}
    out.set(pos,{...item,hasChoice})
  }
  return out
}
async function saveResponsesLocked(client,mock,items,answers){
  const state=timingState(mock,await dbClock(client))
  if(answers.size&&state.state!=='Active')throw new MasterSelectionError('TIMER_EXPIRED','The test time has ended; only saved responses can be submitted')
  const byPosition=new Map(items.map(i=>[i.position,i])),ignored=[]
  for(const [position,answer] of answers){
    const item=byPosition.get(position)
    if(!item||!item.delivered_at||!state.current_modules.includes(item.module_code))throw new MasterSelectionError('MODULE_LOCKED','Answers can be saved only for delivered questions in the current timed section')
    const revision=answer.client_revision??null
    const stateHash=revision===null?null:createHash('sha256').update(JSON.stringify([answer.hasChoice,answer.selected_option_index??null,answer.visited??null,answer.marked_for_review??null,answer.elapsed_ms])).digest('hex')
    if(revision!==null){
      const {rows:[prior]}=await client.query('SELECT response_revision,state_hash FROM cgl_master_player_time WHERE mock_id=$1 AND position=$2 AND device_id=$3 FOR UPDATE',[mock.id,position,answer.device_id])
      if(prior&&revision<=Number(prior.response_revision)){
        if(revision<Number(prior.response_revision)||prior.state_hash!==stateHash)ignored.push(position)
        continue // Exact retries are idempotent; older or conflicting writes cannot overwrite newer progress.
      }
    }
    if(answer.hasChoice){
      await client.query(`INSERT INTO cgl_master_responses(mock_id,position,selected_option_index) VALUES($1,$2,$3)
        ON CONFLICT(mock_id,position) DO UPDATE SET selected_option_index=EXCLUDED.selected_option_index,updated_at=clock_timestamp()`,[mock.id,position,answer.selected_option_index])
      item.selected_option_index=answer.selected_option_index
    }
    if(answer.hasChoice||answer.visited!==undefined||answer.marked_for_review!==undefined){
      item.visited=item.visited||answer.visited===true||answer.hasChoice||answer.marked_for_review===true
      item.marked_for_review=answer.marked_for_review===undefined?item.marked_for_review:answer.marked_for_review
      await client.query(`INSERT INTO cgl_master_player_progress(mock_id,position,visited,marked_for_review) VALUES($1,$2,$3,$4)
        ON CONFLICT(mock_id,position) DO UPDATE SET visited=EXCLUDED.visited,marked_for_review=EXCLUDED.marked_for_review,updated_at=clock_timestamp()`,[mock.id,position,item.visited,item.marked_for_review])
    }
    if(answer.elapsed_ms!==undefined){
      await client.query(`INSERT INTO cgl_master_player_time(mock_id,position,device_id,elapsed_ms,response_revision,state_hash) VALUES($1,$2,$3,$4,COALESCE($5::bigint,0),$6)
        ON CONFLICT(mock_id,position,device_id) DO UPDATE SET elapsed_ms=GREATEST(cgl_master_player_time.elapsed_ms,EXCLUDED.elapsed_ms),
          response_revision=CASE WHEN $5::bigint IS NULL THEN cgl_master_player_time.response_revision ELSE EXCLUDED.response_revision END,
          state_hash=CASE WHEN $5::bigint IS NULL THEN cgl_master_player_time.state_hash ELSE EXCLUDED.state_hash END,updated_at=clock_timestamp()`,[mock.id,position,answer.device_id,answer.elapsed_ms,revision,stateHash])
      item.time_spent_ms=(await client.query('SELECT COALESCE(SUM(elapsed_ms),0)::bigint AS total FROM cgl_master_player_time WHERE mock_id=$1 AND position=$2',[mock.id,position])).rows[0].total
    }
  }
  if(answers.size){
    const after=timingState(mock,await dbClock(client))
    if(after.state!=='Active'||after.current_section!==state.current_section)throw new MasterSelectionError('TIMER_EXPIRED','The section ended while responses were being saved; no responses were changed')
    return {state:after,ignored}
  }
  return {state,ignored}
}
export async function saveMasterResponses(client,userId,inputId,raw){
  userId=validUser(userId);const id=validId(inputId);onlyKeys(raw,['answers'],'response request');const answers=parseResponses(raw.answers)
  return transaction(client,async()=>{
    await userLock(client,userId);const mock=await getOwnedMock(client,userId,id)
    if(mock.status!=='Active')throw new MasterSelectionError('INVALID_STATE','Mock is not active')
    const items=await loadItems(client,id),availability=await sourceAvailability(client.query.bind(client))
    if(!await activeContent(client,mock,items,availability))return {invalidated:true,code:'CONTENT_WITHDRAWN',message:'A source was withdrawn; responses were not saved'}
    const result=await saveResponsesLocked(client,mock,items,answers)
    return {saved:answers.size-result.ignored.length,ignored_positions:result.ignored,timer:result.state}
  })
}

export async function advanceMasterSection(client,userId,inputId,raw){
  userId=validUser(userId);const id=validId(inputId);onlyKeys(raw,['section'],'section advance')
  if(!['Section_I','Section_II'].includes(raw.section))throw new ContentError('Invalid section')
  return transaction(client,async()=>{
    await userLock(client,userId);const mock=await getOwnedMock(client,userId,id)
    if(mock.status!=='Active'||mock.category!=='Full_Tier2'||mock.specification?.timing_profile!=='exam_hall_v1')throw new MasterSelectionError('INVALID_STATE','Early section submission is available only in the requested Tier II practice profile')
    const prior=mock.early_advances.some(a=>a.section_code===raw.section)
    const state=timingState(mock,await dbClock(client))
    if(!prior){
      if(state.current_section!==raw.section||!state.can_advance)throw new MasterSelectionError('MODULE_LOCKED','That section is not currently active')
      const {rows:[advance]}=await client.query('INSERT INTO cgl_master_early_advances(mock_id,section_code) VALUES($1,$2) RETURNING section_code,advanced_at',[id,raw.section])
      mock.early_advances.push(advance)
    }
    return getActiveLocked(client,mock)
  })
}

function gradeMaster(mock,items,contents){
  const groups=new Map(),results=[]
  let total=0,maximum=0,correct=0,wrong=0,skipped=0,voidCount=0,merit=0,meritMax=0,computer=0,computerMax=0,hasComputer=false
  for(const item of items){
    const content=contents.get(sourceKey(item)),review=content.review,selected=item.selected_option_index??null
    let isCorrect=null,awarded=0,max=Number(item.correct_marks),isVoid=false
    if(item.source_kind==='PYQ'&&review.answer_status==='Void'){
      isVoid=true;voidCount++;if(review.void_policy==='Excluded')max=0;else awarded=Number(item.correct_marks)
    }else if(selected===null)skipped++
    else {
      isCorrect=item.source_kind==='PYQ'?review.correct_option_indices.includes(selected):selected===review.correct_option_index
      awarded=isCorrect?Number(item.correct_marks):-Number(item.wrong_deduction)
      if(isCorrect)correct++;else wrong++
    }
    total=round(total+awarded);maximum=round(maximum+max)
    if(item.counts_for_merit){merit=round(merit+awarded);meritMax=round(meritMax+max)}
    if(item.subject==='Computer_Knowledge'&&mock.exam_stage==='Tier_2'){
      hasComputer=true;computer=round(computer+awarded);computerMax=round(computerMax+max)
    }
    const group=groups.get(item.module_code)||{module_code:item.module_code,question_count:0,score:0,max_score:0,correct:0,wrong:0,skipped:0,void:0}
    group.question_count++;group.score=round(group.score+awarded);group.max_score=round(group.max_score+max)
    if(isVoid)group.void++;else if(isCorrect===true)group.correct++;else if(isCorrect===false)group.wrong++;else group.skipped++
    groups.set(item.module_code,group)
    results.push({position:item.position,selected_option_index:selected,is_correct:isCorrect,awarded_marks:awarded,maximum_marks:max})
  }
  const meritApplicable=items.some(i=>i.counts_for_merit),screeningApplicable=['Full_Tier1','Sectional_Tier1'].includes(mock.category)
  return {score:total,max_score:maximum,correct,wrong,skipped,void_count:voidCount,modules:[...groups.values()],
    screening_score:screeningApplicable?total:null,screening_max_score:screeningApplicable?maximum:null,
    merit_score:meritApplicable?merit:null,actual_merit_max_score:meritApplicable?meritMax:null,
    computer_score:hasComputer?computer:null,computer_max_score:hasComputer?computerMax:null,computer_qualifying_status:hasComputer?'Pending':'Not_Applicable',
    note:mock.category.startsWith('PYQ_')?'Historical source-section marking; mixed-paper totals are practice only.':'Raw practice marks only; no normalization, cutoff, DEST or official selection result.',results}
}
function reviewRows(items,contents,summary){
  const byPosition=new Map(summary.results.map(row=>[row.position,row]))
  return items.map(item=>{
    const score=byPosition.get(item.position),content=contents.get(sourceKey(item))
    if(!item.delivered_at)return {...score,not_delivered:true}
    if(!content?.available)return {...score,content_withdrawn:true}
    return {...score,subject:item.subject,topic:item.topic,sub_topic:item.sub_topic,difficulty:item.difficulty,source_kind:item.source_kind,group_key:item.group_key,
      visited:item.visited,marked_for_review:item.marked_for_review,time_spent_ms:Number(item.time_spent_ms)||0,time_spent_seconds:(Number(item.time_spent_ms)||0)/1000,...content.public,...content.review}
  })
}
export function publicMock(mock){
  return {id:String(mock.id),category:mock.category,exam_stage:mock.exam_stage,title:mock.title,status:mock.status,question_count:mock.question_count,
    specification:mock.specification,modules:mock.modules,selection:mock.selection,created_at:mock.created_at,expires_at:mock.expires_at,
    started_at:mock.started_at,submitted_at:mock.submitted_at,...(mock.status==='Submitted'?{summary:{...mock.summary,results:undefined}}:{})}
}
export async function submitMasterMock(client,userId,inputId,raw={}){
  userId=validUser(userId);const id=validId(inputId);onlyKeys(raw,['answers'],'submission');const answers=parseResponses(raw.answers??[])
  return transaction(client,async()=>{
    await userLock(client,userId);const mock=await getOwnedMock(client,userId,id)
    if(mock.status==='Submitted')throw new MasterSelectionError('INVALID_STATE','This mock has already been submitted')
    if(mock.status!=='Active')throw new MasterSelectionError('INVALID_STATE','Only an active mock can be submitted')
    const submitState=timingState(mock,await dbClock(client))
    if(mock.category==='Full_Tier2'&&mock.specification?.timing_profile==='exam_hall_v1'&&submitState.state==='Active'&&submitState.current_section!=='Section_III')throw new MasterSelectionError('SECTION_LOCKED','Complete or submit Sections I and II before final submission')
    const items=await loadItems(client,id),availability=await sourceAvailability(client.query.bind(client))
    const contents=await activeContent(client,mock,items,availability)
    if(!contents)return {invalidated:true,code:'CONTENT_WITHDRAWN',message:'A source was withdrawn; the test cannot be graded'}
    const saved=await saveResponsesLocked(client,mock,items,answers)
    if(saved.ignored.length)throw new MasterSelectionError('STALE_PROGRESS','A newer device update exists; reload before submission')
    const summary=gradeMaster(mock,items,contents)
    const {rows:[submitted]}=await client.query("UPDATE cgl_master_mocks SET status='Submitted',submitted_at=clock_timestamp(),summary=$2 WHERE id=$1 RETURNING *",[id,JSON.stringify(summary)])
    const results=reviewRows(items,contents,summary)
    return {mock:publicMock(submitted),summary:{...summary,results:undefined},results,analytics:analyzeMasterAttempt(submitted,summary,results,items)}
  })
}
export async function reviewMasterMock(client,userId,inputId){
  userId=validUser(userId);const id=validId(inputId)
  return transaction(client,async()=>{
    await userLock(client,userId);const mock=await getOwnedMock(client,userId,id)
    if(mock.status!=='Submitted')throw new MasterSelectionError('INVALID_STATE','Review is available only after submission')
    const items=await loadItems(client,id),availability=await sourceAvailability(client.query.bind(client))
    const contents=await loadMasterContent(client,items,{lock:true,availability,source:mock.selection.source,pyqDerivatives:mock.category==='PYQ_Topic'})
    const results=reviewRows(items,contents,mock.summary)
    return {mock:publicMock(mock),summary:{...mock.summary,results:undefined},results,analytics:analyzeMasterAttempt(mock,mock.summary,results,items)}
  })
}
export async function simulateMasterTier1(client,userId,inputId,body){
  const review=await reviewMasterMock(client,userId,inputId)
  if(!review.analytics.screening?.delivered||!review.analytics.screening?.content_available)throw new MasterSelectionError('INVALID_STATE','Simulation requires a fully delivered Tier I full mock with available reviewed content')
  return {simulation:simulateTier1Normalization(review.analytics.screening.score,body)}
}
export async function cancelMasterMock(client,userId,inputId){
  userId=validUser(userId);const id=validId(inputId)
  return transaction(client,async()=>{
    await userLock(client,userId);const mock=await getOwnedMock(client,userId,id)
    if(!['Prepared','Active'].includes(mock.status))throw new MasterSelectionError('INVALID_STATE','Only prepared or active mocks can be cancelled')
    await client.query("UPDATE cgl_master_mocks SET status='Cancelled' WHERE id=$1",[id])
    return {id,status:'Cancelled',note:'Delivered questions remain seen; unused reservations were released.'}
  })
}
export async function listMasterMocks(query,userId,{limit=50,offset=0,stage=null,status=null}={}){
  userId=validUser(userId);integer(limit,'limit',1,100);integer(offset,'offset',0,1000000)
  if(stage!==null&&!['Tier_1','Tier_2'].includes(stage))throw new ContentError('Invalid stage')
  if(status!==null&&!['Prepared','Active','Submitted','Cancelled','Invalidated'].includes(status))throw new ContentError('Invalid status')
  const {rows}=await query(`SELECT id,category,exam_stage,title,status,question_count,modules,selection,specification,created_at,expires_at,started_at,submitted_at,summary
    FROM cgl_master_mocks WHERE user_id=$1 AND status<>'Building' AND ($4::text IS NULL OR exam_stage=$4) AND ($5::text IS NULL OR status=$5) ORDER BY CASE WHEN $5::text='Submitted' THEN submitted_at ELSE created_at END DESC,id DESC LIMIT $2 OFFSET $3`,[userId,limit+1,offset,stage,status])
  return {mocks:rows.slice(0,limit).map(publicMock),pagination:{limit,offset,has_more:rows.length>limit,next_offset:rows.length>limit?offset+limit:null}}
}
export async function readMasterMock(query,userId,inputId){
  userId=validUser(userId);const id=validId(inputId)
  const {rows:[mock]}=await query("SELECT * FROM cgl_master_mocks WHERE id=$1 AND user_id=$2 AND status<>'Building'",[id,userId])
  if(!mock)throw new MasterSelectionError('NOT_FOUND','Master mock not found')
  return {mock:publicMock(mock)}
}
