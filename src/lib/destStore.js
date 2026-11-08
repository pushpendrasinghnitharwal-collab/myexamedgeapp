// Temporary device/tab-only recovery. No backend record or category is stored.
const PREFIX='examedge.dest.session.v1:'
const key=scope=>PREFIX+(scope||'guest')
export function loadDestSession(scope){
  try{const data=JSON.parse(sessionStorage.getItem(key(scope))||'null');return data&&typeof data==='object'&&!Array.isArray(data)?data:null}catch{return null}
}
export function saveDestSession(scope,data){try{sessionStorage.setItem(key(scope),JSON.stringify(data));return true}catch{return false}}
export function clearDestSession(scope){try{sessionStorage.removeItem(key(scope))}catch{}}
export function clearDestSessions(){
  try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(PREFIX))sessionStorage.removeItem(k)}}catch{}
}
