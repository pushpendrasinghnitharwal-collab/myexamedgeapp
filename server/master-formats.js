import {ContentError,integer,onlyKeys,text} from './content-utils.js'
import {validId} from './ca-dates.js'
import {NOTICE_URL} from './data/ssc-cgl-official-blueprints.js'
import {CA_CATEGORY_CODES} from './data/ssc-cgl-ca-categories.js'

export const MASTER_CATEGORIES=['Full_Tier1','Full_Tier2','Sectional_Tier1','Sectional_Tier2','Micro','PYQ_Shift','PYQ_Topic','CA_Monthly','CA_Annual']
export const SUBJECTS=['Quant','Reasoning','English','General_Awareness','Computer_Knowledge']
export const TIER1_EDITORIAL_VERSION='tier1-editorial-practice-v1'
// The user-approved, exact practice profile fills all 25 questions per subject.
// SSC does not prescribe numerical topic counts or this difficulty distribution.
export const TIER1_EDITORIAL_TOPICS={
  Quant:{'Number Systems':2,'Fundamental Arithmetical Operations':10,Algebra:2,Geometry:3,Mensuration:2,Trigonometry:3,'Statistical Charts':3},
  Reasoning:{Analogy:3,Classification:2,Series:3,'Operations and Coding':3,'Spatial and Figural Reasoning':3,'Logical Reasoning':3,Intelligence:1,'General Intelligence':4,'Matching and Indexing':3},
  English:{Vocabulary:7,'Grammar and Usage':9,'Sentence Structure':4,Comprehension:5},
  General_Awareness:{'Current Events':6,'India and Neighbouring Countries':12,'Everyday Science':5,'Environment and Society':2},
}
export const TIER1_EDITORIAL_SETS={Data_Interpretation:2,Cloze_Test:5}
export const TIER1_DIFFICULTY={Easy:30,Medium:50,Hard:20}
const module=(code,section,subject,count,seconds,stage)=>({code,section,subject,question_count:count,duration_seconds:seconds,
  correct_marks:stage==='Tier_1'?2:3,wrong_deduction:stage==='Tier_1'?0.5:1,
  counts_for_merit:stage==='Tier_2'&&subject!=='Computer_Knowledge',qualifying_only:subject==='Computer_Knowledge'})
export const TIER1_MODULES=[module('Part_A','Tier_I','Reasoning',25,900,'Tier_1'),module('Part_B','Tier_I','General_Awareness',25,900,'Tier_1'),
  module('Part_C','Tier_I','Quant',25,900,'Tier_1'),module('Part_D','Tier_I','English',25,900,'Tier_1')]
export const TIER2_MODULES=[module('Section_I_A','Section_I','Quant',30,1800,'Tier_2'),module('Section_I_B','Section_I','Reasoning',30,1800,'Tier_2'),
  module('Section_II_A','Section_II','English',45,2400,'Tier_2'),module('Section_II_B','Section_II','General_Awareness',25,1200,'Tier_2'),
  module('Section_III','Section_III','Computer_Knowledge',20,900,'Tier_2')]
export const formatCatalog={
  notice_url:NOTICE_URL,notice_year:2026,
  timing_profiles:{default:'exam_hall_v1',exam_hall_v1:'Requested practice timing; not the 2026 official module locks.',official_2026:'2026 notice-based module locks.'},
  disclaimer:'Subject counts and marks follow the 2026 notice. The official_2026 timing profile follows its module locks; the default exam_hall_v1 timing is a user-requested non-official practice profile. Topic quotas and difficulty split are editorial, not official SSC/TCS frequencies.',
  full_tier1:{questions:100,duration_seconds:3600,modules:TIER1_MODULES,topic_profile_version:TIER1_EDITORIAL_VERSION,topic_counts:TIER1_EDITORIAL_TOPICS,set_question_counts:TIER1_EDITORIAL_SETS,difficulty_counts:TIER1_DIFFICULTY},
  full_tier2:{questions:150,duration_seconds:8100,modules:TIER2_MODULES,sections:[{code:'Section_I',questions:60,duration_seconds:3600},{code:'Section_II',questions:70,duration_seconds:3600},{code:'Section_III',questions:20,duration_seconds:900,qualifying_only:true}],dest:'Separate qualifying DEST is not included in the MCQ mock.'},
  tier1_sectionals:TIER1_MODULES,tier2_sectionals:['Section_I','Section_II','Section_III'],
  micro:{min_questions:15,max_questions:30,difficulty_filters:['Easy','Medium','Hard','Mains_Level'],duration_seconds:null},
  pyq:{cycle_years:[2021,2022,2023,2024,2025],uses_historical_rules:true},
  current_affairs:{years:[2025,2026],monthly_questions:50,annual_questions:100,category_questions:20},
}
const allowed={Full_Tier1:['category'],Full_Tier2:['category'],Sectional_Tier1:['category','subject'],Sectional_Tier2:['category','section'],
  Micro:['category','stage','subject','topic','sub_topic','count','difficulty'],PYQ_Shift:['category','paper_id'],
  PYQ_Topic:['category','stage','subject','chapter','sub_chapter','cycle_year','count'],CA_Monthly:['category','stage','year','month','ca_category'],CA_Annual:['category','stage','year','ca_category']}
