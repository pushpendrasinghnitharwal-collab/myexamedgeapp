import React,{useEffect,useRef,useState} from 'react'
import {AlertCircle,ArrowRight,ArrowUpRight,LockKeyhole} from 'lucide-react'
import {api} from '../lib/api'
import {useCglAccount,useCglStage,invalidateCglData,readableApiError} from '../lib/cglData'
import {navigate} from '../lib/router'
import {useStore} from '../lib/store'

export function PageHeader({eyebrow,title,description,action}){return <div className="cc-page-head"><div><div className="cc-eyebrow"><span/> {eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>}
export function SectionHeading({eyebrow,title,description,action}){return <div className="cc-section-head"><div>{eyebrow&&<div className="cc-eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>}
export function TextLink({children,onClick}){return <button className="cc-text-link" onClick={onClick}>{children}<ArrowRight size={15}/></button>}
export function Notice({children}){return <div className="cc-notice" role="status"><AlertCircle size={17}/><span>{children}</span></div>}
export function Status({children,tone='muted'}){return <span className={`cc-status ${tone}`}><i/>{children}</span>}
export function Empty({icon:Icon=LockKeyhole,title,description,action}){return <div className="cc-empty"><span className="cc-empty-icon"><Icon size={21}/></span><strong>{title}</strong><p>{description}</p>{action}</div>}
export function SourceLink({href,children='Source'}){
  let safe=null;try{const url=new URL(href);if(url.protocol==='https:')safe=url.href}catch{}
  return safe?<a className="cc-source-link" href={safe} target="_blank" rel="noopener noreferrer">{children} <ArrowUpRight size={13}/></a>:null
}
export function usePrepare(){
  const {state}=useStore(),{user}=useCglAccount(),[stage]=useCglStage(),stageRef=useRef(stage),[busy,setBusy]=useState(false),[error,setError]=useState(''),mounted=useRef(true)
  stageRef.current=stage
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  async function prepare(spec){
    if(!user){navigate('/profile?backend=1');return}
    setBusy(true);setError('')
    const preparedStage=stage
    try{const data=await api.prepareMaster({...spec,timing_profile:state.settings.cglTiming==='official_2026'?'official_2026':'exam_hall_v1'});invalidateCglData();if(mounted.current&&stageRef.current===preparedStage)navigate(`/session/${data.mock.id}`);else{await api.cancelMaster(data.mock.id).catch(()=>{});invalidateCglData()}}
    catch(e){if(mounted.current)setError(readableApiError(e))}finally{if(mounted.current)setBusy(false)}
  }
  return {prepare,busy,error,setError,user}
}
