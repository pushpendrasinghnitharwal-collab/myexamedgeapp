import { pool } from './db.js'
import { withdrawAiBatch } from './ai-question-engine.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  if (!flag('--id') || !flag('--reviewer') || !flag('--notes')) throw new Error('Usage: npm run ai:withdraw -- --id BATCH_ID --reviewer NAME --notes "reason for withdrawal"')
  const client=await pool.connect()
  try {console.log(JSON.stringify(await withdrawAiBatch(client,{batchId:flag('--id'),reviewer:flag('--reviewer'),notes:flag('--notes')})))} finally {client.release()}
} catch(error){console.error(`AI withdrawal failed: ${error.message}`);process.exitCode=1}
finally {await pool.end()}
