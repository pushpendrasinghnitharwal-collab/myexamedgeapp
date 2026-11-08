// Local recovery contains answer indices, flags and time only: no question text,
// answer keys or credentials. Backend ownership remains authoritative.
const KEY='examedge.cgl.player.v1'
const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}}
export function playerDeviceId(){return `device-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`}
export function loadPlayer(scope,id){return read()?.[scope]?.[id]||{positions:{},current:null}}
export function savePlayer(scope,id,value){
  if(!scope||!id)return false
  try{const data=read();data[scope]||={};data[scope][id]=value;localStorage.setItem(KEY,JSON.stringify(data));return true}catch{return false}
}
export function clearPlayer(scope,id){try{const data=read();if(data[scope]){delete data[scope][id];if(!Object.keys(data[scope]).length)delete data[scope];localStorage.setItem(KEY,JSON.stringify(data))}}catch{}}
export function clearPlayerData(){try{localStorage.removeItem(KEY)}catch{}}
export function paletteState(q){
  const answered=q.selected_option_index!==null&&q.selected_option_index!==undefined
  if(q.marked_for_review)return answered?'answered-marked':'marked'
  if(answered)return 'answered'
  return q.visited?'not-answered':'not-visited'
}

// A response may be saved while an earlier active-session GET is in flight.
// Remember its starting revisions so that the older GET cannot replace a newer
// local choice merely because the corresponding save has already completed.
export function snapshotPlayerRevisions(positions) {
  return Object.fromEntries(Object.entries(positions||{}).map(([position,q]) => [position,{rev:Number(q?.rev)||0,dirty:!!q?.dirty}]))
}
export function mergePlayerProgress(active,saved,requestSnapshot=null) {
  const positions={...(saved?.positions||{})}
  for(const q of active.questions||[]){
    const old=positions[q.position]||{},atRequest=requestSnapshot?.[q.position]
    const keepLocal=!!old.dirty||!!atRequest?.dirty||(atRequest&&Number(old.rev||0)>atRequest.rev)
    positions[q.position]={...old,selected_option_index:keepLocal?old.selected_option_index:q.selected_option_index??null,
      visited:keepLocal?!!old.visited:!!q.visited,marked_for_review:keepLocal?!!old.marked_for_review:!!q.marked_for_review,
      elapsed_ms:Number(old.elapsed_ms)||0,rev:Number(old.rev)||0,dirty:!!old.dirty}
  }
  const valid=(active.questions||[]).some(q=>q.position===saved?.current)
  return {device_id:saved?.device_id,positions,current:valid?saved.current:active.questions?.[0]?.position??null}
}
