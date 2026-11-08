import {ContentError, onlyKeys} from './content-utils.js'
import {NOTICE_URL, MINIMUMS} from './data/ssc-cgl-official-blueprints.js'

export const NORMALIZATION_NOTICE_URL='https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Normalization_procedure_for_SSC_exams_from_June_2025.pdf'
const categories=['UR','OBC_EWS','Others']
const round=(n,places=2)=>Math.round((n+Number.EPSILON)*10**places)/10**places
const numeric=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null
const sum=(rows,key)=>round(rows.reduce((total,row)=>total+(numeric(row[key])??0),0))
const minimums=maximum=>Object.fromEntries(categories.map(category=>[category,round(maximum*MINIMUMS[category]/100)]))
const assessments=(score,maximum,delivered)=>Object.fromEntries(categories.map(category=>[category,{
  minimum_marks:minimums(maximum)[category],status:delivered?(score>=minimums(maximum)[category]?'Qualified':'Not_Qualified'):'Not_Assessed',
}]))

// An owner-only view derived from the immutable score snapshot and the actually
// delivered questions. It does not rewrite existing attempts or infer cutoffs.
export function analyzeMasterAttempt(mock,summary,results,items){
  const metadata=new Map((mock.modules||[]).map(module=>[module.code,module]))
  const scored=(summary.modules||[]).map(module=>({...module,...metadata.get(module.module_code)}))
  const grouped=new Map()
  for(const module of scored){
    if(!module.subject)continue
    const group=grouped.get(module.subject)||{subject:module.subject,score:0,max_score:0,correct:0,wrong:0,skipped:0}
    for(const key of ['score','max_score','correct','wrong','skipped'])group[key]=round(group[key]+(numeric(module[key])??0))
    grouped.set(module.subject,group)
  }
  const subject_scores=[...grouped.values()]
  const reviewed=new Map(results.map(result=>[result.position,result]))
  const section=code=>{
    const modules=scored.filter(row=>row.section===code), relevant=items.filter(item=>metadata.get(item.module_code)?.section===code)
    if(!modules.length)return null
    return {code,score:sum(modules,'score'),max_score:sum(modules,'max_score'),question_count:relevant.length,
      delivered:relevant.length>0&&relevant.every(item=>!!item.delivered_at),
      content_available:relevant.every(item=>reviewed.has(item.position)&&!reviewed.get(item.position).content_withdrawn)}
  }
  const first=section('Section_I'),second=section('Section_II'),third=section('Section_III')
  const fullTier1=mock.category==='Full_Tier1'&&mock.exam_stage==='Tier_1'&&Number(summary.max_score)===200&&items.length===100
  const fullTier2=mock.category==='Full_Tier2'&&mock.exam_stage==='Tier_2'&&Number(summary.actual_merit_max_score)===390&&first?.max_score===180&&second?.max_score===210
  const computerScore=numeric(summary.computer_score),computerMax=numeric(summary.computer_max_score)
  const completeComputer=mock.exam_stage==='Tier_2'&&['Full_Tier2','Sectional_Tier2'].includes(mock.category)&&third?.max_score===60&&third.question_count===20&&computerMax===60&&computerScore!==null
  const by_outcome=Object.fromEntries(['correct','wrong','skipped'].map(key=>[key,{questions:0,tracked_questions:0,total_seconds:null,average_seconds:null}]))
  const accum={correct:0,wrong:0,skipped:0},traps=[]
  let unavailable=0,voidQuestions=0
  for(const result of results){
    if(result.not_delivered||result.content_withdrawn){unavailable++;continue}
    if(result.answer_status==='Void'){voidQuestions++;continue}
    const outcome=result.is_correct===true?'correct':result.is_correct===false?'wrong':result.selected_option_index==null?'skipped':null
    if(!outcome)continue
    const row=by_outcome[outcome];row.questions++
    const milliseconds=numeric(result.time_spent_ms),seconds=milliseconds!==null?milliseconds/1000:numeric(result.time_spent_seconds)
    if(seconds!==null&&seconds>0){
      row.tracked_questions++;accum[outcome]+=seconds
      const ideal=numeric(result.ideal_time_seconds)
      if(ideal!==null&&ideal>0&&seconds>2*ideal)traps.push({position:result.position,subject:result.subject||null,seconds:round(seconds,3),ideal_seconds:ideal,ratio:round(seconds/ideal,2)})
    }
  }
  for(const [key,row] of Object.entries(by_outcome))if(row.tracked_questions){row.total_seconds=round(accum[key],3);row.average_seconds=round(accum[key]/row.tracked_questions,2)}
  traps.sort((a,b)=>b.seconds-a.seconds||a.position-b.position)
  const screening=fullTier1?{score:numeric(summary.screening_score)??numeric(summary.score),max_score:200,minimums:minimums(200),
    delivered:items.every(item=>!!item.delivered_at),content_available:items.every(item=>reviewed.has(item.position)&&!reviewed.get(item.position).content_withdrawn),section_cutoffs_available:false}:null
  const merit=fullTier2?{score:numeric(summary.merit_score),max_score:390,
    section_i:{...first,assessments:assessments(first.score,180,first.delivered&&first.content_available)},
    section_ii:{...second,assessments:assessments(second.score,210,second.delivered&&second.content_available)}}:null
  const computer=computerScore===null?null:{score:computerScore,max_score:computerMax,
    full_module:completeComputer,delivered:completeComputer&&third.delivered,content_available:completeComputer&&third.content_available,
    assessments:completeComputer?assessments(computerScore,60,third.delivered&&third.content_available):null}
  return {notice_url:NOTICE_URL,subject_scores,screening,merit,computer,
    timing:{by_outcome,time_traps:traps,unavailable_questions:unavailable,void_questions:voidQuestions,
      note:'Client-reported visible, focused time; untracked, withdrawn and undelivered questions do not contribute to timed totals.'},
    projection:{percentile:null,normalized_score:null,available:false,method:'user_supplied_shift_simulation',normalization_notice_url:NORMALIZATION_NOTICE_URL}}
}

