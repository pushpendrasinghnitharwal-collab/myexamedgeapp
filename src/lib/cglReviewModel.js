const TARGET_KEY='examedge.cgl.review-targets.v1'
const subjects=new Set(['Quant','Reasoning','English','General_Awareness'])
const readTargets=()=>{try{const value=JSON.parse(localStorage.getItem(TARGET_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
export function validTarget(value){
  if(value===''||value===null||value===undefined)return true
  const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=50&&Number.isInteger(n*2)
}
export function loadReviewTargets(scope){
  const raw=readTargets()?.[scope]
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {}
  return Object.fromEntries(Object.entries(raw).filter(([key,value])=>subjects.has(key)&&value!==''&&validTarget(value)).map(([key,value])=>[key,String(value)]))
}
export function saveReviewTargets(scope,targets){
  if(!scope)return false
  try{
    const clean=Object.fromEntries(Object.entries(targets).filter(([key,value])=>subjects.has(key)&&value!==''&&validTarget(value)).map(([key,value])=>[key,Number(value)]))
    const data=readTargets();data[scope]=clean;localStorage.setItem(TARGET_KEY,JSON.stringify(data));return true
  }catch{return false}
}
export function saveReviewTarget(scope,subject,value){
  if(!subjects.has(subject)||!validTarget(value))return false
  return saveReviewTargets(scope,{...loadReviewTargets(scope),[subject]:value})
}
export function clearReviewTargets(){try{localStorage.removeItem(TARGET_KEY)}catch{}}

export function reviewOutcome(question){
  if(question.not_delivered)return 'not-delivered'
  if(question.content_withdrawn)return 'withdrawn'
  if(question.answer_status==='Void')return 'void'
  if(question.is_correct===true)return 'correct'
  if(question.is_correct===false)return 'wrong'
  return question.selected_option_index==null?'skipped':'unavailable'
}
export function filteredReview(results,filter,subject='all',trapPositions=new Set()){
  let rows=(results||[]).filter(q=>subject==='all'||q.subject===subject)
  if(filter==='traps')return rows.filter(q=>trapPositions.has(q.position))
  if(filter==='slowest')return rows.filter(q=>!q.not_delivered&&!q.content_withdrawn&&q.answer_status!=='Void'&&Number(q.time_spent_ms)>0)
    .sort((a,b)=>Number(b.time_spent_ms)-Number(a.time_spent_ms)||a.position-b.position)
  if(filter!=='all')rows=rows.filter(q=>reviewOutcome(q)===filter||(filter==='skipped'&&reviewOutcome(q)==='not-delivered'))
  return rows
}
export function parseShiftHistogram(input){
  const lines=String(input||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
  if(lines.length&&/^score\s*,\s*count$/i.test(lines[0]))lines.shift()
  if(!lines.length||lines.length>501)throw new Error('Enter 1–501 rows of score,count per shift.')
  return lines.map((line,index)=>{
    const match=line.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+)$/)
    if(!match)throw new Error(`Row ${index+1}: use score,count (for example 100,25).`)
    const score=Number(match[1]),count=Number(match[2])
    if(!Number.isFinite(score)||score< -50||score>200||!Number.isInteger(score*2))throw new Error(`Row ${index+1}: score must be from -50 to 200 in half-mark steps.`)
    if(!Number.isSafeInteger(count)||count<1||count>10000000)throw new Error(`Row ${index+1}: count must be a whole number from 1 to 10000000.`)
    return {score,count}
  })
}

// Earlier players kept timing on this device only. Fill gaps without replacing
// or adding to positive server durations. Outcome counts remain the backend's;
// unavailable/void questions and unknown ideal times never create traps.
export function mergeReviewTimes(results,timing,localTimes={}){
  if(!timing?.by_outcome)return {results,timing,deviceOnlyCount:0}
  const copy={...timing,by_outcome:Object.fromEntries(Object.entries(timing.by_outcome).map(([key,row])=>[key,{...row}])),time_traps:[...(timing.time_traps||[])]}
  const round=(value,places)=>Math.round((value+Number.EPSILON)*10**places)/10**places
  let deviceOnlyCount=0
  const augmented=(results||[]).map(question=>{
    const outcome=reviewOutcome(question),row=copy.by_outcome[outcome],local=Number(localTimes[question.position])
    if(!row||Number(question.time_spent_ms)>0||Number(question.time_spent_seconds)>0||!Number.isFinite(local)||local<=0)return question
    const seconds=local/1000
    deviceOnlyCount++;row.tracked_questions++;row.total_seconds=round((row.total_seconds??0)+seconds,3);row.average_seconds=round(row.total_seconds/row.tracked_questions,2)
    const ideal=Number(question.ideal_time_seconds)
    if(Number.isFinite(ideal)&&ideal>0&&seconds>2*ideal)copy.time_traps.push({position:question.position,subject:question.subject||null,seconds:round(seconds,3),ideal_seconds:ideal,ratio:round(seconds/ideal,2)})
    return {...question,time_spent_ms:local,time_spent_seconds:seconds,time_source:'device_only'}
  })
  copy.time_traps.sort((a,b)=>b.seconds-a.seconds||a.position-b.position)
  return {results:augmented,timing:copy,deviceOnlyCount}
}
