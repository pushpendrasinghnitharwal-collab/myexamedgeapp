import React,{useCallback,useEffect,useState} from 'react'
import {AlertCircle,ArrowLeft,ArrowRight,LockKeyhole,RotateCw,ShieldCheck,Target} from 'lucide-react'
import {api} from '../lib/api'
import {useCglAccount,invalidateCglData,readableApiError} from '../lib/cglData'
import CglExamPlayer from './CglExamPlayer'
import CglReview from './CglReview'
import {clearPlayer} from '../lib/cglPlayerStore'
import {useStore} from '../lib/store'
import {navigate} from '../lib/router'
import {Notice} from '../components/CglUI'

function RunnerTop({title,detail,onBack}){return <header className="cc-runner-top"><button className="cc-runner-brand" onClick={onBack}><span><Target size={19}/></span> Exam<strong>Edge</strong></button><div><strong>{title||'Your practice session'}</strong><small>{detail}</small></div><button className="cc-runner-exit" onClick={onBack}><ArrowLeft size={15}/> Exit</button></header>}
function StartScreen({mock,onLaunch,onCancel,busy,error}){
  const totalTime=mock.modules?.every(m=>m.duration_seconds!==null)?mock.modules.reduce((n,m)=>n+m.duration_seconds,0)/60:null
  return <div className="cc-runner-centered"><div className="cc-card cc-start-card"><span className="cc-start-icon"><ShieldCheck size={26}/></span><div className="cc-eyebrow">YOUR SESSION IS PREPARED</div><h1>{mock.title}</h1><p>Your questions are reserved for 30 minutes. The timer begins only when you start.</p><div className="cc-start-stats"><span><strong>{mock.question_count}</strong><small>Questions</small></span><span><strong>{totalTime?`${totalTime} min`:'Untimed'}</strong><small>Session</small></span><span><strong>{mock.selection?.reused_questions??0}</strong><small>Previously seen</small></span></div>
    {!!mock.selection?.reused_questions&&<Notice>{mock.selection.repeat_reason||'Previously seen questions are included and flagged.'}</Notice>}
    <div className="cc-session-rules"><strong>Before you begin</strong><p>Answers save as you select them. {mock.specification?.timing_profile==='exam_hall_v1'?'This requested practice profile allows free navigation within the current section; Tier II full mocks use 60 / 60 / 15 minute section locks. It is not the 2026 notice timing.':'The notice profile uses its original module locks or untimed practice settings.'} The server clock controls transitions; early submission leaves undelivered questions unanswered. AI Mentor is available only after submission.</p>{mock.exam_stage==='Tier_2'&&<p>Computer is qualifying; the separate DEST is not included in this MCQ session.</p>}</div>{error&&<Notice>{error}</Notice>}<div className="cc-start-actions"><button className="cc-outline-button" disabled={busy} onClick={onCancel}>Cancel preparation</button><button className="cc-primary-button" disabled={busy} onClick={onLaunch}>{busy?'Starting…':'Start session'} <ArrowRight size={16}/></button></div></div></div>
}
export default function CglSession({id}){
  const {state,updateSettings}=useStore(),{user,scope}=useCglAccount(),[phase,setPhase]=useState('loading'),[mock,setMock]=useState(null),[active,setActive]=useState(null),[review,setReview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const lang=state.settings.lang==='hi'?'hi':'en'
  const load=useCallback(async()=>{
    if(!user){setPhase('signed-out');return}
    setPhase('loading');setError('')
    try{const data=await api.masterMock(id),m=data.mock;setMock(m)
      if(m.status==='Submitted'){setReview(await api.reviewMaster(id));setPhase('review')}
      else if(m.status==='Active'){setActive(await api.activeMaster(id));setPhase('active')}
      else if(m.status==='Prepared')setPhase('prepared')
      else setPhase('ended')
    }catch(e){setError(readableApiError(e));setPhase('error')}
  },[id,user?.id])
  useEffect(()=>{load()},[load])
  const updateActive=useCallback(a=>{setActive(a);setMock(a.mock)},[])
  async function launch(){setBusy(true);setError('');try{const a=await api.launchMaster(id);setActive(a);setMock(a.mock);setPhase('active');invalidateCglData()}catch(e){setError(readableApiError(e))}finally{setBusy(false)}}
  async function cancel(){if(!window.confirm('Cancel this session? Any delivered questions will remain marked as seen.'))return;setBusy(true);try{await api.cancelMaster(id);invalidateCglData();navigate('/mocks')}catch(e){setError(readableApiError(e))}finally{setBusy(false)}}
  async function finish(){try{const data=await api.submitMaster(id);clearPlayer(scope,id);setReview(data);setMock(data.mock);setPhase('review');invalidateCglData()}catch(e){throw new Error(readableApiError(e))}}
  const leave=()=>{if(phase==='active'&&!window.confirm('Leave this session? Timers continue on the server. Synced answers remain available.'))return;navigate('/mocks')}
  if(phase==='active'&&active)return <CglExamPlayer id={id} scope={scope} user={user} initial={active} onUpdate={updateActive} onFinish={finish} onLeave={leave}/>
  return <div className="cc-runner"><RunnerTop title={mock?.title} detail={phase==='review'?'Review your session':'SSC CGL practice'} onBack={leave}/>
    {phase==='loading'&&<div className="cc-runner-message">Loading your session…</div>}{phase==='signed-out'&&<div className="cc-runner-message"><LockKeyhole size={25}/><h2>Sign in to continue</h2><p>Practice sessions belong to your separate backend account.</p><button className="cc-primary-button" onClick={()=>navigate('/profile?backend=1')}>Sign in <ArrowRight size={15}/></button></div>}
    {phase==='error'&&<div className="cc-runner-message"><AlertCircle size={25}/><h2>Could not load this session</h2><p>{error}</p><button className="cc-outline-button" onClick={load}><RotateCw size={15}/> Try again</button></div>}
    {phase==='ended'&&<div className="cc-runner-message"><AlertCircle size={25}/><h2>This session is no longer active</h2><p>Prepare another mock to continue.</p><button className="cc-primary-button" onClick={()=>navigate('/mocks')}>Back to mocks <ArrowRight size={15}/></button></div>}
    {phase==='prepared'&&<StartScreen mock={mock} onLaunch={launch} onCancel={cancel} busy={busy} error={error}/>}
    {phase==='review'&&review&&<CglReview data={review} lang={lang} scope={scope} onLanguage={value=>updateSettings({lang:value})}/>}
  </div>
}