// SSC's 2025 notice uses m/N (including ties), then linear interpolation at
// that percentile in every shift and the unweighted mean of matched scores.
// This is ONLY a simulation: the histograms are supplied by the learner, not
// SSC. If a value is outside another shift's percentile range, do not invent an
// extrapolation. Inputs are aggregated score counts and are never stored.
export function simulateTier1Normalization(rawScore,body){
  onlyKeys(body,['shifts'],'simulation request')
  const raw=numeric(rawScore)
  if(raw===null||raw< -50||raw>200||!Number.isInteger(raw*2))throw new ContentError('A valid full Tier I raw practice score is required')
  if(!Array.isArray(body.shifts)||body.shifts.length<2||body.shifts.length>8)throw new ContentError('Provide between 2 and 8 shift distributions')
  const shifts=body.shifts.map((shift,index)=>{
    if(!Array.isArray(shift)||!shift.length||shift.length>501)throw new ContentError(`Shift ${index+1} must contain 1–501 score rows`)
    const counts=new Map()
    for(const row of shift){
      onlyKeys(row,['score','count'],'score row')
      const score=numeric(row.score),count=numeric(row.count)
      if(typeof row.score!=='number'||score===null||score< -50||score>200||!Number.isInteger(score*2))throw new ContentError(`Shift ${index+1}: score must be from -50 to 200 in half-mark steps`)
      if(typeof row.count!=='number'||count===null||!Number.isSafeInteger(count)||count<1||count>10000000)throw new ContentError(`Shift ${index+1}: each count must be a whole number from 1 to 10000000`)
      counts.set(score,(counts.get(score)||0)+count)
    }
    // The learner supplies everyone else's aggregated counts for their shift.
    if(index===0)counts.set(raw,(counts.get(raw)||0)+1)
    const total=[...counts.values()].reduce((a,b)=>a+b,0)
    if(total>10000000)throw new ContentError(`Shift ${index+1}: total count exceeds 10000000`)
    let cumulative=0
    const points=[...counts].sort((a,b)=>a[0]-b[0]).map(([score,count])=>{cumulative+=count;return {score,percentile:cumulative/total}})
    return {points,total}
  })
  const own=shifts[0],ownPoint=own.points.find(point=>point.score===raw),p=ownPoint.percentile
  const equivalents=shifts.map(({points,total},index)=>{
    const exact=points.find(point=>Math.abs(point.percentile-p)<1e-12)
    if(exact)return {shift:index+1,participants:total,score:exact.score}
    let lower=null,upper=null
    for(const point of points){if(point.percentile<p)lower=point;else if(point.percentile>p){upper=point;break}}
    if(!lower||!upper)return {shift:index+1,participants:total,score:null}
    const estimate=lower.score+(upper.score-lower.score)*(p-lower.percentile)/(upper.percentile-lower.percentile)
    return {shift:index+1,participants:total,score:estimate}
  })
  const complete=equivalents.every(item=>item.score!==null)
  return {percentile:round(p*100,4),normalized_score:complete?round(equivalents.reduce((n,item)=>n+item.score,0)/equivalents.length,2):null,
    status:complete?'estimated':'insufficient_range',raw_score:raw,equivalent_scores:equivalents.map(item=>({...item,score:item.score===null?null:round(item.score,8)})),learner_added_to_shift_1:true,
    label:'User-supplied practice simulation; not an SSC score, percentile or selection prediction.',notice_url:NORMALIZATION_NOTICE_URL}
}
