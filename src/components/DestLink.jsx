import React from 'react'
import {ArrowRight,Keyboard} from 'lucide-react'
import {navigate} from '../lib/router'

export default function DestLink({from='dashboard',mockId}){
  const path=mockId?`/dest?mock=${encodeURIComponent(mockId)}`:from==='mocks'?'/dest?from=mocks':'/dest'
  return <section className="cc-dest-link" aria-label="Mains Typing Test DEST"><span className="cc-dest-link-icon"><Keyboard size={21}/></span><div><small>TIER II · SEPARATE QUALIFYING PRACTICE</small><h2>Mains Typing Test <em>(DEST)</em></h2><p>15 minutes · 2,000-character original passages · separate from MCQ scores</p></div><button onClick={()=>navigate(path)}>Practice DEST <ArrowRight size={15}/></button></section>
}
