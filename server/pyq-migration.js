import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { MIGRATION_CHECKSUM, MIGRATION_VERSION } from './migration-core.js'

export const PYQ_MIGRATION_VERSION = '003_ssc_cgl_pyq_ai'
const sql = await readFile(new URL('./migrations/003_ssc_cgl_pyq_ai.sql', import.meta.url), 'utf8')
export const PYQ_MIGRATION_CHECKSUM = createHash('sha256').update(sql).digest('hex')

export async function migratePyqAi(client) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)',[729003])
    const { rows: [state] } = await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
    if (!state.present) throw new Error('Apply SSC CGL migration 001 first')
    const { rows } = await client.query('SELECT version,checksum FROM cgl_schema_migrations WHERE version IN ($1,$2)',[MIGRATION_VERSION,PYQ_MIGRATION_VERSION])
    const first=rows.find(r=>r.version===MIGRATION_VERSION), current=rows.find(r=>r.version===PYQ_MIGRATION_VERSION)
    if (!first || first.checksum!==MIGRATION_CHECKSUM) throw new Error('SSC CGL migration 001 is missing or its checksum differs')
    if (current && current.checksum!==PYQ_MIGRATION_CHECKSUM) throw new Error('Applied PYQ migration checksum differs; create a new migration')
    if (!current) {
      await client.query(sql)
      await client.query('INSERT INTO cgl_schema_migrations(version,checksum) VALUES($1,$2)',[PYQ_MIGRATION_VERSION,PYQ_MIGRATION_CHECKSUM])
    }
    await client.query('COMMIT')
    return { applied:!current, version:PYQ_MIGRATION_VERSION, seeded_papers:0, seeded_questions:0 }
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
