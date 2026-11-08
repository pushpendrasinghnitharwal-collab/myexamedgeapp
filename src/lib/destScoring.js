// A transparent practice approximation based on SSC's published categories.
// SSC does not publish a complete automated alignment/denominator algorithm.
// This is not an official result, and cannot reproduce every examiner decision.
export const DEST_DURATION_MS=15*60*1000
export const DEST_NOTICE_URL='https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf'
export const DEST_EVALUATION_URL='https://ssc.gov.in/api/attachment/uploads/masterData/ScriptEvaluation/evaluation-dest-tt%201-169635-.pdf'
export const DEST_2025_RESULT_URL='https://ssc.gov.in/api/attachment/uploads/masterData/Results/Write%20up_FTRA%20CGLE%20Exam%202025_08042026.pdf'
// 2025 higher-standard categories are deliberately not merged: SC/ST/ESM
// had 7%, while OH/HH/VH/PwD-Others had 10% in that result.
export const DEST_CATEGORIES=[
  {id:'UR',label:'UR',normal:20,historical:5},
  {id:'OBC_EWS',label:'OBC / EWS',normal:25,historical:7},
  {id:'SC_ST_ESM',label:'SC / ST / ESM',normal:30,historical:7},
  {id:'PWD',label:'OH / HH / VH / PwD-Others',normal:30,historical:10},
  {id:'OTHER',label:'Other categories',normal:30,historical:null},
]
export const DEST_MAX_INPUT=5000

function tokenize(text){
  const tokens=[],regex=/[\p{L}\p{N}]+/gu;let match,last=0
  while((match=regex.exec(text))){tokens.push({word:match[0],before:text.slice(last,match.index)});last=match.index+match[0].length}
  return {tokens,tail:text.slice(last)}
}
function editDistance(a,b){
  // Separators are normally tiny; avoid quadratic work on pasted/hostile input.
  if(a.length>200||b.length>200)return Math.max(a.length,b.length)
  let previous=Array.from({length:b.length+1},(_,i)=>i)
  for(let i=1;i<=a.length;i++){
    const next=[i]
    for(let j=1;j<=b.length;j++)next[j]=Math.min(previous[j]+1,next[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1))
    previous=next
  }
  return previous[b.length]
}
const punctuation=value=>value.replace(/\s/gu,'')
const whitespace=value=>value.replace(/\S/gu,'')
function separatorErrors(a,b){
  if(a===b)return 0
  const pa=punctuation(a),pb=punctuation(b),wa=whitespace(a),wb=whitespace(b)
  const punctuationEdits=editDistance(pa,pb)
  // One spacing event per affected word boundary; extra/missing spaces and
  // misplaced spaces are approximate rather than an SSC-certified classifier.
  const spacing=wa!==wb||(pa===pb&&a!==b)?1:0
  return punctuationEdits+spacing
}
function caseErrors(a,b){
  if(a.toLocaleLowerCase('en')!==b.toLocaleLowerCase('en'))return 0
  let errors=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])errors++
  return errors
}
const same=(a,b)=>a.toLocaleLowerCase('en')===b.toLocaleLowerCase('en')

