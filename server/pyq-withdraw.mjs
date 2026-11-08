import { pool } from './db.js'
import { withdrawPyqPaper } from './pyq-ingest.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  if (!flag('--id') || !flag('--reviewer') || !flag('--notes')) throw new Error('Usage: npm run pyq:withdraw -- --id PAPER_ID --reviewer NAME --notes "reason for withdrawal"')
  const client=await pool.connect()
  try {console.log(JSON.stringify(await withdrawPyqPaper(client,{paperId:flag('--id'),reviewer:flag('--reviewer'),notes:flag('--notes')})))} finally {client.release()}
} catch(error){console.error(`PYQ withdrawal failed: ${error.message}`);process.exitCode=1}
finally {await pool.end()}
