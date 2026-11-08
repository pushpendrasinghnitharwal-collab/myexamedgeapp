import {pool} from './db.js'
import {rejectCaDraft} from './ca-editorial.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no database was changed.')
  const kind=flag('--kind'),id=flag('--id'),reviewer=flag('--reviewer'),notes=flag('--notes')
  if(!kind||!id||!reviewer||!notes)throw new Error('Usage: npm run ca:reject -- --kind event|question|mock --id ID --reviewer NAME --notes "reason"')
  const client=await pool.connect()
  try{console.log(JSON.stringify(await rejectCaDraft(client,{kind,id,reviewer,notes})))}finally{client.release()}
}catch(error){console.error(`CA draft rejection failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
