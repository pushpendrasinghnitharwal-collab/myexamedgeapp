import {Worker} from 'node:worker_threads'
import {TIER1_DIFFICULTY,TIER1_EDITORIAL_SETS,TIER1_EDITORIAL_TOPICS} from './master-formats.js'

export class MasterSelectionError extends Error {constructor(code,message,details={}){super(message);this.code=code;this.details=details}}
export const sourceKey=item=>`${item.source_kind}:${item.source_id}:${item.source_part||0}`
const idSort=(a,b)=>a.key.localeCompare(b.key,'en',{numeric:true})
let running=0
function runModel(model,{timeoutMs=10000}={}){
  if(running>=4)throw new MasterSelectionError('ASSEMBLER_BUSY','The assembler is busy; retry shortly')
  running++
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./master-solver-worker.js',import.meta.url),{type:'module',execArgv:[]})
    let done=false
    const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timer);running--;worker.terminate().catch(()=>{});err?reject(err):resolve(result)}
    const timer=setTimeout(()=>finish(new MasterSelectionError('ASSEMBLER_TIMEOUT','Exact composition took too long; no test was created')),timeoutMs)
    worker.once('error',error=>finish(new MasterSelectionError('ASSEMBLER_FAILED','The selection solver failed',{reason:error.message})))
    worker.once('exit',code=>{if(code!==0&&!done)finish(new MasterSelectionError('ASSEMBLER_FAILED','The selection worker stopped unexpectedly'))})
    worker.once('message',message=>message.ok?finish(null,message.result):finish(new MasterSelectionError('ASSEMBLER_FAILED','The selection solver rejected the model',{reason:message.error})))
    worker.postMessage(model)
  })
}
function constraintsFor(spec,modules){
  const constraints={},topicCodes=new Map()
  modules.forEach((m,i)=>{constraints[`module_${i}`]={equal:m.question_count}})
  if(spec.category==='Full_Tier1'){
    let n=0
    for(const [subject,topics] of Object.entries(TIER1_EDITORIAL_TOPICS))for(const [topic,count] of Object.entries(topics)){
      const key=`topic_${n++}`;topicCodes.set(`${subject}\0${topic}`,key);constraints[key]={equal:count}
    }
    for(const [difficulty,count] of Object.entries(TIER1_DIFFICULTY))constraints[`difficulty_${difficulty}`]={equal:count}
    for(const [type,count] of Object.entries(TIER1_EDITORIAL_SETS))constraints[`set_${type}`]={equal:count}
  }
  return {constraints,topicCodes}
}
function vectorFor(unit,spec,modules,topicCodes){
  const vector={}
  const index=modules.findIndex(m=>m.code===unit.module_code)
  if(index<0)return null
  vector[`module_${index}`]=unit.items.length
  if(spec.category==='Full_Tier1')for(const item of unit.items){
    const topicKey=topicCodes.get(`${item.subject}\0${item.topic}`)
    if(!topicKey||!item.difficulty)return null
    vector[topicKey]=(vector[topicKey]||0)+1
    const difficultyKey=`difficulty_${item.difficulty}`;vector[difficultyKey]=(vector[difficultyKey]||0)+1
    if(item.set_type&&Object.hasOwn(TIER1_EDITORIAL_SETS,item.set_type)){
      const setKey=`set_${item.set_type}`;vector[setKey]=(vector[setKey]||0)+1
    }
  }
  return vector
}

