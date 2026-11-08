import {useEffect,useMemo,useState} from 'react'
import {api} from './api'
import {useStore} from './store'
import {calculateInsights} from './cglModel'
import {questionSeconds} from './cglTelemetry'

const cache=new Map(),pending=new Map(),TTL=30000
let epoch=0
export function invalidateCglData(){epoch++;cache.clear();pending.clear();window.dispatchEvent(new Event('cgl-data-change'))}
export function useCglStage(){
  const {state,updateSettings}=useStore()
  const stage=state.settings.cglStage==='Tier_2'?'Tier_2':'Tier_1'
  return [stage,value=>updateSettings({cglStage:value==='Tier_2'?'Tier_2':'Tier_1'})]
}
export function useResource(key,loader,enabled=true){
  const [revision,setRevision]=useState(0)
  const [state,setState]=useState(()=>enabled&&cache.has(key)?{key,data:cache.get(key).data,loading:false,error:null}:{key,data:null,loading:enabled,error:null})
  useEffect(()=>{const on=()=>setRevision(n=>n+1);window.addEventListener('cgl-data-change',on);return()=>window.removeEventListener('cgl-data-change',on)},[])
  useEffect(()=>{
    let alive=true
    const requestEpoch=epoch
    if(!enabled){setState({key,data:null,loading:false,error:null});return()=>{alive=false}}
    const saved=cache.get(key)
    if(saved&&Date.now()-saved.at<TTL){setState({key,data:saved.data,loading:false,error:null});return()=>{alive=false}}
    setState({key,data:saved?.data??null,loading:true,error:null})
    let request=pending.get(key)
    if(!request){request=Promise.resolve().then(loader);pending.set(key,request);request.finally(()=>{if(pending.get(key)===request)pending.delete(key)}).catch(()=>{})}
    request.then(data=>{if(requestEpoch!==epoch)return;cache.set(key,{data,at:Date.now()});if(alive)setState({key,data,loading:false,error:null})})
      .catch(error=>{if(alive&&requestEpoch===epoch)setState({key,data:saved?.data??null,loading:false,error})})
    return()=>{alive=false}
    // key identifies the loader's parameters; changing stages changes the key.
  },[key,enabled,revision])
  if(!enabled)return {data:null,loading:false,error:null}
  return state.key===key?state:(cache.has(key)?{data:cache.get(key).data,loading:false,error:null}:{data:null,loading:enabled,error:null})
}
export function useCglAccount(){
  const {state}=useStore()
  const user=state.auth?.token&&state.auth?.user?state.auth.user:null
  const origin=(import.meta.env.VITE_API_URL||'same-origin').replace(/\/$/,'')
  return {user,scope:user?`${origin}:${user.id}`:null}
}
export function useCglSummary(){
  const {user}=useCglAccount()
  return useResource(`summary:${user?.id||'none'}`,()=>api.masterSummary(),!!user)
}
export function useCglHistory(stage,status=null){
  const {user}=useCglAccount()
  return useResource(`history:${user?.id||'none'}:${stage}:${status||'all'}`,()=>status==='Submitted'?api.masterAttempts({limit:100,stage}):api.masterMocks({limit:100,stage,status}),!!user)
}
export function useCglInsights(stage){
  const {user,scope}=useCglAccount(),history=useCglHistory(stage,'Submitted')
  const submitted=(history.data?.mocks||[]).filter(m=>m.status==='Submitted').slice(0,20)
  const signature=submitted.map(m=>m.id).join(',')
  const reviews=useResource(`reviews:${user?.id||'none'}:${signature}`,async()=>{
    // Review takes a per-user backend lock. Bound concurrency so a dashboard
    // cannot occupy the whole connection pool while those locks serialize.
    const results=new Array(submitted.length);let cursor=0
    await Promise.all(Array.from({length:Math.min(3,submitted.length)},async()=>{
      while(cursor<submitted.length){const index=cursor++;try{results[index]={value:await api.reviewMaster(submitted[index].id)}}catch(error){results[index]={error}}}
    }))
    return {reviews:results.filter(r=>r.value).map(r=>r.value),failed:results.filter(r=>r.error).length}
  },!!user&&!history.loading&&submitted.length>0)
  const insights=useMemo(()=>calculateInsights(reviews.data?.reviews||[],stage,(id,pos)=>questionSeconds(scope,id,pos)),[reviews.data,stage,scope])
  return {history,reviews,insights,user,scope,submitted}
}
export function readableApiError(error){
  if(error?.code==='INSUFFICIENT_REVIEWED_CONTENT'||error?.code==='CONTENT_PENDING')return 'Reviewed content is not ready for this test yet.'
  if(error?.code==='POOL_CHANGED'||error?.code==='PREPARATION_EXPIRED')return 'This preparation expired or changed. Please make a fresh one.'
  if(error?.code==='CONTENT_WITHDRAWN')return 'This content was withdrawn and is no longer available.'
  if(error?.status===401)return 'Please sign in to your separate practice account.'
  if(error?.status===503||error?.code==='API_UNAVAILABLE'||error?.name==='AbortError'||error instanceof TypeError)return 'The practice service is unavailable. Please try again when it is connected.'
  return error?.message||'Something went wrong. Please try again.'
}
