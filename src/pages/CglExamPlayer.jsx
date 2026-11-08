import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {AlertTriangle,ChevronDown,Clock3,LockKeyhole,LogOut,UserRound} from 'lucide-react'
import {api} from '../lib/api'
import {useStore} from '../lib/store'
import {loadPlayer,savePlayer,playerDeviceId,paletteState,mergePlayerProgress,snapshotPlayerRevisions} from '../lib/cglPlayerStore'
import {readableApiError} from '../lib/cglData'
import {timerAnchor,remainingSeconds} from '../lib/cglPlayerClock'
import CglChartData from '../components/CglChartData'
import './exam-player.css'

const label=value=>String(value||'').replaceAll('_',' ')
const text=(obj,key,lang)=>obj?.[`${key}_${lang}`]||obj?.[`${key}_en`]||obj?.[`${key}_hi`]||''
const optionText=(value,lang)=>typeof value==='string'?value:value?.[lang]||value?.en||value?.hi||''
const mediaSrc=value=>typeof value==='string'&&/^https:\/\//i.test(value)?value:typeof value==='string'&&/^\s*<svg\b/i.test(value)?`data:image/svg+xml,${encodeURIComponent(value)}`:null
const clockText=seconds=>seconds==null?'Untimed':`${String(Math.floor(Math.max(0,seconds)/3600)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%3600/60)).padStart(2,'0')}:${String(Math.max(0,seconds)%60).padStart(2,'0')}`
const LOCKED_CHANGES='Some device changes did not reach the server before their section locked.'
const STORAGE_WARNING='Device storage is unavailable. Keep this page open until progress is synced.'
const hasLockedChanges=(positions,allowed)=>Object.entries(positions||{}).some(([position,q])=>q?.dirty&&!allowed.has(Number(position)))
const paletteLabels={'answered':'Answered','not-answered':'Not Answered','marked':'Marked for Review','answered-marked':'Answered & Marked for Review','not-visited':'Not Visited'}
function PassageBody({passage,lang}){
  const body=text(passage,'passage_text',lang)||text(passage,'text',lang),image=mediaSrc(passage?.media_svg_or_url),chart=passage?.chart_data
  return <div className="ep-passage-content">{body&&<p>{body}</p>}{image&&<img src={image} alt="Passage or data illustration"/>}{chart&&<CglChartData data={chart} lang={lang}/>}</div>
}
function Passage({passage,lang}){
  return <><aside className="ep-passage-desktop"><div className="ep-pane-title">Passage / Data</div><PassageBody passage={passage} lang={lang}/></aside><details className="ep-passage-mobile"><summary>Passage / Data <ChevronDown size={16}/></summary><PassageBody passage={passage} lang={lang}/></details></>
}
function Palette({questions,current,onGo}){
  const counts=Object.fromEntries(Object.keys(paletteLabels).map(s=>[s,questions.filter(q=>paletteState(q)===s).length]))
  return <><div className="ep-legend">{Object.entries(paletteLabels).map(([key,name])=><div key={key}><span className={`ep-status-shape ${key}`}>{counts[key]}</span><span>{name}</span></div>)}</div><div className="ep-palette-heading">Question Palette <small>Choose a question</small></div><div className="ep-palette-grid">{questions.map(q=><button key={q.position} type="button" className={`ep-number ${paletteState(q)} ${current===q.position?'current':''}`} onClick={()=>onGo(q.position)} aria-label={`Question ${q.position}, ${paletteLabels[paletteState(q)]}`} aria-current={current===q.position?'true':undefined}>{q.position}</button>)}</div></>
}
export default function CglExamPlayer({id,scope,user,initial,onUpdate,onFinish,onLeave}){
  const {state,updateSettings}=useStore(),lang=state.settings.lang==='hi'?'hi':'en',loaded=useRef(loadPlayer(scope,id)),device=useRef(loaded.current.device_id||playerDeviceId())
  const activeRef=useRef(initial);activeRef.current=initial
  const [local,setLocal]=useState(()=>mergePlayerProgress(initial,{...loaded.current,device_id:device.current})),localRef=useRef(local),mounted=useRef(true)
  const delivered=useRef(new Set((initial.questions||[]).map(q=>q.position))),reconciliation=useRef(null),mustBlock=useRef(false)
  const [clock,setClock]=useState(initial.timer?.module_remaining_seconds??null),[syncState,setSyncState]=useState('saved'),[message,setMessage]=useState(()=>hasLockedChanges(loaded.current.positions,delivered.current)?LOCKED_CHANGES:''),[busy,setBusy]=useState(false),[switching,setSwitching]=useState(false)
  const conflict=useRef(false),storageUnavailable=useRef(false),lockedPending=useRef(hasLockedChanges(loaded.current.positions,delivered.current)),inflight=useRef(null),syncRef=useRef(async()=>true),refreshRef=useRef(()=>{}),lastServerCheck=useRef(Date.now()),paused=useRef(false),timeFlush=useRef(()=>{}),busyRef=useRef(false)
  localRef.current=local
  const commit=useCallback(next=>{localRef.current=next;if(!savePlayer(scope,id,next)){storageUnavailable.current=true;setMessage(STORAGE_WARNING)}else storageUnavailable.current=false;if(mounted.current)setLocal(next)},[scope,id])
  const updatePosition=useCallback((position,patch,{sync=true}={})=>{
    if(!position)return
    const old=localRef.current.positions[position]||{selected_option_index:null,visited:false,marked_for_review:false,elapsed_ms:0,rev:0}
    const next={...old,...patch,visited:true,dirty:true,rev:(old.rev||0)+1}
    commit({...localRef.current,positions:{...localRef.current.positions,[position]:next}})
    if(sync)queueMicrotask(()=>syncRef.current())
  },[commit])
  const go=useCallback(position=>{if(!activeRef.current.questions?.some(q=>q.position===position))return;commit({...localRef.current,current:position})},[commit])
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{const snapshot=reconciliation.current;reconciliation.current=null;commit(mergePlayerProgress(initial,localRef.current,snapshot))},[initial,commit])
  syncRef.current=async()=>{
    if(conflict.current)return false
    if(inflight.current)return inflight.current
    const active=activeRef.current
    if(active.timer?.state!=='Active')return false
    const allowed=new Set((active.questions||[]).map(q=>q.position)),snapshot=Object.entries(localRef.current.positions).filter(([pos,value])=>allowed.has(Number(pos))&&value.dirty)
    if(!snapshot.length){if(mounted.current)setSyncState('saved');return true}
    const answers=snapshot.map(([pos,q])=>({position:Number(pos),selected_option_index:q.selected_option_index??null,visited:!!q.visited,marked_for_review:!!q.marked_for_review,elapsed_ms:Math.min(604800000,Math.max(0,Math.round(q.elapsed_ms||0))),device_id:device.current,client_revision:q.rev}))
    if(mounted.current)setSyncState('syncing')
    const request=(async()=>{
      try{
        const result=await api.saveMaster(id,answers)
        if(result.ignored_positions?.length){const error=new Error('A newer update exists in another tab. Reload to continue.');error.code='STALE_PROGRESS';throw error}
        const positions={...localRef.current.positions}
        for(const [pos,old] of snapshot)if(positions[pos]?.rev===old.rev)positions[pos]={...positions[pos],dirty:false}
        lockedPending.current=hasLockedChanges(positions,delivered.current)
        commit({...localRef.current,positions});if(mounted.current){setSyncState('saved');if(!storageUnavailable.current)setMessage(lockedPending.current?LOCKED_CHANGES:'')}
        return true
      }catch(e){
        if(e.code==='STALE_PROGRESS')conflict.current=true
        if(mounted.current){
          setSyncState(e.code==='STALE_PROGRESS'?'conflict':'pending')
          const detail=e.code==='STALE_PROGRESS'?'A newer update exists in another tab. Reload to continue.':['MODULE_LOCKED','TIMER_EXPIRED'].includes(e.code)?LOCKED_CHANGES:e.code==='CONTENT_WITHDRAWN'||e.status===401?readableApiError(e):storageUnavailable.current?'Changes are not backed up yet.':'Connection lost: changes are saved on this device and will retry while this section is open.'
          setMessage(storageUnavailable.current?`${STORAGE_WARNING} ${detail}`:detail)
          if(['MODULE_LOCKED','TIMER_EXPIRED'].includes(e.code))queueMicrotask(()=>refreshRef.current())
        }
        return false
      }
      finally{inflight.current=null}
    })()
    inflight.current=request;return request
  }
  const flush=async()=>{
    for(let n=0;n<5;n++){
      const ok=await syncRef.current();if(!ok)return false
      const allowed=new Set((activeRef.current.questions||[]).map(q=>q.position))
      if(!Object.entries(localRef.current.positions).some(([pos,q])=>allowed.has(Number(pos))&&q.dirty))return true
    }
    return false
  }
  useEffect(()=>{syncRef.current()},[initial])
  const questions=(initial.questions||[]).map(q=>({...q,...(local.positions[q.position]||{})}))
  const question=questions.find(q=>q.position===local.current)||questions[0],position=question?.position
  const groups=useMemo(()=>{
    const map=new Map()
    for(const q of questions){const key=q.subject||q.module_code||'Questions';if(!map.has(key))map.set(key,[]);map.get(key).push(q)}
    return [...map.entries()]
  },[initial.questions,local.positions])
  const activeGroup=question?.subject||question?.module_code||'Questions'
  useEffect(()=>{if(position&&initial.timer?.state==='Active'&&!localRef.current.positions[position]?.visited)updatePosition(position,{visited:true})},[position,initial.timer?.state,updatePosition])
  useEffect(()=>{
    if(!position||initial.timer?.state!=='Active'||switching)return
    const foreground=()=>document.visibilityState==='visible'&&document.hasFocus()&&!paused.current
    let started=foreground()?performance.now():null,ticks=0
    const record=()=>{if(started!==null){const delta=Math.max(0,performance.now()-started);started=null;if(delta>=1){const existing=localRef.current.positions[position]?.elapsed_ms||0;updatePosition(position,{elapsed_ms:existing+delta},{sync:false})}}}
    const visibility=()=>{record();if(foreground()){started=performance.now();if(Date.now()-lastServerCheck.current>15000){lastServerCheck.current=Date.now();refreshRef.current(false)}}else syncRef.current()}
    const pagehide=()=>{record();syncRef.current()}
    const timer=setInterval(()=>{record();if(foreground())started=performance.now();if(++ticks%5===0)syncRef.current()},1000)
    timeFlush.current=()=>{record();syncRef.current()}
    document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',visibility);window.addEventListener('blur',visibility);window.addEventListener('pagehide',pagehide);window.addEventListener('online',visibility)
    return()=>{clearInterval(timer);record();syncRef.current();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility);window.removeEventListener('blur',visibility);window.removeEventListener('pagehide',pagehide);window.removeEventListener('online',visibility);timeFlush.current=()=>{}}
  },[position,initial.timer?.state,switching,updatePosition])
  const refresh=useCallback(async(blocking=true)=>{
    const block=blocking!==false
    if(busyRef.current){if(block){mustBlock.current=true;setSwitching(true)}return}
    busyRef.current=true;mustBlock.current=block;if(block)setSwitching(true);timeFlush.current()
    const snapshot=snapshotPlayerRevisions(localRef.current.positions),controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),10000)
    try{
      const a=await api.activeMaster(id,{signal:controller.signal}),nextPositions=new Set((a.questions||[]).map(q=>q.position))
      delivered.current=nextPositions;lockedPending.current=hasLockedChanges(localRef.current.positions,nextPositions)
      reconciliation.current=snapshot;onUpdate(a);lastServerCheck.current=Date.now()
      setMessage(storageUnavailable.current?STORAGE_WARNING:lockedPending.current?LOCKED_CHANGES:'');setSwitching(false)
    }catch(e){
      const detail=mustBlock.current||e.status===401||e.code==='CONTENT_WITHDRAWN'?readableApiError(e):storageUnavailable.current?'Unable to verify the server clock.':'Unable to verify the server clock. Changes stay on this device and will retry while this section is open.'
      setMessage(storageUnavailable.current?`${STORAGE_WARNING} ${detail}`:detail)
    }finally{clearTimeout(timeout);busyRef.current=false;mustBlock.current=false}
  },[id,onUpdate])
  refreshRef.current=refresh
  useEffect(()=>{
    if(initial.timer?.state!=='Active'||switching)return
    const anchor=timerAnchor(initial.timer,Date.now(),performance.now())
    if(!anchor){setClock(null);return}
    let requested=false
    const tick=()=>{const left=remainingSeconds(anchor,Date.now(),performance.now());setClock(left);if(left===0&&!requested){requested=true;refresh()}}
    tick();const timer=setInterval(tick,250);return()=>clearInterval(timer)
  },[initial.timer,switching,refresh])
  async function useServerState(){
    if(!window.confirm('Discard this tab’s pending local changes and reload the server-saved state?'))return
    paused.current=true;timeFlush.current()
    const positions=Object.fromEntries(Object.entries(localRef.current.positions).map(([key,q])=>[key,{...q,dirty:false,rev:0,elapsed_ms:0}]))
    device.current=playerDeviceId();commit({...localRef.current,device_id:device.current,positions})
    conflict.current=false;lockedPending.current=false;setSyncState('saved');setMessage('');await refresh();paused.current=false
  }
  async function advance(){
    if(!window.confirm(`Submit ${label(initial.timer.current_section)}? You cannot return to its questions.`))return
    setBusy(true);paused.current=true;timeFlush.current()
    try{if(!await flush()){setMessage(conflict.current?'Resolve the other-tab conflict before submitting this section.':'Please reconnect and sync your answers before submitting this section.');return}
      const next=await api.advanceMaster(id,initial.timer.current_section);delivered.current=new Set((next.questions||[]).map(q=>q.position));onUpdate(next);lastServerCheck.current=Date.now()
    }catch(e){setMessage(readableApiError(e))}finally{paused.current=false;setBusy(false)}
  }
  async function submit(){
    if(!window.confirm('Submit the entire mock? Unanswered and undelivered questions will be scored as skipped.'))return
    setBusy(true);paused.current=true;timeFlush.current()
    try{
      if(initial.timer?.state==='Active'&&!await flush()){setMessage(conflict.current?'Resolve the other-tab conflict before submitting.':'Please reconnect and sync your answers before submitting.');return}
      if(Object.values(localRef.current.positions).some(q=>q.dirty)&&!window.confirm('Some device changes did not sync before their section locked. Submit only the server-saved answers?'))return
      await onFinish()
    }catch(e){setMessage(readableApiError(e))}finally{paused.current=false;setBusy(false)}
  }
  function next(mark){if(!question)return;updatePosition(question.position,{marked_for_review:mark});const i=questions.findIndex(q=>q.position===question.position);if(i<questions.length-1)go(questions[i+1].position)}
  function leave(){timeFlush.current();onLeave()}
  const hasPassage=!!question?.passage&&(!!text(question.passage,'passage_text',lang)||!!text(question.passage,'text',lang)||!!question.passage.media_svg_or_url||!!question.passage.chart_data)
  const media=mediaSrc(question?.media_svg_or_url||question?.media_url),pending=Object.values(local.positions).some(q=>q.dirty)
  const isFullTier2=initial.mock?.category==='Full_Tier2'&&initial.mock?.specification?.timing_profile==='exam_hall_v1'
  const finalLocked=isFullTier2&&initial.timer?.state==='Active'&&initial.timer.current_section!=='Section_III'
  return <div className="ep-player">
    <header className="ep-header"><div className="ep-brand"><strong>ExamEdge</strong><span>Exam Player</span></div><div className="ep-header-title">{initial.mock?.title}</div><button onClick={leave}><LogOut size={15}/> Exit</button></header>
    <div className="ep-info"><div><strong>SSC CGL practice</strong><span>{initial.mock?.specification?.timing_profile==='exam_hall_v1'?'Requested practice timing · not the 2026 notice profile':['Full_Tier1','Full_Tier2','Sectional_Tier1','Sectional_Tier2'].includes(initial.mock?.category)?'2026 notice timing profile':'Historical source or untimed practice'}</span></div><div className="ep-clock"><Clock3 size={16}/> Time Left: <strong>{clockText(clock)}</strong></div></div>
    {isFullTier2&&<div className="ep-section-locks" aria-label="Locked exam sections">{['Section_I','Section_II','Section_III'].map(code=><span key={code} className={initial.timer.current_section===code?'active':'locked'}>{initial.timer.current_section!==code&&<LockKeyhole size={12}/>} {label(code)}</span>)}</div>}
    <div className="ep-subject-bar"><span>Sections</span><div role="tablist" aria-label="Available subject sections">{groups.map(([name,items])=><button role="tab" aria-selected={activeGroup===name} key={name} onClick={()=>go(items[0].position)}>{label(name)}</button>)}</div><span className="ep-section-timer">{label(initial.timer?.current_section)}</span></div>
    {message&&<div className="ep-warning" role="status"><AlertTriangle size={16}/>{message}{syncState==='conflict'?<button onClick={useServerState}>Reload server state</button>:switching&&<button onClick={refresh}>Retry</button>}</div>}
    {initial.timer?.state==='Expired'?<main className="ep-expired"><Clock3 size={32}/><h1>Time is up</h1><p>Your server-saved answers are ready to submit.</p><button className="ep-primary" onClick={submit} disabled={busy}>Submit saved answers</button></main>:
    switching?<main className="ep-expired"><h1>Checking the next section…</h1><p>The server clock controls section access.</p>{message&&<button className="ep-primary" onClick={refresh}>Retry</button>}</main>:
    <div className="ep-layout"><main className="ep-workspace">{question?<><div className="ep-question-heading"><strong>Question No. {question.position}</strong><div><span className="ep-elapsed">Time on this device: {Math.floor((Number(question.elapsed_ms)||0)/1000)}s</span><label htmlFor="ep-lang">View in:</label><select id="ep-lang" value={lang} onChange={e=>updateSettings({lang:e.target.value})}><option value="en">English</option><option value="hi">हिन्दी</option></select></div></div>
      {question.previously_seen&&<div className="ep-repeat">Previously seen question</div>}
      <div className={`ep-question-split ${hasPassage?'with-passage':''}`}>{hasPassage&&<Passage passage={question.passage} lang={lang}/>}<section className="ep-question-pane"><div className="ep-question-text">{text(question,'question_text',lang)||'Question text unavailable'}</div>{media&&<img className="ep-question-media" src={media} alt="Question illustration"/>}<div className="ep-options" role="radiogroup" aria-label="Answer options">{(question.options||[]).map((option,index)=><button key={index} type="button" role="radio" aria-checked={question.selected_option_index===index} disabled={busy||clock===0} className={question.selected_option_index===index?'selected':''} onClick={()=>updatePosition(position,{selected_option_index:index})}><span className="ep-radio"/><span>{optionText(option,lang)}</span></button>)}</div></section></div>
      <div className="ep-controls"><button onClick={()=>next(true)} disabled={busy}>Mark for Review &amp; Next</button><button onClick={()=>updatePosition(position,{selected_option_index:null})} disabled={busy}>Clear Response</button><button className="ep-primary" onClick={()=>next(false)} disabled={busy}>Save &amp; Next</button></div></>:<div className="ep-expired"><p>No questions are available in this section.</p></div>}</main>
      <aside className="ep-sidebar"><div className="ep-candidate"><span><UserRound size={25}/></span><div><strong>{user?.name||'Candidate'}</strong><small>Practice candidate</small></div></div><Palette questions={questions} current={position} onGo={go}/><div className="ep-sidebar-actions">{initial.timer?.can_advance&&<button className="ep-advance" disabled={busy||switching} onClick={advance}>Submit {label(initial.timer.current_section)}</button>}<button className="ep-submit" disabled={busy||switching||finalLocked} onClick={submit} title={finalLocked?'Complete Sections I and II first':undefined}>Submit mock</button>{finalLocked&&<small>Final submission unlocks in Section III.</small>}<small>{syncState==='syncing'?'Syncing…':pending?'Changes pending sync':'Progress synced'}</small></div></aside>
      <details className="ep-mobile-palette"><summary>Question Palette <ChevronDown size={16}/></summary><Palette questions={questions} current={position} onGo={go}/></details><div className="ep-mobile-actions">{initial.timer?.can_advance&&<button className="ep-advance" disabled={busy} onClick={advance}>Submit {label(initial.timer.current_section)}</button>}<button className="ep-submit" disabled={busy||finalLocked} onClick={submit} title={finalLocked?'Complete Sections I and II first':undefined}>Submit mock</button>{finalLocked&&<small>Final submission unlocks in Section III.</small>}<small>{pending?'Changes pending sync':'Progress synced'}</small></div>
    </div>}
  </div>
}
