import { pool } from './db.js'
import { publishPyqPaper } from './pyq-ingest.js'
const args=process.argv.slice(2)
function flag(name) { const i=args.indexOf(name);return i<0 ? null : args[i+1] }
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  if (!flag('--id') || !flag('--reviewer') || !flag('--notes')) throw new Error('Usage: npm run pyq:publish -- --id PAPER_ID --reviewer NAME --notes "review and rights attestation"')
  const client=await pool.connect()
  try { console.log(JSON.stringify(await publishPyqPaper(client,{paperId:flag('--id'),reviewer:flag('--reviewer'),notes:flag('--notes')}))) } finally { client.release() }
} catch(error) { console.error(`PYQ publication failed: ${error.message}`);process.exitCode=1 }
finally { await pool.end() }
