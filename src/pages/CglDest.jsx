import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {AlertTriangle,ArrowLeft,ArrowRight,CheckCircle2,Clock3,Keyboard,RotateCcw,ShieldCheck} from 'lucide-react'
import {DEST_PASSAGES} from '../data/destPassages'
import {DEST_2025_RESULT_URL,DEST_CATEGORIES,DEST_DURATION_MS,DEST_EVALUATION_URL,DEST_MAX_INPUT,DEST_NOTICE_URL,remainingDestMs,scoreDest,withinDestLimit} from '../lib/destScoring'
import {clearDestSession,loadDestSession,saveDestSession} from '../lib/destStore'
import {useCglAccount} from '../lib/cglData'
import {navigate} from '../lib/router'
import {SourceLink} from '../components/CglUI'
import './dest.css'

const formatClock=ms=>{const s=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
const cleanCount=value=>Number.isSafeInteger(value)&&value>=0?value:0
function restore(scope){
  const saved=loadDestSession(scope)
  if(!saved||!DEST_PASSAGES.some(p=>p.id===saved.passageId)||!['active','finished'].includes(saved.phase)||typeof saved.text!=='string'||saved.text.length>DEST_MAX_INPUT)return null
  if(!Number.isFinite(saved.deadline)||!Number.isFinite(saved.remainingMs))return null
  const left=Math.max(0,Math.min(DEST_DURATION_MS,saved.remainingMs,saved.deadline-Date.now()))
  return {...saved,result:undefined,remainingMs:saved.phase==='finished'?Math.max(0,Math.min(DEST_DURATION_MS,saved.remainingMs)):left,
    counts:{textKeydowns:cleanCount(saved.counts?.textKeydowns),backspaces:cleanCount(saved.counts?.backspaces),deletes:cleanCount(saved.counts?.deletes)}}
}
function HighlightedPassage({reference,typed,highlight}){
  const box=useRef(null),cursor=useRef(null)
  useEffect(()=>{
    if(!highlight||!box.current||!cursor.current)return
    const area=box.current.getBoundingClientRect(),point=cursor.current.getBoundingClientRect()
    if(point.bottom>area.bottom-24)box.current.scrollTop+=point.bottom-area.bottom+32
    else if(point.top<area.top+24)box.current.scrollTop-=area.top-point.top+32
  },[typed.length,highlight])
  if(!highlight)return <p ref={box}>{reference}</p>
  const runs=[]
  for(let i=0;i<reference.length;i++){
    const state=i<typed.length?(reference[i]===typed[i]?'correct':'wrong'):i===typed.length?'cursor':'pending'
    if(runs.at(-1)?.state===state)runs.at(-1).text+=reference[i];else runs.push({state,text:reference[i]})
  }
  return <p ref={box}>{runs.map((run,index)=><span ref={run.state==='cursor'?cursor:null} key={index} className={`dest-char-${run.state}`}>{run.text}</span>)}</p>
}
function DestEntry({onStart}){
  const [passage,setPassage]=useState(DEST_PASSAGES[0].id)
  return <main className="dest-intro"><div className="dest-intro-copy"><div className="dest-eyebrow"><Keyboard size={15}/> TIER II · SESSION II PRACTICE</div><h1>Make every<br/><em>keystroke count.</em></h1><p>Build confidence with a focused 15-minute data entry practice. Keep the MCQ merit score separate; this is a qualifying skill exercise.</p>
    <div className="dest-hero-stats"><span><strong>15:00</strong><small>STANDARD TIMER</small></span><span><strong>2,000</strong><small>CHARACTERS</small></span><span><strong>English</strong><small>ORIGINAL PASSAGES</small></span></div>
    <label htmlFor="dest-passage">Practice passage</label><select id="dest-passage" value={passage} onChange={event=>setPassage(event.target.value)}>{DEST_PASSAGES.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select>
    <button className="dest-primary" onClick={()=>onStart(passage)}>Start typing test <ArrowRight size={16}/></button>
    <small>Each original passage contains 2,000 printable characters, including spaces and punctuation; that is not necessarily 2,000 physical keystrokes. Timer starts immediately and continues if you leave or reload this tab. A physical keyboard is recommended.</small></div>
    <div className="dest-intro-aside"><span className="dest-aside-icon"><ShieldCheck size={25}/></span><div className="dest-eyebrow">BEFORE YOU BEGIN</div><h2>Practice, not an official test.</h2><ul><li>Type the passage once. Backspace and corrections are allowed and tracked.</li><li>Paste, drop, spellcheck and autocorrect are disabled where the browser permits.</li><li>Leave enough time to review. The test submits automatically at 15 minutes.</li></ul><p>SSC provides about 2,000 key depressions and 15 minutes for the standard DEST; eligible candidates may receive compensatory time. This simulator currently uses the standard duration only.</p><SourceLink href={DEST_NOTICE_URL}>2026 SSC notice</SourceLink></div>
  </main>
}
function Result({result,category,setCategory,onRetry,onBack}){
  const chosen=DEST_CATEGORIES.find(row=>row.id===category)||DEST_CATEGORIES[0],normal=withinDestLimit(result,chosen.normal),higher=chosen.historical===null?null:withinDestLimit(result,chosen.historical)
  return <main className="dest-result"><div className="dest-result-head"><div><div className="dest-eyebrow"><CheckCircle2 size={15}/> PRACTICE COMPLETE</div><h1>Progress in every keystroke.</h1><p>A useful check-in, not an official SSC evaluation.</p></div><button className="dest-outline" onClick={onRetry}><RotateCcw size={15}/> Try another passage</button></div>
    <div className="dest-result-grid"><div className="dest-result-main"><div className="dest-result-top"><div><small>PRACTICE ERROR RATE</small><strong>{result.display_error_percentage.toFixed(2)}<span>%</span></strong><p>{result.weighted_mistakes} weighted mistakes / {result.reference_words} passage words</p></div><span className="dest-result-icon"><Keyboard size={24}/></span></div>
      <div className="dest-result-metrics"><div><small>Total key depressions</small><strong>{result.total_key_depressions}</strong><span>Browser-tracked keys</span></div><div><small>Gross WPM</small><strong>{result.gross_wpm}</strong><span>5 text keys = 1 word</span></div><div><small>Full mistakes</small><strong>{result.full_mistakes}</strong><span>Word-level edits</span></div><div><small>Half mistakes</small><strong>{result.half_mistakes}</strong><span>Case, spacing, punctuation, order</span></div></div>
      <div className="dest-detail-line"><span>{result.text_keydowns} text keys</span><span>{result.backspaces} backspaces</span><span>{result.deletes} deletes</span><span>{result.final_characters} final characters</span><span>{formatClock(result.elapsed_ms)} elapsed</span></div>{result.elapsed_ms<30000&&<p className="dest-short-run">Very short attempts can inflate the WPM estimate.</p>}</div>
      <aside className="dest-comparison"><div className="dest-eyebrow">COMPARE YOUR PRACTICE</div><h2>Understand the limits.</h2><label htmlFor="dest-category">Category for comparison</label><select id="dest-category" value={category} onChange={event=>setCategory(event.target.value)}>{DEST_CATEGORIES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <div className="dest-limit"><div><strong>2026 notice · normal standard</strong><small>Maximum {chosen.normal}% error</small></div><span className={normal?'within':'above'}>{normal?'Within practice limit':'Above practice limit'}</span></div>
        <div className="dest-limit"><div><strong>2025 higher-standard result</strong><small>{higher===null?'Select a listed category':`Maximum ${chosen.historical}% error`}</small></div><span className={higher===null?'unknown':higher?'within':'above'}>{higher===null?'Unavailable':higher?'Within practice limit':'Above practice limit'}</span></div>
        <p>Higher standards vary by post and result year. SC/ST/ESM had 7%, while the listed PwBD categories had 10% in the 2025 result. Your category stays on this screen.</p><div className="dest-sources"><SourceLink href={DEST_NOTICE_URL}>2026 notice</SourceLink><SourceLink href={DEST_2025_RESULT_URL}>2025 result</SourceLink></div></aside></div>
    <div className="dest-method"><AlertTriangle size={18}/><div><strong>How this estimate works</strong><p>We align words and count full word errors plus half errors for case, spacing, punctuation and adjacent transpositions. Unfinished words and omitted remainder count as full errors. Practice error % = (full + half ÷ 2) ÷ words in the whole passage × 100; comparisons use the unrounded value. Extra errors can make this estimate exceed 100%. SSC does not publish a complete automated scoring algorithm, so this is not an official error rate or a qualification decision. Total key depressions count text, Backspace and Delete keydowns; modifiers and navigation keys are excluded. Gross WPM is text keydowns ÷ 5 ÷ elapsed minutes, including corrected characters but excluding Backspace/Delete. Browser key counts may be incomplete on mobile or IME keyboards.</p><SourceLink href={DEST_EVALUATION_URL}>SSC mistake categories</SourceLink></div></div><button className="dest-text-link" onClick={onBack}>Return to workspace <ArrowRight size={15}/></button>
  </main>
}
export default function CglDest({returnTo='/'}){
  const {scope}=useCglAccount(),storageScope=scope||'guest', [session,setSession]=useState(()=>restore(storageScope)),[highlight,setHighlight]=useState(false),[category,setCategory]=useState('UR'),[warning,setWarning]=useState('')
  const ref=useRef(session),anchor=useRef(null),textarea=useRef(null),submitting=useRef(false)
  const passage=DEST_PASSAGES.find(item=>item.id===session?.passageId)
  function save(next){ref.current=next;setSession(next);if(next&&!saveDestSession(storageScope,next))setWarning('Tab storage is unavailable. A reload may lose this test.')}
  const refreshClock=useCallback(()=>{
    const current=ref.current;if(!current||current.phase!=='active')return null
    if(!anchor.current)anchor.current={wall:Date.now(),mono:performance.now(),initial:current.remainingMs}
    const next=remainingDestMs(anchor.current.wall,anchor.current.mono,Date.now(),performance.now(),current.remainingMs,anchor.current.initial)
    return next
  },[])
  const finish=useCallback((current,left)=>{
    if(!current||current.phase!=='active'||submitting.current)return
    submitting.current=true
    const result=scoreDest(DEST_PASSAGES.find(p=>p.id===current.passageId).text,current.text,{...current.counts,elapsedMs:DEST_DURATION_MS-left})
    const finished={...current,phase:'finished',remainingMs:left,result};ref.current=finished;setSession(finished)
    if(!saveDestSession(storageScope,finished))setWarning('Tab storage is unavailable. A reload may lose this result.')
    submitting.current=false
  },[storageScope])
  useEffect(()=>{
    if(!session||session.phase!=='active')return
    if(!anchor.current)anchor.current={wall:Date.now(),mono:performance.now(),initial:session.remainingMs}
    const tick=()=>{const current=ref.current,left=refreshClock();if(left===null)return;if(left<=0){finish(current,0);return}
      // Update the visible clock and recovery snapshot without increasing time.
      if(Math.ceil(left/1000)!==Math.ceil(current.remainingMs/1000)){const next={...current,remainingMs:left};ref.current=next;setSession(next);if(!saveDestSession(storageScope,next))setWarning('Tab storage is unavailable. A reload may lose this test.')}
    }
    tick();const timer=setInterval(tick,250);document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('focus',tick)}
  },[session?.phase,refreshClock,finish,storageScope])
  useEffect(()=>{if(session?.phase==='active')textarea.current?.focus()},[session?.phase])
  function start(passageId){
    clearDestSession(storageScope);const now=Date.now();anchor.current={wall:now,mono:performance.now(),initial:DEST_DURATION_MS};setWarning('')
    save({phase:'active',passageId,text:'',deadline:now+DEST_DURATION_MS,remainingMs:DEST_DURATION_MS,counts:{textKeydowns:0,backspaces:0,deletes:0}})
  }
  function guardedCurrent(){
    const current=ref.current,left=refreshClock();if(!current||left===null)return null
    if(left<=0){finish(current,0);return null}return {...current,remainingMs:left}
  }
  function keydown(event){
    const current=guardedCurrent();if(!current){event.preventDefault();return}
    if((event.ctrlKey||event.metaKey)&&['v','x','z','y'].includes(event.key.toLowerCase())){event.preventDefault();return}
    const counts={...current.counts}
    if(event.key==='Backspace')counts.backspaces++
    else if(event.key==='Delete')counts.deletes++
    else if((event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey)||event.key==='Enter')counts.textKeydowns++
    else return
    save({...current,counts})
  }
  function input(event){
    const current=guardedCurrent();if(!current)return
    const native=event.nativeEvent
    // Mobile/IME keyboards may not report printable keydown events. Keep the
    // text but do not fabricate hardware counts; the report discloses this.
    if(['insertFromPaste','insertFromDrop','insertReplacementText','historyUndo','historyRedo'].includes(native.inputType))return
    save({...current,text:event.target.value.slice(0,DEST_MAX_INPUT)})
  }
  function submit(){if(!guardedCurrent()||!window.confirm('Submit this typing practice now? The remaining passage will count as omitted.'))return;const current=guardedCurrent();if(current)finish(current,current.remainingMs)}
  const result=useMemo(()=>session?.phase==='finished'?(session.result||scoreDest(passage.text,session.text,{...session.counts,elapsedMs:DEST_DURATION_MS-session.remainingMs})):null,[session,passage])
  function reset(){if(session?.phase==='active'&&!window.confirm('Discard this in-progress typing practice?'))return;clearDestSession(storageScope);ref.current=null;anchor.current=null;setSession(null);setWarning('')}
  function back(){navigate(returnTo)}
  return <div className="dest-page"><header className="dest-header"><button onClick={back}><ArrowLeft size={16}/> {returnTo.startsWith('/session/')?'Mock review':'Workspace'}</button><div><span><Keyboard size={16}/></span><strong>ExamEdge <em>DEST</em></strong></div><small>SSC CGL · PRACTICE</small></header>
    {warning&&<div className="dest-warning" role="status"><AlertTriangle size={16}/>{warning}</div>}
    {!session?<DestEntry onStart={start}/>:session.phase==='finished'&&result?<Result result={result} category={category} setCategory={setCategory} onRetry={reset} onBack={back}/>:<main className="dest-test"><div className="dest-test-top"><div><div className="dest-eyebrow">MAINS TYPING TEST · ORIGINAL PRACTICE</div><h1>{passage?.title}</h1><p>Type the passage exactly as shown. Corrections are allowed.</p></div><div className={`dest-clock ${session.remainingMs<60000?'is-low':''}`}><Clock3 size={17}/><span><small>TIME REMAINING</small><strong>{formatClock(session.remainingMs)}</strong></span></div></div>
      <div className="dest-work-area"><section className="dest-reference"><div className="dest-panel-head"><div><small>01 / REFERENCE PASSAGE</small><strong>Read &amp; type</strong></div><label><input type="checkbox" checked={highlight} onChange={event=>setHighlight(event.target.checked)}/> Highlight position</label></div><HighlightedPassage reference={passage.text} typed={session.text} highlight={highlight}/>{highlight&&<small className="dest-highlight-note">Position-based highlighting can shift after an insertion or omission; final analysis uses word alignment.</small>}</section>
        <section className="dest-entry"><div className="dest-panel-head"><div><small>02 / YOUR RESPONSE</small><strong>Start typing below</strong></div><span>{session.text.length} / 2,000 characters</span></div><textarea ref={textarea} aria-label="Type the reference passage" value={session.text} onKeyDown={keydown} onChange={input} onPaste={event=>event.preventDefault()} onDrop={event=>event.preventDefault()} onCut={event=>event.preventDefault()} autoCorrect="off" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={DEST_MAX_INPUT} placeholder="Begin typing the passage here…"/><div className="dest-entry-foot"><span>Backspaces: {session.counts.backspaces} · Text keys: {session.counts.textKeydowns}</span><button className="dest-primary" onClick={submit}>Submit practice <ArrowRight size={15}/></button></div></section></div>
      <p className="dest-test-note">The timer continues while this tab is away. Typed text is kept only in this tab for recovery, not sent to the server. This is not the TCS iON system.</p><button className="dest-text-link" onClick={reset}>Discard this practice</button></main>}
  </div>
}