// Solve exact integer composition, minimizing repeats first and global recency
// ranks second. Sets are indivisible variables. The worker has a hard timeout;
// a timed-out or infeasible model never silently relaxes requested constraints.
export async function selectMasterUnits(units,spec,modules,seen,{timeoutMs=10000}={}){
  const target=modules.reduce((n,m)=>n+m.question_count,0),{constraints,topicCodes}=constraintsFor(spec,modules)
  const moduleMax=Object.fromEntries(modules.map(m=>[m.code,m.question_count]))
  const ranked=[...seen.entries()].sort((a,b)=>Number(new Date(a[1]))-Number(new Date(b[1]))||a[0].localeCompare(b[0]))
  const rank=new Map(ranked.map(([key],index)=>[key,index+1])),base=ranked.length*target+1
  const buckets=new Map()
  for(const unit of units){
    const vector=vectorFor(unit,spec,modules,topicCodes)
    if(!vector||!unit.items.length||unit.items.length>moduleMax[unit.module_code])continue
    const seenItems=unit.items.map(sourceKey).filter(k=>seen.has(k))
    const seenCount=seenItems.length,recency=seenItems.reduce((n,k)=>n+(rank.get(k)||0),0)
    const signature=JSON.stringify([unit.module_code,Object.entries(vector).sort(([a],[b])=>a.localeCompare(b)),seenCount])
    const bucket=buckets.get(signature)||{vector,seenCount,units:[],limit:Math.floor(moduleMax[unit.module_code]/unit.items.length)}
    bucket.units.push({...unit,recency});buckets.set(signature,bucket)
  }
  const variables={},ints={},choices=[];let counter=0
  for(const bucket of buckets.values()){
    bucket.units.sort((a,b)=>a.recency-b.recency||idSort(a,b))
    const useful=bucket.units.slice(0,bucket.limit)
    if(!useful.length)continue
    if(bucket.seenCount===0){
      const name=`v${counter++}`,cap=`cap_${name}`;constraints[cap]={max:useful.length}
      variables[name]={...bucket.vector,[cap]:1,cost:0};ints[name]=1;choices.push({name,units:useful})
    }else for(const unit of useful){
      const name=`v${counter++}`,cap=`cap_${name}`;constraints[cap]={max:1}
      variables[name]={...bucket.vector,[cap]:1,cost:bucket.seenCount*base+unit.recency};ints[name]=1;choices.push({name,units:[unit]})
    }
  }
  if(counter>5000)throw new MasterSelectionError('ASSEMBLER_POOL_TOO_LARGE','The exact selection model is too large; narrow the requested scope')
  if(!counter)throw new MasterSelectionError('INSUFFICIENT_REVIEWED_CONTENT','No eligible reviewed questions are available',{required:target,eligible:0})
  const result=await runModel({optimize:'cost',opType:'min',constraints,variables,ints},{timeoutMs})
  if(!result?.feasible||result.bounded===false)throw new MasterSelectionError('INSUFFICIENT_REVIEWED_CONTENT','Reviewed questions cannot satisfy the exact composition and intact-set constraints',{required:target,eligible:units.reduce((n,u)=>n+u.items.length,0),profile:spec.category==='Full_Tier1'?'tier1-editorial-practice-v1':null})
  const chosen=[]
  for(const entry of choices){
    const raw=result[entry.name]||0,n=Math.round(raw)
    if(Math.abs(raw-n)>1e-7||n<0||n>entry.units.length)throw new MasterSelectionError('ASSEMBLER_FAILED','The solver returned an invalid integer solution')
    chosen.push(...entry.units.slice(0,n))
  }
  // Independently validate the returned integer solution, including every quota.
  const totals={}
  for(const unit of chosen){const v=vectorFor(unit,spec,modules,topicCodes);for(const [key,value] of Object.entries(v))totals[key]=(totals[key]||0)+value}
  for(const [key,bound] of Object.entries(constraints))if(!key.startsWith('cap_')&&totals[key]!==bound.equal)throw new MasterSelectionError('ASSEMBLER_FAILED','The solver did not meet the exact composition constraints')
  const reused=chosen.flatMap(u=>u.items).filter(item=>seen.has(sourceKey(item))).length
  chosen.sort((a,b)=>modules.findIndex(m=>m.code===a.module_code)-modules.findIndex(m=>m.code===b.module_code)||idSort(a,b))
  return {units:chosen,reused_questions:reused,unseen_questions:target-reused,
    repeat_reason:reused?'Unseen eligible items cannot satisfy the exact format and intact-set constraints':null,
    rule:'Minimize previously seen questions first; then prefer the least recently seen.'}
}
