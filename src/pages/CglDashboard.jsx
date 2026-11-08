import React from 'react'
import {ArrowRight,BarChart3,BookOpen,CalendarDays,CheckCircle2,ChevronRight,Clock3,FileClock,Flame,Layers3,Newspaper,Sparkles,Target} from 'lucide-react'
import {api} from '../lib/api'
import {useStore,useCurrentStreak} from '../lib/store'
import {navigate} from '../lib/router'
import {useCglStage,useCglInsights,useCglSummary,useResource} from '../lib/cglData'
import {STAGES} from '../lib/cglModel'
import {SectionHeading,SourceLink,TextLink} from '../components/CglUI'
import DestLink from '../components/DestLink'

const iconMap={Quant:'Q',Reasoning:'R',English:'E',General_Awareness:'G',Computer_Knowledge:'C'}
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
export function Radar({stage,insights,loading=false,incomplete=false}){
  const hasData=insights.answered>0
  return <section className="cc-card cc-radar" aria-labelledby="radar-title"><div className="cc-card-heading"><div><div className="cc-eyebrow">YOUR PERFORMANCE</div><h2 id="radar-title">Weak Topic Radar</h2><p>Accuracy and pace, by subject.</p></div><span className="cc-heading-icon"><BarChart3 size={19}/></span></div>
    <div className="cc-radar-labels"><span>SUBJECT</span><span>ACCURACY</span><span>AVG / Q</span></div>
    <div className="cc-radar-list">{insights.rows.map(row=>{
      const inactive=stage==='Tier_1'&&row.code==='Computer_Knowledge',accuracy=inactive?null:row.accuracy
      return <div className={`cc-radar-row ${inactive?'is-muted':''}`} key={row.code}><div className="cc-radar-subject"><span className={`cc-subject-mini ${row.color}`}>{iconMap[row.code]}</span><span>{row.short}<small>{inactive?'Tier 2 only':''}</small></span></div><div className="cc-radar-accuracy"><span className="cc-accuracy-track"><i style={{width:`${accuracy??0}%`}}/></span><strong>{accuracy===null?'—':`${accuracy}%`}</strong></div><span className="cc-radar-speed">{inactive||row.avgSeconds===null?'—':`${row.avgSeconds}s`}</span></div>
    })}</div>
    <div className="cc-radar-foot"><span>{loading?'Loading your recent tests…':incomplete?'Some reviews could not be loaded.':hasData?'Pace uses recorded foreground time.':'Complete a test to unlock your radar.'}</span><button onClick={()=>navigate('/analytics')} aria-label="View analytics"><ArrowRight size={16}/></button></div>
  </section>
}
export default function CglDashboard(){
  const {state}=useStore(),[stage]=useCglStage(),{history,reviews,insights,user}=useCglInsights(stage)
  const localStreak=useCurrentStreak(),format=STAGES[stage],summary=useCglSummary(),capsule=useResource('ca-capsule',()=>api.caCapsule())
  const mocks=history.data?.mocks||[]
  const streak=user?(summary.data?.current_streak??null):localStreak
  const name=(user?.name||state.profile?.name||'Aspirant').trim().split(/\s+/)[0]||'Aspirant'
  const weakest=insights.weak[0],reviewLoading=history.loading||reviews.loading
  const metrics=[
    {label:'Tests completed',value:user&&summary.data?summary.data.stages[stage]:'—',note:`${format.short} practice`,icon:Layers3,tone:'violet'},
    {label:'Questions answered',value:insights.answered||'—',note:'From recent reviews',icon:CheckCircle2,tone:'blue'},
    {label:'Accuracy',value:insights.accuracy===null?'—':`${insights.accuracy}%`,note:'Across answered questions',icon:Target,tone:'orange'},
    {label:'Average pace',value:insights.avgSeconds===null?'—':`${insights.avgSeconds}s`,note:'Per tracked question',icon:Clock3,tone:'green'},
  ]
  const ca=capsule.data?.capsule
  const practicePath=weakest?`/practice?subject=${encodeURIComponent(weakest.subject)}&topic=${encodeURIComponent(weakest.topic)}`:'/practice'
  return <div className="cc-page cc-dashboard">
    <div className="cc-welcome"><div><div className="cc-eyebrow"><span/> YOUR SSC CGL WORKSPACE</div><h1>{greet()}, {name}<span className="cc-wave">.</span></h1><p>A little focus today. A stronger you tomorrow.</p></div><div className="cc-date"><CalendarDays size={16}/>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</div></div>
    <div className="cc-metrics">{metrics.map(({label,value,note,icon:Icon,tone})=><div className="cc-metric" key={label}><span className={`cc-metric-icon ${tone}`}><Icon size={19}/></span><div><small>{label}</small><strong>{value}</strong><span>{note}</span></div></div>)}</div>
    <div className="cc-dashboard-grid"><section className="cc-target-card" aria-labelledby="today-title"><div className="cc-target-top"><div className="cc-target-copy"><div className="cc-target-kicker"><Sparkles size={14}/> TODAY'S CGL TARGET</div><h2 id="today-title">Your next step<br/><em>starts here.</em></h2><p>A simple plan for a more focused day.</p><button className="cc-light-button" onClick={()=>navigate('/mocks')}>Explore mock tests <ArrowRight size={15}/></button></div><div className="cc-streak-box"><span><Flame size={18}/></span><div><strong>{streak===null?'—':streak} <small>{streak===1?'day':'days'}</small></strong><p>{user?'practice streak · IST':'device streak'}</p></div></div></div>
      <div className="cc-target-items"><button className="cc-target-item" onClick={()=>navigate('/mocks')}><span className="cc-task-icon violet"><ClipboardIcon/></span><span><small>01 / RECOMMENDED MOCK</small><strong>{format.short} Full Mock</strong><em>{format.questions} questions · {format.minutes} minutes</em></span><ChevronRight size={18}/></button>
      <button className="cc-target-item" onClick={()=>navigate(practicePath)}><span className="cc-task-icon orange"><Target size={19}/></span><span><small>02 / WEAK-TOPIC DRILL</small><strong>{weakest?weakest.topic:'Find your focus'}</strong><em>{weakest?`${weakest.accuracy}% accuracy · ${weakest.answered} answered`:'Personalized after your first test'}</em></span><ChevronRight size={18}/></button>
      <div className="cc-target-item cc-ca-task"><span className="cc-task-icon green"><Newspaper size={19}/></span><span><small>03 / DAILY CA CAPSULE</small><strong>{ca?ca.title_en:'Your daily current affairs'}</strong><em>{ca?`Reviewed event · ${ca.event_date}`:capsule.loading?'Checking for reviewed updates…':capsule.error?'Connect the practice service to check':'Awaiting reviewed content'}</em>{ca&&<span className="cc-capsule-fact">{ca.fact_en} <SourceLink href={ca.source_url}/></span>}</span><button onClick={()=>navigate('/current-affairs')} aria-label="Open current affairs"><ChevronRight size={18}/></button></div></div>
    </section><Radar stage={stage} insights={insights} loading={reviewLoading} incomplete={!!history.error||!!reviews.data?.failed}/></div>
    <DestLink/>
    <div className="cc-quick-head"><SectionHeading eyebrow="PICK UP WHERE YOU LEFT OFF" title="Your preparation, in one place" description="Choose what you want to focus on next." action={<TextLink onClick={()=>navigate('/mocks')}>View all mocks</TextLink>}/></div>
    <div className="cc-quick-grid">{[
      {icon:Layers3,tone:'violet',title:'Full & sectional mocks',sub:`${format.short} exam pattern`,path:'/mocks'},
      {icon:BookOpen,tone:'blue',title:'Subject practice',sub:'Build a focused drill',path:'/practice'},
      {icon:FileClock,tone:'orange',title:'Previous year papers',sub:'Explore 2021–2025',path:'/pyq'},
      {icon:Newspaper,tone:'green',title:'Current affairs',sub:'2025 & 2026 arena',path:'/current-affairs'},
    ].map(({icon:Icon,tone,title,sub,path})=><button className="cc-quick-card" key={path} onClick={()=>navigate(path)}><span className={`cc-quick-icon ${tone}`}><Icon size={20}/></span><span><strong>{title}</strong><small>{sub}</small></span><ArrowRight size={16}/></button>)}</div>
    {!user&&<p className="cc-data-note">Have a practice account? <button onClick={()=>navigate('/profile?backend=1')}>Sign in</button> to see your own mock history. Google sign-in is separate.</p>}
    {user&&history.error&&<p className="cc-data-note">{history.error.status===401?<>Your practice session has expired. <button onClick={()=>navigate('/profile?backend=1')}>Sign in again</button>.</>:'Practice history is currently unavailable. Your saved data has not been removed.'}</p>}
    {user&&mocks.filter(m=>m.status==='Submitted').length>20&&<p className="cc-data-note">Radar uses up to your 20 most recent submitted mock reviews in this stage.</p>}
  </div>
}
function ClipboardIcon(){return <Layers3 size={19}/>}
