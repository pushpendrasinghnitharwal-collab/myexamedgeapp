import {pool} from './db.js'
import {publishCaEvent} from './ca-ingest.js'
import {publishCaQuestion} from './ca-ai.js'
import {publishCaMock} from './ca-assembler.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no database was changed.')
  const kind=flag('--kind'),id=flag('--id'),reviewer=flag('--reviewer'),notes=flag('--notes')
  if(!['event','question','mock'].includes(kind)||!id||!reviewer||!notes)throw new Error('Usage: npm run ca:review -- --kind event|question|mock --id ID --reviewer NAME --notes "review notes"')
  const client=await pool.connect()
  try{
    const result=kind==='event'?await publishCaEvent(client,{eventId:id,reviewer,notes}):kind==='question'?await publishCaQuestion(client,{questionId:id,reviewer,notes}):await publishCaMock(client,{mockId:id,reviewer,notes})
    console.log(JSON.stringify(result))
  }finally{client.release()}
}catch(error){console.error(`CA review failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