function stage(value){if(!['Tier_1','Tier_2'].includes(value))throw new ContentError('stage must be Tier_1 or Tier_2');return value}
function subject(value,s){if(!SUBJECTS.includes(value)||(s==='Tier_1'&&value==='Computer_Knowledge'))throw new ContentError('Subject is not available in this stage');return value}
function optionalText(v,name){return v==null?null:text(v,name,{max:200})}
export function normalizeMasterSpec(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ContentError('Unknown master mock category')
  const {timing_profile='exam_hall_v1',...request}=raw
  if(!['exam_hall_v1','official_2026'].includes(timing_profile))throw new ContentError('Invalid timing profile')
  return {...normalizeBaseSpec(request),timing_profile}
}
function normalizeBaseSpec(raw){
  if(!raw||!MASTER_CATEGORIES.includes(raw.category))throw new ContentError('Unknown master mock category')
  const category=raw.category;onlyKeys(raw,allowed[category],'master mock request')
  if(category==='Full_Tier1')return {category,stage:'Tier_1'}
  if(category==='Full_Tier2')return {category,stage:'Tier_2'}
  if(category==='Sectional_Tier1')return {category,stage:'Tier_1',subject:subject(raw.subject,'Tier_1')}
  if(category==='Sectional_Tier2'){
    if(!['Section_I','Section_II','Section_III'].includes(raw.section))throw new ContentError('section must be Section_I, Section_II or Section_III')
    return {category,stage:'Tier_2',section:raw.section}
  }
  if(category==='Micro'){
    const s=stage(raw.stage),sub=subject(raw.subject,s),topic=optionalText(raw.topic,'topic'),sub_topic=optionalText(raw.sub_topic,'sub_topic')
    if(sub_topic&&!topic)throw new ContentError('sub_topic requires topic')
    const difficulty=raw.difficulty??null
    if(difficulty!==null&&!['Easy','Medium','Hard','Mains_Level'].includes(difficulty))throw new ContentError('Invalid difficulty filter')
    if(difficulty==='Mains_Level'&&s!=='Tier_2')throw new ContentError('Mains_Level requires Tier_2')
    return {category,stage:s,subject:sub,topic,sub_topic,count:integer(raw.count,'count',15,30),difficulty}
  }
  if(category==='PYQ_Shift')return {category,paper_id:validId(raw.paper_id)}
  if(category==='PYQ_Topic'){
    const s=raw.stage==null?null:stage(raw.stage)
    return {category,stage:s,subject:text(raw.subject,'subject',{max:120}),chapter:text(raw.chapter,'chapter',{max:200}),sub_chapter:optionalText(raw.sub_chapter,'sub_chapter'),
      cycle_year:raw.cycle_year==null?null:integer(raw.cycle_year,'cycle_year',2021,2025),count:integer(raw.count,'count',1,100)}
  }
  const s=stage(raw.stage),year=integer(raw.year,'year',2025,2026),ca_category=raw.ca_category??null
  if(ca_category!==null&&!CA_CATEGORY_CODES.includes(ca_category))throw new ContentError('Invalid current-affairs category')
  if(category==='CA_Monthly')return {category,stage:s,year,month:integer(raw.month,'month',1,12),...(ca_category?{ca_category}:{})}
  return {category,stage:s,year,...(ca_category?{ca_category}:{})}
}
export function modulesForSpec(spec){
  const clone=rows=>rows.map(row=>({...row}))
  if(spec.category==='Full_Tier1')return clone(TIER1_MODULES)
  if(spec.category==='Full_Tier2')return clone(TIER2_MODULES)
  if(spec.category==='Sectional_Tier1')return clone(TIER1_MODULES.filter(row=>row.subject===spec.subject))
  if(spec.category==='Sectional_Tier2')return clone(TIER2_MODULES.filter(row=>row.section===spec.section))
  if(spec.category==='Micro')return [module('Micro','Practice',spec.subject,spec.count,null,spec.stage)]
  if(spec.category==='PYQ_Topic')return [{code:'PYQ_Topic',section:'Historical_Practice',subject:spec.subject,question_count:spec.count,duration_seconds:spec.timing_profile==='exam_hall_v1'?spec.count*60:null,correct_marks:null,wrong_deduction:null,counts_for_merit:false,qualifying_only:false}]
  return null // Fixed published PYQ/CA source determines its own metadata.
}
export function titleForSpec(spec){
  if(spec.category==='Full_Tier1')return 'SSC CGL Tier I full-length practice mock'
  if(spec.category==='Full_Tier2')return 'SSC CGL Tier II Paper I MCQ practice mock'
  if(spec.category==='Sectional_Tier1')return `Tier I ${spec.subject} sectional practice`
  if(spec.category==='Sectional_Tier2')return `Tier II ${spec.section} sectional practice`
  if(spec.category==='Micro')return `${spec.stage} ${spec.subject}${spec.topic?` — ${spec.topic}`:''}${spec.sub_topic?` / ${spec.sub_topic}`:''} micro-mock`
  if(spec.category==='PYQ_Topic')return `${spec.subject} — ${spec.chapter} historical PYQ practice`
  return ''
}
