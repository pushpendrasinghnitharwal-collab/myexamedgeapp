// Format counts are 2026 SSC Paper I subject/module rules; topic labels and
// difficulty choices are application navigation, not official frequencies.
export const STAGES = {
  Tier_1: { short: 'Tier 1', name: 'Prelims', label: 'SSC CGL Tier-1 (Prelims)', questions: 100, minutes: 60, marks: '+2 / −0.5' },
  Tier_2: { short: 'Tier 2', name: 'Mains', label: 'SSC CGL Tier-2 (Mains)', questions: 150, minutes: 135, marks: '+3 / −1' },
}
export const SUBJECTS = [
  { code: 'Quant', name: 'Quantitative Aptitude', short: 'Quant', color: 'violet', initial: 'Q' },
  { code: 'Reasoning', name: 'Reasoning', short: 'Reasoning', color: 'blue', initial: 'R' },
  { code: 'English', name: 'English Language', short: 'English', color: 'orange', initial: 'E' },
  { code: 'General_Awareness', name: 'General Awareness', short: 'GA', color: 'green', initial: 'G' },
  { code: 'Computer_Knowledge', name: 'Computer Knowledge', short: 'Computer', color: 'rose', initial: 'C' },
]
export const stageSubjects = stage => SUBJECTS.filter(s => stage === 'Tier_2' || s.code !== 'Computer_Knowledge')
export const fullSpec = stage => ({ category: stage === 'Tier_2' ? 'Full_Tier2' : 'Full_Tier1' })
export const sectionals = stage => stage === 'Tier_2' ? [
  { id: 'Section_I', name: 'Section I', detail: 'Quant + Reasoning', count: 60, minutes: 60, color: 'violet' },
  { id: 'Section_II', name: 'Section II', detail: 'English + General Awareness', count: 70, minutes: 60, color: 'blue' },
  { id: 'Section_III', name: 'Section III', detail: 'Computer Knowledge', count: 20, minutes: 15, color: 'orange' },
] : stageSubjects(stage).map(s => ({ id: s.code, name: s.name, detail: `${s.short} sectional`, count: 25, minutes: 15, color: s.color }))
export const sectionSpec = (stage, id) => stage === 'Tier_2' ? { category: 'Sectional_Tier2', section: id } : { category: 'Sectional_Tier1', subject: id }
export const YEARS = [2021, 2022, 2023, 2024, 2025]
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const CA_CATEGORIES = [
  { code: 'All', name: 'All topics' }, { code: 'Awards', name: 'Awards' },
  { code: 'Sports', name: 'Sports' }, { code: 'Schemes', name: 'Schemes' },
  { code: 'Military_Exercises', name: 'Defence', detail: 'Military exercises' },
  { code: 'Rankings_Indexes', name: 'Index', detail: 'Rankings & indexes' },
]
export function coverageLabel(status) {
  return ({ Available:'Available', Awaiting_Content:'Awaiting content', Ready_To_Assemble:'Awaiting review',
    Awaiting_Month_Coverage:'Coverage incomplete', In_Progress:'In progress', Upcoming:'Upcoming' })[status] || 'Status unavailable'
}
export function normalizeSubject(value) {
  const key=String(value || '').toLowerCase().replace(/[^a-z]/g,'')
  return ({quant:'Quant',quantitativeaptitude:'Quant',mathematicalabilities:'Quant',reasoning:'Reasoning',generalintelligence:'Reasoning',
    generalintelligenceandreasoning:'Reasoning',english:'English',englishlanguage:'English',englishlanguageandcomprehension:'English',
    generalawareness:'General_Awareness',ga:'General_Awareness',computerknowledge:'Computer_Knowledge',computer:'Computer_Knowledge'})[key] || null
}
// Reviews are authoritative for correctness. Player time is client-reported
// visible/focused activity, synced by the server or read from older local data.
export function calculateInsights(reviews, stage, getSeconds = () => null) {
  const bySubject = Object.fromEntries(SUBJECTS.map(s => [s.code, { answered:0, correct:0, timed:0, seconds:0 }]))
  const topics = new Map()
  for(const review of reviews || []){
    const mock=review?.mock
    if(mock?.exam_stage !== stage)continue
    for(const result of review.results || []){
      const subject=normalizeSubject(result.subject)
      if(!subject || result.not_delivered || result.content_withdrawn || typeof result.is_correct !== 'boolean')continue
      const row=bySubject[subject];row.answered++;if(result.is_correct)row.correct++
      const seconds=Number(result.time_spent_ms)>0?Number(result.time_spent_ms)/1000:getSeconds(mock.id,result.position)
      if(Number.isFinite(seconds) && seconds > 0){row.timed++;row.seconds+=seconds}
      if(result.topic){
        const key=`${subject}\0${result.topic}`,topic=topics.get(key)||{subject,topic:result.topic,answered:0,correct:0}
        topic.answered++;if(result.is_correct)topic.correct++;topics.set(key,topic)
      }
    }
  }
  const rows=SUBJECTS.map(subject=>{const s=bySubject[subject.code];return {...subject,...s,accuracy:s.answered?Math.round(s.correct/s.answered*100):null,avgSeconds:s.timed?Math.round(s.seconds/s.timed*10)/10:null}})
  const weak=[...topics.values()].map(t=>({...t,accuracy:Math.round(t.correct/t.answered*100)})).sort((a,b)=>a.accuracy-b.accuracy||b.answered-a.answered||a.topic.localeCompare(b.topic))
  const answered=rows.reduce((n,r)=>n+r.answered,0),correct=rows.reduce((n,r)=>n+r.correct,0),timed=rows.reduce((n,r)=>n+r.timed,0),seconds=rows.reduce((n,r)=>n+r.seconds,0)
  return { rows, weak, answered, accuracy:answered?Math.round(correct/answered*100):null, avgSeconds:timed?Math.round(seconds/timed*10)/10:null }
}
export function syllabusOptions(mappings, stage, subject) {
  const rows=(mappings||[]).filter(r=>r.subject===subject&&(r.exam_stage===stage||r.exam_stage==='Both'))
  return [...new Set(rows.map(r=>r.topic))].sort((a,b)=>a.localeCompare(b)).map(topic=>({topic,
    subtopics:[...new Set(rows.filter(r=>r.topic===topic).map(r=>r.sub_topic))].sort((a,b)=>a.localeCompare(b))}))
}
