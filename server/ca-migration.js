import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { MIGRATION_CHECKSUM, MIGRATION_VERSION } from './migration-core.js'

export const CA_MIGRATION_VERSION='004_ssc_cgl_current_affairs'
const sql=await readFile(new URL('./migrations/004_ssc_cgl_current_affairs.sql',import.meta.url),'utf8')
export const CA_MIGRATION_CHECKSUM=createHash('sha256').update(sql).digest('hex')
export async function migrateCurrentAffairs(client) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)',[729005])
    const {rows:[table]}=await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
    if (!table.present) throw new Error('Apply SSC CGL migration 001 first')
    const {rows}=await client.query('SELECT version,checksum FROM cgl_schema_migrations WHERE version IN ($1,$2)',[MIGRATION_VERSION,CA_MIGRATION_VERSION])
    const original=rows.find(r=>r.version===MIGRATION_VERSION),current=rows.find(r=>r.version===CA_MIGRATION_VERSION)
    if (!original || original.checksum!==MIGRATION_CHECKSUM) throw new Error('SSC CGL migration 001 is missing or its checksum differs')
    if (current && current.checksum!==CA_MIGRATION_CHECKSUM) throw new Error('Applied CA migration checksum differs; create a new migration')
    if (!current) {await client.query(sql);await client.query('INSERT INTO cgl_schema_migrations(version,checksum) VALUES($1,$2)',[CA_MIGRATION_VERSION,CA_MIGRATION_CHECKSUM])}
    await client.query('COMMIT')
    return {applied:!current,version:CA_MIGRATION_VERSION,seeded_events:0,seeded_questions:0,seeded_mocks:0}
  } catch(error){await client.query('ROLLBACK');throw error}
}
export async function assertCaSchema(client) {
  const {rows:[table]}=await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
  if (!table.present) throw new Error('Apply migration 001 and current-affairs migration 004 first')
  const {rows:[version]}=await client.query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1',[CA_MIGRATION_VERSION])
  if (!version || version.checksum!==CA_MIGRATION_CHECKSUM) throw new Error('Current-affairs migration 004 missing or checksum differs')
}
