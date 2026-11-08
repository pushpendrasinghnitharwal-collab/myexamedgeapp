import { pool } from './db.js'
import { generateIsomorphic } from './ai-question-engine.js'
import { providerFromEnv } from './ai-provider.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  if (!flag('--source') || !flag('--stage') || !flag('--format')) throw new Error('Usage: npm run ai:generate -- --source QUESTION_ID --stage Tier_1 --format single_concept')
  const provider=providerFromEnv()
  const client=await pool.connect()
  try {console.log(JSON.stringify(await generateIsomorphic(client,{sourceQuestionId:flag('--source'),stage:flag('--stage'),format:flag('--format')},provider)))} finally {client.release()}
} catch(error){console.error(`AI generation failed: ${error.message}`);process.exitCode=1}
finally{await pool.end()}
