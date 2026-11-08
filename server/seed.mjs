import { query, pool } from './db.js'
import { cglHealth } from './cgl-api.js'
import { seedOfficialCatalog } from './official-catalog.js'

// Additive, transactional catalogue seeding only. Never create questions or
// mock tests, and never run the destructive legacy-bank migration implicitly.
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  const health = await cglHealth(query)
  if (!health.ok) throw new Error(`SSC CGL schema is not ready: ${health.code}. Apply migration 001 first.`)
  const client = await pool.connect()
  let result
  try { result = await seedOfficialCatalog(client) } finally { client.release() }
  console.log(JSON.stringify({ message: 'Official 2026 catalogue seeded. No questions or mock tests were created.', ...result }))
} catch (error) {
  console.error(`SSC CGL catalog seed failed: ${error.message}`)
  process.exitCode = 1
} finally { await pool.end() }
