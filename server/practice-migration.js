import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { MIGRATION_CHECKSUM, MIGRATION_VERSION } from './migration-core.js'

export const PRACTICE_MIGRATION_VERSION = '007_ssc_cgl_practice_packs'
const sql = await readFile(new URL('./migrations/007_ssc_cgl_practice_packs.sql', import.meta.url), 'utf8')
export const PRACTICE_MIGRATION_CHECKSUM = createHash('sha256').update(sql).digest('hex')

export async function migratePracticePacks(client) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [729010])
    const { rows: [table] } = await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
    if (!table.present) throw new Error('Apply SSC CGL migration 001 first')
    const { rows } = await client.query('SELECT version, checksum FROM cgl_schema_migrations WHERE version = ANY($1::text[])', [[MIGRATION_VERSION, PRACTICE_MIGRATION_VERSION]])
    const base = rows.find(row => row.version === MIGRATION_VERSION)
    const current = rows.find(row => row.version === PRACTICE_MIGRATION_VERSION)
    if (!base || base.checksum !== MIGRATION_CHECKSUM) throw new Error('SSC CGL migration 001 is missing or has a different checksum')
    if (current && current.checksum !== PRACTICE_MIGRATION_CHECKSUM) throw new Error('Applied practice migration checksum differs; create a new migration')
    if (!current) {
      await client.query(sql)
      await client.query('INSERT INTO cgl_schema_migrations(version, checksum) VALUES($1,$2)', [PRACTICE_MIGRATION_VERSION, PRACTICE_MIGRATION_CHECKSUM])
    }
    await client.query('COMMIT')
    return { applied: !current, version: PRACTICE_MIGRATION_VERSION }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function practiceStatus(query) {
  const { rows: [state] } = await query(`SELECT to_regclass('public.cgl_practice_packs') IS NOT NULL AS packs,
    to_regclass('public.cgl_practice_pack_items') IS NOT NULL AS items`)
  if (!state.packs || !state.items) return { ok: false, code: 'SSC_CGL_PRACTICE_MIGRATION_REQUIRED' }
  const { rows: [version] } = await query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1', [PRACTICE_MIGRATION_VERSION])
  if (!version) return { ok: false, code: 'SSC_CGL_PRACTICE_MIGRATION_REQUIRED' }
  if (version.checksum !== PRACTICE_MIGRATION_CHECKSUM) return { ok: false, code: 'SSC_CGL_PRACTICE_CHECKSUM_MISMATCH' }
  return { ok: true, schema_version: PRACTICE_MIGRATION_VERSION }
}
