import { pool } from './db.js'
import { migratePyqAi } from './pyq-migration.js'
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  const client=await pool.connect()
  try { console.log(JSON.stringify(await migratePyqAi(client))) } finally { client.release() }
} catch (error) { console.error(`PYQ migration failed: ${error.message}`); process.exitCode=1 }
finally { await pool.end() }
