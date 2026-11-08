import React,{useMemo,useState} from 'react'
import {AlertTriangle,ArrowRight,BarChart3,CheckCircle2,ChevronLeft,ChevronRight,Clock3,FlaskConical,Lightbulb,Sparkles,Target} from 'lucide-react'
import {api} from '../lib/api'
import {readableApiError} from '../lib/cglData'
import {SUBJECTS} from '../lib/cglModel'
import {filteredReview,loadReviewTargets,saveReviewTarget,validTarget,reviewOutcome,parseShiftHistogram,mergeReviewTimes} from '../lib/cglReviewModel'
import {navigate} from '../lib/router'
import {questionTimes} from '../lib/cglTelemetry'
import {SourceLink,Status} from '../components/CglUI'
import CglChartData from '../components/CglChartData'
import DestLink from '../components/DestLink'
import MentorDrawer from '../components/MentorDrawer'
import './cgl-review.css'

const CATEGORIES=[['UR','UR'],['OBC_EWS','OBC / EWS'],['Others','Other categories']]
const FILTERS=[['all','All'],['wrong','Wrong'],['skipped','Skipped'],['correct','Correct'],['slowest','Slowest'],['traps','Time traps']]
const subjectName=code=>SUBJECTS.find(subject=>subject.code===code)?.name||String(code||'').replaceAll('_',' ')
const forLang=(content,base,lang)=>lang==='hi'?(content?.[`${base}_hi`]||content?.[`${base}_en`]||content?.[base]||''):(content?.[`${base}_en`]||content?.[base]||content?.[`${base}_hi`]||'')
const display=(value,lang)=>typeof value==='string'?value:value&&typeof value==='object'?(value[lang]||value.en||value.hi||''):''
const number=value=>value===null||value===undefined?'—':Number.isFinite(Number(value))?String(Number(value)):'—'
const seconds=value=>{if(value===null||value===undefined)return '—';const n=Number(value);if(n<60)return `${number(Math.round(n*10)/10)}s`;const whole=Math.round(n);return `${Math.floor(whole/60)}m ${whole%60}s`}
function mediaSrc(value){
  if(typeof value!=='string')return null
  if(/^https:\/\//i.test(value))return value
  if(/^\s*<svg\b/i.test(value))return `data:image/svg+xml,${encodeURIComponent(value)}`
  return null
}

function QuestionContent({question,lang}){
  const passage=question.passage,passageText=forLang(passage,'passage_text',lang)||forLang(passage,'text',lang)
  const image=mediaSrc(question.media_svg_or_url||question.media_url),passageImage=mediaSrc(passage?.media_svg_or_url)
  const correct=Array.isArray(question.correct_option_indices)?question.correct_option_indices:question.correct_option_index===undefined?[]:[question.correct_option_index]
  return <div className="cc-question-content">{passage&&(passageText||passageImage||passage.chart_data)&&<div className="cc-passage"><div className="cc-eyebrow">PASSAGE / DATA</div>{passageText&&<p>{passageText}</p>}{passageImage&&<img src={passageImage} alt="Question passage illustration"/>}{passage.chart_data&&<CglChartData data={passage.chart_data} lang={lang}/>}</div>}
    <h2>{forLang(question,'question_text',lang)||'Question text unavailable'}</h2>{image&&<img className="cc-question-media" src={image} alt="Question illustration"/>}
    <div className="cc-options" role="list" aria-label="Answer options">{(question.options||[]).map((option,index)=>{
      const selected=question.selected_option_index===index,isCorrect=question.answer_status!=='Void'&&correct.includes(index),isWrong=question.answer_status!=='Void'&&selected&&!isCorrect
      return <div key={index} role="listitem" className={`cc-option ${selected&&question.answer_status!=='Void'?'is-selected':''} ${selected&&question.answer_status==='Void'?'is-selected-neutral':''} ${isCorrect?'is-correct':''} ${isWrong?'is-wrong':''}`}><span>{String.fromCharCode(65+index)}</span><strong>{display(option,lang)}</strong>{isCorrect&&<><small>{selected?'Your answer · Correct':'Correct'}</small><CheckCircle2 size={17}/></>}{selected&&!isCorrect&&<small>Your answer</small>}</div>
    })}</div>
  </div>
}

function Solution({question,lang}){
  const [tab,setTab]=useState('basic')
  const basic=forLang(question,'solution_basic',lang)||forLang(question,'explanation',lang)
  const trick=forLang(question,'solution_trick',lang),booster=question.static_gk_booster
  function switchTab(event){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
    event.preventDefault()
    const next=event.key==='Home'?'basic':event.key==='End'?'trick':tab==='basic'?'trick':'basic'
    setTab(next);event.currentTarget.querySelector(`#${next}-tab-${question.position}`)?.focus()
  }
  return <section className="rv-solution" aria-label="Solution methods">
    <div className="rv-solution-heading"><span><Lightbulb size={16}/> THE SOLUTION</span><small>Reviewed content</small></div>
    <div className="rv-solution-tabs" role="tablist" aria-label="Solution method" onKeyDown={switchTab}>
      <button role="tab" id={`basic-tab-${question.position}`} aria-controls={`solution-${question.position}`} aria-selected={tab==='basic'} tabIndex={tab==='basic'?0:-1} onClick={()=>setTab('basic')}>Basic Concept</button>
      <button role="tab" id={`trick-tab-${question.position}`} aria-controls={`solution-${question.position}`} aria-selected={tab==='trick'} tabIndex={tab==='trick'?0:-1} onClick={()=>setTab('trick')}>20-Sec Exam Trick</button>
    </div>
    <div className={`rv-solution-body ${tab==='trick'?'is-trick':''}`} role="tabpanel" id={`solution-${question.position}`} aria-labelledby={`${tab}-tab-${question.position}`}>
      {tab==='basic'?<>{basic?<p>{basic}</p>:<p className="rv-muted">A reviewed foundational solution is not available for this question.</p>}</>:
        <>{trick&&<p>{trick}</p>}{booster&&<div className="rv-booster"><strong>STATIC GK BOOSTER · {forLang(booster,'title',lang)}</strong><p>{forLang(booster,'fact',lang)}</p>{forLang(booster,'link',lang)&&<p>{forLang(booster,'link',lang)}</p>}{booster.as_of&&<small>Fact as of {booster.as_of}</small>}{booster.translation_note&&<small>{booster.translation_note}</small>}<SourceLink href={booster.source?.url}>{booster.source?.title||'Booster source'}</SourceLink></div>}{!trick&&!booster&&<p className="rv-muted">A reviewed shortcut is not available for this question.</p>}<small>Strategy guidance only; a 20-second solve is not guaranteed.</small></>}
    </div>
    <div className="cc-review-sources"><SourceLink href={question.event_source?.url}>Event source{question.event_source?.event_date?` · ${question.event_source.event_date}`:''}</SourceLink><SourceLink href={question.source?.url||question.source?.paper_url}>Question source</SourceLink><SourceLink href={question.source?.final_key_url}>Final key</SourceLink></div>
  </section>
}

function MinimumStatus({assessment}){
  if(!assessment)return null
  const state=assessment.status==='Qualified'?'Minimum met':assessment.status==='Not_Qualified'?'Below minimum':'Not assessed'
  return <span className={`rv-minimum ${assessment.status==='Qualified'?'is-met':assessment.status==='Not_Qualified'?'is-below':''}`}>{state} · {number(assessment.minimum_marks)} required</span>
}
function MeritPanel({analytics,category}){
  const merit=analytics?.merit,computer=analytics?.computer,assessment=computer?.assessments?.[category]
  if(!merit&&!computer)return null
  const title=assessment?.status==='Qualified'?'QUALIFIED IN COMPUTER':assessment?.status==='Not_Qualified'?'DISQUALIFIED IN COMPUTER':assessment?.status==='Not_Assessed'?'COMPUTER NOT ASSESSED':'COMPUTER PRACTICE'
  return <section className="rv-merit-panel">
    {merit&&<div className="rv-merit-main"><div className="rv-kicker">TIER II · PAPER I</div><h2>Merit component</h2><div className="rv-merit-score">{number(merit.score)} <span>/ 390</span></div><p>Raw practice score from Sections I + II only.</p><div className="rv-section-scores">{[['I',merit.section_i],['II',merit.section_ii]].map(([name,section])=><div key={name}><small>SECTION {name}</small><strong>{number(section.score)} <span>/ {number(section.max_score)}</span></strong><MinimumStatus assessment={section.assessments?.[category]}/></div>)}</div></div>}
    {computer&&<div className={`rv-computer ${assessment?.status==='Qualified'?'is-qualified':assessment?.status==='Not_Qualified'?'is-disqualified':''}`}><div className="rv-kicker">SECTION III · QUALIFYING</div><div className="rv-computer-number">{number(computer.score)} <span>/ {number(computer.max_score)}</span></div><strong className="rv-computer-badge">{title}</strong>
      {assessment?<p>{assessment.status==='Not_Assessed'?'The Computer section was not fully delivered, or reviewed content is no longer available.':`${CATEGORIES.find(c=>c[0]===category)?.[1]} minimum: ${number(assessment.minimum_marks)} / 60.`}</p>:<p>This is a partial Computer practice, not the full 60-mark module.</p>}
      <small>Practice minimum check only. Higher post-specific Computer standards may apply; DEST and final selection are not assessed.</small><SourceLink href={analytics.notice_url}>SSC notice</SourceLink></div>}
  </section>
}

function Targets({scores,scope}){
  const [targets,setTargets]=useState(()=>loadReviewTargets(scope)),[storageWarning,setStorageWarning]=useState(false)
  function change(subject,value){const next={...targets,[subject]:value};setTargets(next);if(validTarget(value))setStorageWarning(!saveReviewTarget(scope,subject,value))}
  return <section className="cc-card rv-target-card"><div className="rv-card-title"><span><Target size={17}/></span><div><div className="rv-kicker">SECTION BREAKDOWN</div><h2>Set your own targets</h2></div></div>
    <p>SSC does not prescribe Tier I subject cutoffs. Compare each score with a <strong>personal practice target</strong> instead.</p>
    <div className="rv-target-rows">{scores.map(row=>{const target=targets[row.subject]??'',valid=validTarget(target),has=target!==''&&valid,met=has&&row.score>=Number(target)
      return <div className="rv-target-row" key={row.subject}><div><strong>{subjectName(row.subject)}</strong><small>{number(row.score)} / {number(row.max_score)} marks</small></div><div><label htmlFor={`target-${row.subject}`}>Your target / 50</label><input id={`target-${row.subject}`} type="number" min="0" max="50" step="0.5" inputMode="decimal" placeholder="Set target" value={target} onChange={event=>change(row.subject,event.target.value)} aria-invalid={!valid}/></div><span className={has?(met?'is-met':'is-below'):'rv-muted'}>{!valid?'Use 0–50 in half marks':has?(met?'On target':'Below target'):'No target'}</span></div>
    })}</div><small className="rv-note">Targets are unofficial and saved on this device for this practice account.{storageWarning?' Device storage is unavailable; targets will not persist.':''}</small>
  </section>
}

function Simulation({mock,screening,noticeUrl}){
  const [open,setOpen]=useState(false),[shifts,setShifts]=useState(['','']),[simulation,setSimulation]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  function edit(index,value){setShifts(old=>old.map((item,i)=>i===index?value:item));setSimulation(null);setError('')}
  async function calculate(){
    setError('');setSimulation(null)
    try{const parsed=shifts.map(parseShiftHistogram);setBusy(true);const result=await api.simulateMaster(mock.id,parsed);setSimulation(result.simulation)}catch(e){setError(readableApiError(e))}finally{setBusy(false)}
  }
  return <section className="cc-card rv-sim-card"><div className="rv-card-title"><span><FlaskConical size={17}/></span><div><div className="rv-kicker">OPTIONAL PRACTICE SIMULATION</div><h2>Percentile &amp; normalization</h2></div></div>
    <div className="rv-estimates"><div><small>ESTIMATED PERCENTILE</small><strong>{simulation?`${number(simulation.percentile)}th`:'—'}</strong></div><div><small>NORMALIZED SCORE PROJECTION</small><strong>{simulation?.normalized_score==null?'—':`${number(simulation.normalized_score)} / 200`}</strong></div></div>
    <p>These are <strong>not SSC results or predictions</strong>. Supply comparable anonymized score counts from at least two shifts to run a practice-only calculation.</p>
    {(!screening.delivered||!screening.content_available)&&<p className="rv-inline-warning">A fully delivered Tier I full mock with available reviewed content is required for this simulation.</p>}
    <button className="rv-text-button" onClick={()=>setOpen(!open)} disabled={!screening.delivered||!screening.content_available} aria-expanded={open}>{open?'Close simulator':'Enter shift data'} <ArrowRight size={14}/></button>
    {open&&<div className="rv-sim-form"><p>Enter one <strong>score,count</strong> pair per line. Shift 1 is your reference shift; enter other candidates only—your score is added once. Do not include names or roll numbers. Data is sent for this calculation and is not saved.</p>
      <div className="rv-shifts">{shifts.map((value,index)=><div key={index}><label htmlFor={`shift-${index}`}>Shift {index+1}{index===0?' · yours':''}</label><textarea id={`shift-${index}`} value={value} disabled={busy} placeholder={'score,count\n80,25\n100,40'} onChange={event=>edit(index,event.target.value)} spellCheck={false}/>{index>=2&&<button className="rv-remove-shift" disabled={busy} onClick={()=>{setShifts(old=>old.filter((_,i)=>i!==index));setSimulation(null)}}>Remove shift</button>}</div>)}</div>
      <div className="rv-sim-actions"><button onClick={()=>{setShifts(old=>old.length<8?[...old,'']:old);setSimulation(null)}} disabled={busy||shifts.length>=8}>Add shift</button><button className="cc-primary-button" onClick={calculate} disabled={busy}>{busy?'Calculating…':'Calculate simulation'}</button></div>
      {error&&<p className="rv-inline-warning" role="alert">{error}</p>}{simulation&&<div className="rv-sim-result" role="status">{simulation.status==='insufficient_range'?<p>Percentile calculated, but the projection is unavailable: at least one shift lacks scores bracketing that percentile. No extrapolation was used.</p>:<p>Simulation calculated from {simulation.equivalent_scores.length} supplied shifts. Small or unrepresentative samples may be misleading.</p>}<small>{simulation.equivalent_scores.map(row=>`Shift ${row.shift}: ${row.participants} participants, matched score ${number(row.score)}`).join(' · ')}</small></div>}
    </div>}
    <div className="rv-source"><SourceLink href={noticeUrl}>SSC normalization method</SourceLink></div>
  </section>
}

function TimeAnalysis({timing,onSeeTraps,deviceOnlyCount}){
  if(!timing)return null
  return <section className="cc-card rv-time-card"><div className="rv-time-head"><div className="rv-card-title"><span><Clock3 size={17}/></span><div><div className="rv-kicker">SPEED &amp; TRAPS</div><h2>Where your time went</h2></div></div><button className="rv-trap-count" onClick={onSeeTraps}><AlertTriangle size={15}/> {timing.time_traps.length} time {timing.time_traps.length===1?'trap':'traps'}</button></div>
    <div className="rv-time-grid">{[['correct','Correct'],['wrong','Wrong'],['skipped','Skipped']].map(([key,name])=>{const bucket=timing.by_outcome[key];return <div key={key} className={`rv-time-stat ${key}`}><small>{name}</small><strong>{seconds(bucket.total_seconds)}</strong><span>{bucket.tracked_questions} of {bucket.questions} tracked{bucket.average_seconds!==null?` · ${seconds(bucket.average_seconds)} avg`:''}</span></div>})}</div>
    <p>A time trap is strictly more than 2× the question’s reviewed ideal time. Tracked time is approximate and excludes void, withdrawn or undelivered questions. {deviceOnlyCount>0&&`${deviceOnlyCount} ${deviceOnlyCount===1?'question uses':'questions use'} older timing saved only on this device.`}</p>
  </section>
}

const outcomeLabel={correct:'Correct',wrong:'Wrong',skipped:'Skipped','not-delivered':'Not delivered',withdrawn:'Content withdrawn',void:'Void',unavailable:'Unavailable'}
function ReviewQuestions({results,lang,onLanguage,filter,setFilter,subject,setSubject,trapPositions,mockId}){
  const [position,setPosition]=useState(results[0]?.position??null),[mentorOpen,setMentorOpen]=useState(false)
  const subjects=useMemo(()=>[...new Set(results.map(q=>q.subject).filter(Boolean))],[results])
  const visible=useMemo(()=>filteredReview(results,filter,subject,trapPositions),[results,filter,subject,trapPositions])
  const current=visible.find(q=>q.position===position)||visible[0],index=current?visible.findIndex(q=>q.position===current.position):-1
  const outcome=current?reviewOutcome(current):null,trap=current&&trapPositions.has(current.position)
  return <section className="rv-review-section" id="review-questions"><div className="rv-review-intro"><div><div className="rv-kicker">REVIEW &amp; LEARN</div><h2>Your questions, your next step.</h2><p>Filter by outcome, pace or subject; then choose a solution method.</p></div><label>View in <select value={lang} onChange={event=>onLanguage(event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></label></div>
    <div className="rv-filter-bar"><div className="rv-filter-buttons" role="group" aria-label="Review filters">{FILTERS.map(([key,name])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{name}</button>)}</div><label>Subject <select aria-label="Filter by subject" value={subject} onChange={event=>setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map(value=><option key={value} value={value}>{subjectName(value)}</option>)}</select></label></div>
    <div className="cc-review-layout"><div className="cc-card cc-review-question">{current?<><div className="cc-question-top" aria-live="polite" aria-atomic="true"><span>QUESTION {current.position} · {index+1} OF {visible.length}</span><Status tone={outcome==='correct'?'green':outcome==='wrong'?'orange':'muted'}>{outcomeLabel[outcome]}</Status></div>
      {current.not_delivered?<div className="cc-review-empty">This question was not delivered before submission; its content is not shown.</div>:current.content_withdrawn?<div className="cc-review-empty">This content was withdrawn and is no longer displayed. Your score history is preserved.</div>:<><div className="rv-question-meta"><span>{subjectName(current.subject)}</span>{Number(current.time_spent_ms)>0&&<span><Clock3 size={13}/> {seconds(current.time_spent_ms/1000)} tracked{current.time_source==='device_only'?' · this device only':''}</span>}{trap&&<span className="rv-trap-pill"><AlertTriangle size={13}/> Time trap · &gt;2× ideal</span>}</div><QuestionContent question={current} lang={lang}/><Solution key={current.position} question={current} lang={lang}/></>}
      <div className="rv-mentor-entry"><div><span><Sparkles size={17}/></span><div><strong>Stuck on this question?</strong><small>{current.not_delivered||current.content_withdrawn||current.answer_status==='Void'?'Mentor is unavailable for undelivered, withdrawn or void questions.':'Get a focused explanation after submission.'}</small></div></div><button disabled={!!(current.not_delivered||current.content_withdrawn||current.answer_status==='Void')} onClick={()=>setMentorOpen(true)}><Sparkles size={14}/> Ask AI Mentor</button></div>
      <div className="cc-question-controls"><button className="cc-outline-button" disabled={index<=0} onClick={()=>setPosition(visible[index-1].position)}><ChevronLeft size={15}/> Previous</button><button className="cc-primary-button" disabled={index>=visible.length-1} onClick={()=>setPosition(visible[index+1].position)}>Next question <ChevronRight size={15}/></button></div></>:<div className="cc-review-empty">No questions match these filters. Try another filter or subject.</div>}</div>
      <aside className="cc-card cc-palette"><strong>Question navigator</strong><p>{visible.length} matching questions · Scroll for more</p><div>{visible.map(q=>{const result=reviewOutcome(q);return <button key={q.position} className={`${current?.position===q.position?'is-current':''} ${result==='correct'?'is-correct':result==='wrong'?'is-wrong':''}`} onClick={()=>setPosition(q.position)} aria-label={`Review question ${q.position}, ${outcomeLabel[result]}`} aria-current={current?.position===q.position?'true':undefined}>{q.position}</button>})}</div></aside>
    </div>
    {mentorOpen&&current&&<MentorDrawer key={current.position} mockId={mockId} position={current.position} lang={lang} onClose={()=>setMentorOpen(false)}/>}
  </section>
}

export default function CglReview({data,lang,scope,onLanguage}){
  const {mock,summary,results=[]}=data,analytics=data.analytics,[category,setCategory]=useState('UR'),[filter,setFilter]=useState('all'),[subject,setSubject]=useState('all')
  const screening=analytics?.screening,merit=analytics?.merit,score=merit?.score??screening?.score??summary.score,max=merit?.max_score??screening?.max_score??summary.max_score
  const timed=useMemo(()=>mergeReviewTimes(results,analytics?.timing,questionTimes(scope,mock.id)),[results,analytics?.timing,scope,mock.id])
  const trapPositions=useMemo(()=>new Set((timed.timing?.time_traps||[]).map(item=>item.position)),[timed.timing?.time_traps])
  function seeTraps(){setFilter('traps');setSubject('all');document.getElementById('review-questions')?.scrollIntoView({behavior:'smooth'})}
  return <div className="cc-review-wrap rv-page"><div className="cc-review-head"><div><div className="rv-kicker">SESSION COMPLETE · PRACTICE</div><h1>Every question is progress.</h1><p>{mock.title}</p></div><button className="cc-outline-button" onClick={()=>navigate('/analytics')}>View all analytics <ArrowRight size={15}/></button></div>
    <div className="cc-review-stats rv-summary"><div><small>{merit?'TIER II MERIT COMPONENT':screening?'TIER I RAW SCORE':'PRACTICE SCORE'}</small><strong>{number(score)} <span>/ {number(max)}</span></strong><p>{merit?'Computer is separate':'+ marks after negative marking'}</p></div><div><small>CORRECT</small><strong>{number(summary.correct)}</strong><p>Questions</p></div><div><small>WRONG</small><strong>{number(summary.wrong)}</strong><p>Questions</p></div><div><small>SKIPPED</small><strong>{number(summary.skipped)}</strong><p>Includes undelivered</p></div></div>
    {(screening||merit||analytics?.computer?.assessments)&&<div className="rv-category"><label htmlFor="rv-category-select">Minimum-standard comparison</label><select id="rv-category-select" value={category} onChange={event=>setCategory(event.target.value)}>{CATEGORIES.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select><small>UR is the default assumption; selection stays on this screen.</small></div>}
    {screening&&<p className="rv-standard-line">Tier I {CATEGORIES.find(c=>c[0]===category)?.[1]} minimum: <strong>{number(screening.minimums[category])} / 200</strong>. This is not a competitive cutoff or a selection result. <SourceLink href={analytics.notice_url}>SSC notice</SourceLink></p>}
    <MeritPanel analytics={analytics} category={category}/>
    {mock.category==='Full_Tier2'&&<DestLink mockId={mock.id}/>}
    {screening&&<div className="rv-insight-grid"><Targets key={scope} scope={scope} scores={analytics.subject_scores}/><Simulation mock={mock} screening={screening} noticeUrl={analytics.projection.normalization_notice_url}/></div>}
    <TimeAnalysis timing={timed.timing} onSeeTraps={seeTraps} deviceOnlyCount={timed.deviceOnlyCount}/>
    {!analytics&&<p className="rv-inline-warning">Detailed analytics are unavailable from this version of the practice service. Your saved scores remain intact.</p>}
    <ReviewQuestions results={timed.results} lang={lang} onLanguage={onLanguage} filter={filter} setFilter={setFilter} subject={subject} setSubject={setSubject} trapPositions={trapPositions} mockId={mock.id}/>
    <p className="rv-footer-note"><BarChart3 size={14}/> Practice analytics use saved answers and approximate client-reported time. They do not represent official SSC results.</p>
  </div>
}
