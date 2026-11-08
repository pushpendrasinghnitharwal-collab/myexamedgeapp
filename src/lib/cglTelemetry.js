// Optional foreground reading time, stored locally per backend account/mock.
// No question text, answer choice or credentials are stored in this record.
const KEY='examedge.cgl.question-time.v1'
function read() { try { const data=JSON.parse(localStorage.getItem(KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{} } catch {return {}} }
export function addQuestionTime(scope,mockId,position,milliseconds) {
  if(!scope||!mockId||!Number.isInteger(position)||!Number.isFinite(milliseconds)||milliseconds<=0)return
  try {
    const data=read(),account=data[scope]||{},mock=account[mockId]||{times:{}}
    mock.times[position]=(Number(mock.times[position])||0)+milliseconds;mock.updated=Date.now();account[mockId]=mock
    const latest=Object.entries(account).sort((a,b)=>(b[1].updated||0)-(a[1].updated||0)).slice(0,100)
    data[scope]=Object.fromEntries(latest);localStorage.setItem(KEY,JSON.stringify(data))
  } catch { /* Storage is optional; scores remain on the backend. */ }
}
export function clearQuestionTimes() { try { localStorage.removeItem(KEY) } catch { /* Optional storage. */ } }
export function questionSeconds(scope,mockId,position) {
  const ms=Number(read()?.[scope]?.[mockId]?.times?.[position])
  return Number.isFinite(ms)&&ms>0?ms/1000:null
}
// Read the older on-device timing record once when augmenting a submitted
// review. Synced server durations always take precedence and are never added to
// these legacy values, which avoids double-counting across player versions.
export function questionTimes(scope,mockId) {
  if(!scope||!mockId)return {}
  const raw=read()?.[scope]?.[mockId]?.times
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {}
  return Object.fromEntries(Object.entries(raw).filter(([position,value])=>/^\d+$/.test(position)&&Number.isFinite(Number(value))&&Number(value)>0).map(([position,value])=>[position,Number(value)]))
}
