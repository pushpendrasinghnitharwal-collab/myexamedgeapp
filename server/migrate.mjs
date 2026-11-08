import { initSchema, pool } from './db.js'
import { migrateSscCgl, RESET_FLAG } from './migration-core.js'

// Avoid silently connecting to a default local PostgreSQL instance.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No database was changed.')
  process.exitCode = 1
} else {
  try {
    const client = await pool.connect()
    try {
      const result = await migrateSscCgl(client, {
        resetLegacyBank: process.argv.includes(RESET_FLAG),
        // Core creation shares the transaction and occurs only after the guard.
        ensureCoreSchema: (connection) => initSchema(connection.query.bind(connection)),
      })
      console.log(JSON.stringify(result))
    } finally { client.release() }
  } catch (error) {
    console.error(`SSC CGL migration failed; the transaction was rolled back: ${error.message}`)
    process.exitCode = 1
  } finally { await pool.end() }
}
