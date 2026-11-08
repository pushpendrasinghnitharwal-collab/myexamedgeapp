import React,{useState} from 'react'
import {ArrowRight,CalendarDays,ChevronRight,Globe2,Layers3,Newspaper} from 'lucide-react'
import {api} from '../lib/api'
import {useStore} from '../lib/store'
import {useCglStage,useResource} from '../lib/cglData'
import {CA_CATEGORIES,MONTHS,STAGES,coverageLabel} from '../lib/cglModel'
import {Notice,PageHeader,SectionHeading,Status,usePrepare} from '../components/CglUI'

function chosenCoverage(entry,category){return category==='All'?entry:entry?.categories?.find(c=>c.category===category)}
export default function CglCurrentAffairs(){
  const {state}=useStore(),[stage]=useCglStage(),[year,setYear]=useState(new Date().getFullYear()>=2026?2026:2025),[category,setCategory]=useState('All')
  const coverage=useResource(`ca-coverage:${stage}`,()=>api.caCoverage(stage)),formats=useResource('master-formats',()=>api.masterFormats()),{prepare,busy,error,user}=usePrepare()
  const months=coverage.data?.months||[],annual=coverage.data?.annual||[],ready=formats.data?.assembler?.ok===true
  const categoryLabel=CA_CATEGORIES.find(c=>c.code===category),categoryMode=category!=='All'
  function start(entry,kind,y,month){
    const selected=chosenCoverage(entry,category)
    if(!selected?.mock_id)return
    prepare({category:kind==='Annual'?'CA_Annual':'CA_Monthly',stage,year:y,...(month?{month}:{}),...(categoryMode?{ca_category:category}:{})})
  }
  return <div className="cc-page"><PageHeader eyebrow="2025–2026 · CURRENT AFFAIRS" title="Stay curious. Stay current." description="A clear, source-reviewed space for the stories that matter."/>
    <div className="cc-info-strip">{state.settings.cglTiming==='official_2026'?'Notice profile: current-affairs drills are untimed.':'Exam-hall practice: monthly 30 min · annual 60 min · category 15 min.'} Change the profile in Mock Test Hub.</div>
    <div className="cc-ca-hero"><div><div className="cc-ca-hero-kicker"><Globe2 size={15}/> CURRENT AFFAIRS ARENA</div><h2>Keep your knowledge<br/><em>in motion.</em></h2><p>Explore monthly mocks, yearly revision and topic-wise drills.</p></div><div className="cc-ca-orbit" aria-hidden="true"><Globe2 size={55}/><span>2025</span><span>2026</span></div></div>
    <div className="cc-ca-toolbar"><div><span className="cc-tool-label">CHOOSE A YEAR</span><div className="cc-year-switch" role="group" aria-label="Current affairs year">{[2025,2026].map(y=><button key={y} className={year===y?'is-active':''} aria-pressed={year===y} onClick={()=>setYear(y)}>{y}</button>)}</div></div><div className="cc-ca-category"><span className="cc-tool-label">CATEGORIES</span><div className="cc-pills">{CA_CATEGORIES.map(c=><button key={c.code} className={category===c.code?'is-active':''} aria-pressed={category===c.code} onClick={()=>setCategory(c.code)}>{c.name}</button>)}</div></div></div>
    {coverage.error&&<Notice>Content status is unavailable while the current-affairs service is disconnected.</Notice>}{!coverage.error&&(formats.error||formats.data?.assembler?.ok===false)&&<Notice>Published content cannot be started until the mock service is connected.</Notice>}{error&&<Notice>{error}</Notice>}
    {categoryLabel?.detail&&<p className="cc-category-note">{categoryLabel.name} currently covers {categoryLabel.detail.toLowerCase()} in the reviewed CA catalogue.</p>}
    <div className="cc-spaced"><SectionHeading eyebrow={`${year} · MONTH BY MONTH`} title="Monthly mock calendar" description={categoryMode?`${categoryLabel.name} drills · 20 questions when published`:'12 months of focused revision · 50 questions per mock'}/></div>
    <div className="cc-month-grid">{MONTHS.map((name,index)=>{
      const month=index+1,entry=months.find(x=>x.year===year&&x.month===month),selected=chosenCoverage(entry,category),available=selected?.status==='Available'&&!!selected.mock_id
      const status=coverage.loading?'Checking…':coverageLabel(selected?.status)
      return <div className="cc-card cc-month-card" key={name}><div className="cc-month-top"><span className="cc-month-icon"><CalendarDays size={17}/></span><span className="cc-month-number">{String(month).padStart(2,'0')}</span></div><h3>{name}</h3><p>{year} · {categoryMode?'20 Q drill':'50 Q mock'}</p><div className="cc-month-status"><Status tone={available?'green':'muted'}>{status}</Status>{selected&&selected.status!=='Available'&&<small>{selected.available_questions} / {selected.required_questions} reviewed</small>}{selected?.snapshot_stale&&<small>Snapshot through {selected.snapshot_period_end}</small>}</div><button className="cc-month-action" disabled={!available||!ready||busy} onClick={()=>start(entry,'Monthly',year,month)}>{coverage.loading?'Checking…':coverage.error?'Status unavailable':available?(!user?'Sign in to start':'Start practice'):'Not available yet'} <ArrowRight size={14}/></button></div>
    })}</div>
    <div className="cc-spaced"><SectionHeading eyebrow="THE BIG PICTURE" title="Full-year bumper mocks" description="Bring the year together in one focused revision."/></div>
    <div className="cc-annual-grid">{[2025,2026].map(y=>{const entry=annual.find(a=>a.year===y),selected=chosenCoverage(entry,category),available=selected?.status==='Available'&&!!selected.mock_id
      return <div className={`cc-annual-card ${year===y?'is-selected':''}`} key={y}><span className="cc-annual-icon"><Layers3 size={22}/></span><div><div className="cc-card-overline">{y} · {STAGES[stage].short.toUpperCase()}</div><h3>{y} {categoryMode?`${categoryLabel.name} drill`:'Full-Year Bumper'}</h3><p>{categoryMode?'20-question category drill':'100 questions · complete year coverage'}</p><Status tone={available?'green':'muted'}>{coverage.loading?'Checking…':coverageLabel(selected?.status)}</Status>{selected?.snapshot_stale&&<p>Snapshot through {selected.snapshot_period_end}</p>}</div><button disabled={!available||!ready||busy} onClick={()=>start(entry,'Annual',y)} aria-label={`Start ${y} ${categoryMode?'category drill':'full-year mock'}`}><ChevronRight size={19}/></button></div>})}</div>
    <p className="cc-data-note"><Newspaper size={14}/> Future periods and unpublished mocks remain pending; no current-affairs facts are invented.</p>
  </div>
}
