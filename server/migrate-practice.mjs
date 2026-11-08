import { pool, query } from './db.js'
import { migratePracticePacks, practiceStatus } from './practice-migration.js'

// Additive migration 007 only. It seeds no questions and does not touch
// learner history, accounts, attempts or existing published content.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No database was changed.')
  process.exitCode = 1
} else {
  let client
  try {
    client = await pool.connect()
    console.log(JSON.stringify(await migratePracticePacks(client)))
    console.log(JSON.stringify(await practiceStatus(query)))
  } catch (error) {
    console.error(`Practice migration failed; the transaction was rolled back: ${error.message}`)
    process.exitCode = 1
  } finally {
    client?.release()
    await pool.end()
  }
}
