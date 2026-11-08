import React from 'react'
import {BarChart3,BookOpen,ChevronRight,ClipboardList,FileClock,Home,Moon,Newspaper,Settings2,Sun,Target} from 'lucide-react'
import {navigate} from '../lib/router'
import {useStore} from '../lib/store'
import {useL} from '../lib/i18n'
import {useCglStage} from '../lib/cglData'

const nav=[
  {id:'home',path:'/',icon:Home,en:'Dashboard',hi:'डैशबोर्ड',mobile:'Home'},
  {id:'mocks',path:'/mocks',icon:ClipboardList,en:'Mock Test Hub',hi:'मॉक टेस्ट हब',mobile:'Mocks'},
  {id:'practice',path:'/practice',icon:BookOpen,en:'Subject Practice',hi:'विषय अभ्यास',mobile:'Practice'},
  {id:'pyq',path:'/pyq',icon:FileClock,en:'PYQ Vault',hi:'पिछले पेपर',mobile:'PYQ'},
  {id:'current-affairs',path:'/current-affairs',icon:Newspaper,en:'Current Affairs',hi:'करेंट अफेयर्स',mobile:'CA'},
]
const current=route=>route.path.split('?')[0].split('/').filter(Boolean)[0]||'home'
export function CglSidebar({route}){
  const {state}=useStore(),L=useL(),active=current(route),accountName=state.auth?.user?.name||state.profile?.name||'Aspirant'
  return <aside className="cc-sidebar" aria-label="Main navigation">
    <button className="cc-brand" onClick={()=>navigate('/')} aria-label="ExamEdge dashboard"><span className="cc-brand-mark"><Target size={21} strokeWidth={2.4}/></span><span><strong>Exam<span>Edge</span></strong><small>SSC CGL COMMAND CENTER</small></span></button>
    <div className="cc-sidebar-label">{L({en:'WORKSPACE',hi:'वर्कस्पेस'})}</div>
    <nav className="cc-side-nav" aria-label="SSC CGL workspace">{nav.map(item=>{const Icon=item.icon,selected=active===item.id;return <button key={item.id} className={`cc-nav-item ${selected?'is-active':''}`} onClick={()=>navigate(item.path)} aria-current={selected?'page':undefined}><Icon size={19}/><span>{L(item)}</span>{selected&&<ChevronRight size={15} className="cc-nav-arrow"/>}</button>})}</nav>
    <div className="cc-sidebar-label cc-insights-label">{L({en:'YOUR PROGRESS',hi:'आपकी प्रगति'})}</div>
    <nav className="cc-side-nav" aria-label="Progress and settings">
      <button className={`cc-nav-item ${active==='analytics'?'is-active':''}`} onClick={()=>navigate('/analytics')} aria-current={active==='analytics'?'page':undefined}><BarChart3 size={19}/><span>{L({en:'Analytics',hi:'विश्लेषण'})}</span></button>
      <button className={`cc-nav-item ${active==='settings'?'is-active':''}`} onClick={()=>navigate('/settings')} aria-current={active==='settings'?'page':undefined}><Settings2 size={19}/><span>{L({en:'Settings',hi:'सेटिंग्स'})}</span></button>
    </nav>
    <div className="cc-sidebar-bottom"><div className="cc-side-note"><span><Target size={17}/></span><div><strong>{L({en:'One goal. Your pace.',hi:'एक लक्ष्य। अपनी गति।'})}</strong><small>{L({en:'A quieter space to prepare.',hi:'तैयारी के लिए सरल जगह।'})}</small></div></div>
      <button className="cc-account" onClick={()=>navigate('/profile')}><span className="cc-avatar">{accountName[0].toUpperCase()}</span><span><strong>{accountName}</strong><small>{L({en:'View profile',hi:'प्रोफ़ाइल देखें'})}</small></span><ChevronRight size={16}/></button>
    </div>
  </aside>
}
export function StageSwitcher({compact=false}){
  const [stage,setStage]=useCglStage(),L=useL()
  return <div className={`cc-stage-switch ${compact?'is-compact':''}`} role="group" aria-label="SSC CGL stage">
    <button onClick={()=>setStage('Tier_1')} className={stage==='Tier_1'?'is-active':''} aria-pressed={stage==='Tier_1'} aria-label="SSC CGL Tier-1 (Prelims)" title="SSC CGL Tier-1 (Prelims)"><span>{L({en:'Tier 1',hi:'टियर 1'})}</span><small>{L({en:'Prelims',hi:'प्रिलिम्स'})}</small></button>
    <button onClick={()=>setStage('Tier_2')} className={stage==='Tier_2'?'is-active':''} aria-pressed={stage==='Tier_2'} aria-label="SSC CGL Tier-2 (Mains)" title="SSC CGL Tier-2 (Mains)"><span>{L({en:'Tier 2',hi:'टियर 2'})}</span><small>{L({en:'Mains',hi:'मेन्स'})}</small></button>
  </div>
}
export function CglTopBar({route}){
  const {state,updateSettings}=useStore(),L=useL(),active=current(route),accountName=state.auth?.user?.name||state.profile?.name||'Aspirant'
  const labels={home:'Dashboard',mocks:'Mock Test Hub',practice:'Subject Practice',pyq:'PYQ Vault','current-affairs':'Current Affairs',analytics:'Analytics',profile:'Profile',settings:'Settings'}
  return <header className="cc-topbar"><div className="cc-mobile-mark"><Target size={18}/></div><div className="cc-breadcrumb"><span>SSC CGL</span><ChevronRight size={14}/><strong>{labels[active]||'Workspace'}</strong></div><div className="cc-top-right"><div className="cc-stage-label">{L({en:'YOUR STAGE',hi:'आपका स्तर'})}</div><StageSwitcher/><span className="cc-top-separator"/><button className="cc-icon-button" aria-label="Toggle theme" onClick={()=>updateSettings({theme:state.settings.theme==='dark'?'light':'dark'})}>{state.settings.theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><button className="cc-top-profile" onClick={()=>navigate('/profile')} aria-label="Open profile"><span className="cc-avatar">{accountName[0].toUpperCase()}</span><span>{accountName}</span><ChevronRight size={14}/></button></div></header>
}
export function CglBottomNav({route}){
  const active=current(route)
  return <nav className="cc-bottom-nav" aria-label="Main navigation">{nav.map(item=>{const Icon=item.icon,selected=active===item.id;return <button key={item.id} onClick={()=>navigate(item.path)} className={selected?'is-active':''} aria-current={selected?'page':undefined}><Icon size={19}/><span>{item.mobile}</span></button>})}</nav>
}
