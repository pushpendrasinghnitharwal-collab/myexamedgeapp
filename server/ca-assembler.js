import { ContentError,integer,onlyKeys,text } from './content-utils.js'
import { CA_CATEGORIES,CA_CATEGORY_CODES,AWARD_GROUPS,CA_EDITORIAL_WEIGHT_VERSION } from './data/ssc-cgl-ca-categories.js'
import { indiaToday,isoDate,monthBounds,weekBounds,yearBounds,validId } from './ca-dates.js'
import { assertCaSchema } from './ca-migration.js'

const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December']
const kinds=['Monthly','Weekly','Annual','Category']
const weightByCategory=Object.fromEntries(CA_CATEGORIES.map(c=>[c.code,c.editorial_weight]))

// Monthly/weekly/annual publications wait until their periods have ended in IST.
// Category drills may be "to date" snapshots and never include future events.
export function normalizeCaSpec(input,{today=indiaToday()}={}) {
  isoDate(today,'today');onlyKeys(input,['kind','exam_stage','year','month','week','category','award_group'],'CA mock specification')
  const {kind,exam_stage}=input
  if(!kinds.includes(kind))throw new ContentError('Invalid CA mock kind')
  if(!['Tier_1','Tier_2'].includes(exam_stage))throw new ContentError('Invalid CA exam stage')
  const year=integer(input.year,'year',2025,2026)
  let month=input.month??null,week=input.week??null,category=input.category??null,awardGroup=input.award_group??null
  if(month!==null)month=integer(month,'month',1,12)
  if(kind==='Monthly'&&(month===null||week!==null||category!==null||awardGroup!==null))throw new ContentError('Monthly requires only a year and month')
  if(kind==='Weekly'&&(month===null||week===null||category!==null||awardGroup!==null))throw new ContentError('Weekly requires a year, month and week')
  if(kind==='Annual'&&(month!==null||week!==null||category!==null||awardGroup!==null))throw new ContentError('Annual requires only a year')
  if(kind==='Category'&&(week!==null||!CA_CATEGORY_CODES.includes(category)))throw new ContentError('Category drill requires a supported category and optional month')
  if(awardGroup!==null&&(kind!=='Category'||category!=='Awards'||!AWARD_GROUPS.includes(awardGroup)))throw new ContentError('award_group applies to Awards category drills only')
  let bounds=kind==='Annual'||(kind==='Category'&&month===null)?yearBounds(year):kind==='Weekly'?weekBounds(year,month,week):monthBounds(year,month)
  if(bounds.start>today)return {ready:false,reason:'Upcoming',year,month,week,category,award_group:awardGroup,kind,exam_stage,period_start:bounds.start,period_end:bounds.end}
  if(kind!=='Category'&&bounds.end>=today)return {ready:false,reason:'In_Progress',year,month,week,category,award_group:awardGroup,kind,exam_stage,period_start:bounds.start,period_end:bounds.end}
  const end=kind==='Category'&&bounds.end>today?today:bounds.end
  const target=kind==='Monthly'?50:kind==='Annual'?100:20
  const cat=CA_CATEGORIES.find(c=>c.code===category)?.label
  let title
  if(kind==='Monthly')title=`${monthNames[month-1]} ${year} Current Affairs Mock`
  if(kind==='Weekly')title=`${monthNames[month-1]} ${year} Current Affairs Week ${week} Drill`
  if(kind==='Annual')title=`Best of ${year} Full Year CA Mock`
  if(kind==='Category')title=`${year}${month?` ${monthNames[month-1]}`:''} ${awardGroup||cat} Current Affairs Drill${end===today?' (to date)':''}`
  const key=[kind,exam_stage,year,month??'-',week??'-',category??'-',awardGroup??'-',kind==='Category'?end:'complete'].join(':')
  return {ready:true,key,kind,exam_stage,year,month,week,category,award_group:awardGroup,period_start:bounds.start,period_end:end,as_of_date:today,title,target_count:target,
    correct_marks:exam_stage==='Tier_1'?2:3,wrong_deduction:exam_stage==='Tier_1'?0.5:1,partial_window:!!bounds.partial_window}
}
function idCmp(a,b){const x=BigInt(a),y=BigInt(b);return x<y?-1:x>y?1:0}
function monthOf(row){return Number(row.event_date.slice(5,7))}

