import {pool} from './db.js'
import {migrateCurrentAffairs} from './ca-migration.js'
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; no database was changed.')
  const client=await pool.connect()
  try {console.log(JSON.stringify(await migrateCurrentAffairs(client)))} finally {client.release()}
} catch(error){console.error(`Current-affairs migration failed: ${error.message}`);process.exitCode=1}
finally {await pool.end()}
