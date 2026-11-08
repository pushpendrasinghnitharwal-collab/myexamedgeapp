import React,{useEffect,useRef,useState} from 'react'
import {ArrowUp,BookOpen,LoaderCircle,MessageCircle,Sparkles,X} from 'lucide-react'
import {api} from '../lib/api'
import {SourceLink} from './CglUI'
import './mentor-drawer.css'

const CHIPS=[['trick','20-sec trick samjhao'],['eliminate','Option eliminate kaise karein?'],['step','Ye step kaise aaya?'],['pyq','Is topic ke aur PYQ dikhao']]
export default function MentorDrawer({mockId,position,lang,onClose}){
  const [messages,setMessages]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const panel=useRef(null),request=useRef(null),bottom=useRef(null),closeRef=useRef(onClose)
  closeRef.current=onClose
  useEffect(()=>{
    const previous=document.activeElement,oldOverflow=document.body.style.overflow
    document.body.style.overflow='hidden';panel.current?.focus()
    function onKey(event){
      if(event.key==='Escape'){event.preventDefault();closeRef.current();return}
      if(event.key!=='Tab')return
      const focusable=[...panel.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled), a[href]')]
      if(!focusable.length){event.preventDefault();panel.current.focus();return}
      const first=focusable[0],last=focusable.at(-1)
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKey)
    return()=>{request.current?.abort();document.removeEventListener('keydown',onKey);document.body.style.overflow=oldOverflow;previous?.focus?.()}
  },[])
  useEffect(()=>{if(messages.length||busy)bottom.current?.scrollIntoView?.({block:'nearest'})},[messages,busy])
  async function ask(intent,label,custom){
    if(busy)return
    const controller=new AbortController();request.current=controller;setBusy(true);setMessages(old=>[...old.slice(-9),{kind:'user',text:label}]);setMessage('')
    try{
      const response=await api.askMentor(mockId,{position,intent,language:lang,...(intent==='custom'?{message:custom}:{})},{signal:controller.signal})
      if(!controller.signal.aborted)setMessages(old=>[...old,{kind:'mentor',response}])
    }catch(error){if(!controller.signal.aborted)setMessages(old=>[...old,{kind:'error',text:error.message||'AI Mentor is temporarily unavailable.'}])}
    finally{if(!controller.signal.aborted){setBusy(false);request.current=null}}
  }
  function send(event){event.preventDefault();const value=message.trim();if(value&&!busy)ask('custom',value,value)}
  return <div className="mentor-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><aside className="mentor-drawer" role="dialog" aria-modal="true" aria-labelledby="mentor-title" aria-describedby="mentor-privacy" ref={panel} tabIndex={-1}>
    <header className="mentor-header"><span><Sparkles size={21}/></span><div><small>YOUR POST-TEST STUDY PARTNER</small><h2 id="mentor-title">AI Mentor <i>✦</i></h2></div><button aria-label="Close AI Mentor" onClick={onClose}><X size={19}/></button></header>
    <div className="mentor-content"><div className="mentor-question-label"><BookOpen size={14}/> QUESTION {position} · SUBMITTED REVIEW</div><div className="mentor-greeting"><span><Sparkles size={17}/></span><div><strong>Let’s make it click.</strong><p>Pick a prompt or ask about this question. I’ll use your reviewed answer and solutions as context.</p></div></div>
      <div className="mentor-privacy" id="mentor-privacy"><strong>Before you ask</strong><p>AI requests send the question, passage, options and available chart data, your chosen answer, reviewed key and solutions, and your message to the configured AI provider. Avoid personal details; the provider’s privacy terms apply. AI can be wrong; check the reviewed solution. Each AI request is independent; related PYQs are looked up locally.</p></div>
      <div className="mentor-chips" aria-label="Suggested mentor prompts">{CHIPS.map(([id,label])=><button key={id} disabled={busy} onClick={()=>ask(id,label)}>{label}</button>)}</div>
      <div className="mentor-conversation" aria-live="polite">{messages.map((item,index)=>item.kind==='user'?<div className="mentor-user-message" key={index}>{item.text}</div>:item.kind==='error'?<div className="mentor-error" key={index} role="status">{item.text}</div>:<div className="mentor-answer" key={index}><span><Sparkles size={14}/></span><div>{item.response.type==='related_pyq'?<><p>{item.response.message}</p>{item.response.items?.map(pyq=><article className="mentor-pyq" key={pyq.id}><small>{pyq.cycle_year} · {pyq.exam_date} · {pyq.shift_label} · Q{pyq.position}</small><p>{pyq.question}</p><SourceLink href={pyq.paper_url}>Original paper</SourceLink></article>)}</>:<><p>{item.response.answer}</p>{item.response.visual_unavailable&&<small>The text-only mentor could not see all visual material. Verify using the reviewed solution.</small>}<small>AI guidance may be incorrect.</small></>}</div></div>)}
        {busy&&<div className="mentor-loading" role="status"><LoaderCircle size={15}/> Thinking through this question…</div>}<div ref={bottom}/></div>
    </div><form className="mentor-compose" onSubmit={send}><label htmlFor="mentor-doubt">Ask a doubt about this question</label><div><textarea id="mentor-doubt" value={message} onChange={event=>setMessage(event.target.value)} maxLength={500} disabled={busy} placeholder="Type your doubt…" rows={2}/><button aria-label="Send doubt" disabled={busy||!message.trim()}><ArrowUp size={18}/></button></div><small><MessageCircle size={12}/> Question-specific · 500 characters max</small></form>
  </aside></div>
}