export function scoreDest(reference,typed,{textKeydowns=0,backspaces=0,deletes=0,elapsedMs=DEST_DURATION_MS}={}){
  if(typeof reference!=='string'||!reference||typeof typed!=='string'||typed.length>DEST_MAX_INPUT)throw new Error('Invalid DEST text')
  if(reference.length>3000)throw new Error('DEST reference is too long')
  const {tokens:r,tail:rTail}=tokenize(reference),{tokens:t,tail:tTail}=tokenize(typed)
  if(!r.length||t.length>2500)throw new Error('DEST text has too many words')
  const width=t.length+1,size=(r.length+1)*width,inf=0xffffffff
  const costs=new Uint32Array(size);costs.fill(inf)
  const full=new Uint16Array(size),half=new Uint16Array(size),last=new Uint8Array(size)
  costs[0]=0
  function update(i,j,from,addFull,addHalf,operation){
    const index=i*width+j,nFull=full[from]+addFull,nHalf=half[from]+addHalf
    // Prefer matching words over falsely classifying many case differences as
    // full deletion and insertion errors. Then minimize half mistakes.
    if(costs[index]===inf||nFull<full[index]||(nFull===full[index]&&nHalf<half[index])){costs[index]=0;full[index]=nFull;half[index]=nHalf;last[index]=operation}
  }
  for(let i=0;i<=r.length;i++)for(let j=0;j<=t.length;j++){
    const at=i*width+j;if(costs[at]===inf)continue
    // A skipped/added word changes its surrounding boundary. Do not charge
    // an additional spacing error for the same omitted or inserted word.
    const compareGap=(i===0&&j===0)||[1,4,5,6].includes(last[at])
    const outerGap=(i<r.length&&j<t.length&&compareGap)?separatorErrors(r[i].before,t[j].before):0
    if(i<r.length&&j<t.length){
      const equal=same(r[i].word,t[j].word)
      update(i+1,j+1,at,equal?0:1,(equal?caseErrors(r[i].word,t[j].word):0)+outerGap,1)
    }
    if(i<r.length)update(i+1,j,at,1,0,2)
    if(j<t.length)update(i,j+1,at,1,0,3)
    if(i+1<r.length&&j<t.length&&r[i+1].before.length>0&&same(r[i].word+r[i+1].word,t[j].word))
      update(i+2,j+1,at,0,separatorErrors(r[i+1].before,'')+caseErrors(r[i].word+r[i+1].word,t[j].word)+outerGap,4)
    if(i<r.length&&j+1<t.length&&t[j+1].before.length>0&&same(r[i].word,t[j].word+t[j+1].word))
      update(i+1,j+2,at,0,separatorErrors('',t[j+1].before)+caseErrors(r[i].word,t[j].word+t[j+1].word)+outerGap,5)
    if(i+1<r.length&&j+1<t.length&&r[i+1].before.length>0&&t[j+1].before.length>0&&same(r[i].word,t[j+1].word)&&same(r[i+1].word,t[j].word))
      update(i+2,j+2,at,0,1+caseErrors(r[i].word,t[j+1].word)+caseErrors(r[i+1].word,t[j].word)+outerGap+separatorErrors(r[i+1].before,t[j+1].before),6)
  }
  const end=r.length*width+t.length,lastOp=last[end],tailErrors=[1,4,5,6].includes(lastOp)?separatorErrors(rTail,tTail):0
  const fullMistakes=full[end],halfMistakes=half[end]+tailErrors,weighted=fullMistakes+halfMistakes/2
  const errorPercent=weighted*100/r.length
  const safe=(n)=>Number.isSafeInteger(n)&&n>=0?n:0
  const typedKeys=safe(textKeydowns),back=safe(backspaces),del=safe(deletes),elapsed=Math.max(0,Math.min(DEST_DURATION_MS,Number(elapsedMs)||0))
  return {full_mistakes:fullMistakes,half_mistakes:halfMistakes,weighted_mistakes:weighted,reference_words:r.length,typed_words:t.length,
    error_percentage:errorPercent,display_error_percentage:Math.round(errorPercent*100)/100,
    text_keydowns:typedKeys,backspaces:back,deletes:del,total_key_depressions:typedKeys+back+del,final_characters:typed.length,elapsed_ms:elapsed,
    gross_wpm:elapsed>0?Math.round((typedKeys/5)/(elapsed/60000)*100)/100:0}
}
// Use the unrounded ratio for comparisons: rounding must not create a pass.
export function withinDestLimit(result,limit){
  if(!result||!Number.isFinite(limit)||!result.reference_words)return false
  return (2*result.full_mistakes+result.half_mistakes)*100<=2*result.reference_words*limit
}

// Running deadlines use the larger of wall and monotonic elapsed time to cope
// with sleep and backwards clock movement. The previous remaining value clamps
// any later clock correction so time can never increase during this page view.
export function remainingDestMs(startWall,startMono,nowWall,nowMono,previous=DEST_DURATION_MS,initial=DEST_DURATION_MS){
  const elapsed=Math.max(0,nowWall-startWall,nowMono-startMono)
  return Math.max(0,Math.min(previous,initial-elapsed))
}