// One event per mock. Category weights and per-event priority are editorial
// heuristics, not empirical TCS frequencies. Annual tests must span all months.
export function selectCaQuestions(candidates,spec) {
  const remaining=[...candidates],events=new Set()
  for(const row of remaining){const key=String(row.event_id);if(events.has(key))throw new ContentError('Multiple active questions for one event');events.add(key)}
  if(remaining.length<spec.target_count)return {ok:false,reason:'Insufficient_Reviewed_Content',available:remaining.length,required:spec.target_count,missing:spec.target_count-remaining.length}
  const monthSet=new Set(remaining.map(monthOf))
  if(spec.kind==='Annual'&&monthSet.size!==12){const missing=Array.from({length:12},(_,i)=>i+1).filter(m=>!monthSet.has(m));return {ok:false,reason:'Annual_Month_Coverage_Missing',missing_months:missing,available:remaining.length,required:spec.target_count}}
  const selected=[],counts=Object.fromEntries(CA_CATEGORY_CODES.map(c=>[c,0])),months=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,0]))
  const totalWeight=CA_CATEGORIES.reduce((s,c)=>s+c.editorial_weight,0)
  function choose(pool){
    return pool.sort((a,b)=>{
      const ca=weightByCategory[a.category],cb=weightByCategory[b.category]
      const da=((selected.length+1)*ca/totalWeight)-counts[a.category],db=((selected.length+1)*cb/totalWeight)-counts[b.category]
      if(da!==db)return db-da
      if(spec.kind==='Annual'&&months[monthOf(a)]!==months[monthOf(b)])return months[monthOf(a)]-months[monthOf(b)]
      if(a.editorial_priority!==b.editorial_priority)return b.editorial_priority-a.editorial_priority
      return a.event_date.localeCompare(b.event_date)||idCmp(a.question_id,b.question_id)
    })[0]
  }
  function take(row){selected.push(row);counts[row.category]++;months[monthOf(row)]++;remaining.splice(remaining.indexOf(row),1)}
  if(spec.kind==='Annual')for(let m=1;m<=12;m++)take(choose(remaining.filter(r=>monthOf(r)===m)))
  while(selected.length<spec.target_count)take(choose(remaining))
  return {ok:true,selected,selection_policy:{weight_version:CA_EDITORIAL_WEIGHT_VERSION,category_weights:weightByCategory,
    basis:'Editorial practice heuristic; not measured or official SSC/TCS topic frequencies.',one_question_per_event:true,
    per_event_priority:'1–5, assigned by the reviewer',category_counts:counts,month_counts:months}}
}
export async function assembleCaMock(client,input,{today=indiaToday()}={}) {
  const spec=normalizeCaSpec(input,{today})
  await assertCaSchema(client)
  if(!spec.ready)return {created:false,...spec}
  await client.query('BEGIN')
  try{
    await client.query('SELECT pg_advisory_xact_lock($1,hashtext($2))',[729007,spec.key]);await assertCaSchema(client)
    const {rows:[existing]}=await client.query("SELECT id,status FROM cgl_ca_mocks WHERE active_key=$1 AND status IN ('Draft','Published')",[spec.key])
    if(existing){await client.query('COMMIT');return {created:false,reason:'Already_Exists',mock_id:existing.id,status:existing.status,...spec}}
    const {rows:candidates}=await client.query(`SELECT q.id AS question_id,e.id AS event_id,to_char(e.event_date,'YYYY-MM-DD') AS event_date,e.category,e.award_group,e.editorial_priority
      FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id WHERE q.status='Published' AND e.status='Published'
      AND e.event_date BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR e.category=$3) AND ($4::text IS NULL OR e.award_group=$4)`,
      [spec.period_start,spec.period_end,spec.category,spec.award_group])
    const result=selectCaQuestions(candidates,spec)
    if(!result.ok){await client.query('COMMIT');return {created:false,...spec,...result}}
    const {rows:[mock]}=await client.query(`INSERT INTO cgl_ca_mocks(active_key,kind,exam_stage,year,month,week,category,award_group,period_start,period_end,as_of_date,title,target_count,correct_marks,wrong_deduction,selection_policy)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id,status`,
      [spec.key,spec.kind,spec.exam_stage,spec.year,spec.month,spec.week,spec.category,spec.award_group,spec.period_start,spec.period_end,spec.as_of_date,spec.title,spec.target_count,spec.correct_marks,spec.wrong_deduction,JSON.stringify(result.selection_policy)])
    for(let i=0;i<result.selected.length;i++){const item=result.selected[i];await client.query('INSERT INTO cgl_ca_mock_items(mock_id,question_id,event_id,position) VALUES($1,$2,$3,$4)',[mock.id,item.question_id,item.event_id,i+1])}
    await client.query('COMMIT');return {created:true,mock_id:mock.id,status:mock.status,...spec,selection_policy:result.selection_policy}
  }catch(error){await client.query('ROLLBACK');throw error}
}
export async function publishCaMock(client,{mockId,reviewer,notes}) {
  const id=validId(mockId);reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'review notes',{min:10,max:2000})
  await client.query('BEGIN')
  try{
    await assertCaSchema(client)
    const {rows:[mock]}=await client.query('SELECT id,status FROM cgl_ca_mocks WHERE id=$1 FOR UPDATE',[id])
    if(!mock)throw new ContentError('CA mock not found')
    if(mock.status==='Published'){await client.query('COMMIT');return {published:false,mock_id:id,status:'Published'}}
    if(['Withdrawn','Rejected'].includes(mock.status))throw new ContentError('Withdrawn or rejected CA mocks cannot be republished')
    await client.query("UPDATE cgl_ca_mocks SET status='Published',reviewed_by=$2,review_notes=$3,reviewed_at=NOW() WHERE id=$1",[id,reviewer,notes])
    await client.query('COMMIT');return {published:true,mock_id:id,status:'Published'}
  }catch(error){await client.query('ROLLBACK');throw error}
}
export function allCaSpecs(exam_stage) {
  if(!['Tier_1','Tier_2'].includes(exam_stage))throw new ContentError('Invalid CA exam stage')
  const out=[]
  for(const year of [2025,2026]){
    out.push({kind:'Annual',exam_stage,year})
    for(const category of CA_CATEGORY_CODES){
      out.push({kind:'Category',exam_stage,year,category})
      if(category==='Awards')for(const award_group of AWARD_GROUPS)out.push({kind:'Category',exam_stage,year,category,award_group})
    }
    for(let month=1;month<=12;month++){
      out.push({kind:'Monthly',exam_stage,year,month})
      const {days}=monthBounds(year,month)
      for(let week=1;week<=Math.ceil(days/7);week++)out.push({kind:'Weekly',exam_stage,year,month,week})
      for(const category of CA_CATEGORY_CODES){
        out.push({kind:'Category',exam_stage,year,month,category})
        if(category==='Awards')for(const award_group of AWARD_GROUPS)out.push({kind:'Category',exam_stage,year,month,category,award_group})
      }
    }
  }
  return out
}
