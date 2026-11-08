import {pool} from './db.js'
import {labelMasterQuestion} from './master-label.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no database was changed')
  const kind=flag('--kind'),id=flag('--id'),part=flag('--part'),difficulty=flag('--difficulty'),mains=flag('--mains-level'),reviewer=flag('--reviewer'),notes=flag('--notes')
  if(!kind||!id||!difficulty||!['true','false'].includes(mains)||!reviewer||!notes||(part!==null&&!/^\d+$/.test(part)))
    throw new Error('Usage: npm run master:label -- --kind Bank|AI|CA --id ID [--part N] --difficulty Easy|Medium|Hard --mains-level true|false --reviewer NAME --notes "review notes"')
  const client=await pool.connect()
  try{console.log(JSON.stringify(await labelMasterQuestion(client,{kind,id,part:part===null?0:Number(part),difficulty,mains_level:mains==='true',reviewer,notes})))}finally{client.release()}
}catch(error){console.error(`Master label failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
