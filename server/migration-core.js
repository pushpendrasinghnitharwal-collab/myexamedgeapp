import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export const MIGRATION_VERSION = '001_ssc_cgl'
export const RESET_FLAG = '--reset-legacy-bank'
const sql = await readFile(new URL('./migrations/001_ssc_cgl.sql', import.meta.url), 'utf8')
export const syllabus = JSON.parse(await readFile(new URL('./data/ssc-cgl-syllabus.json', import.meta.url), 'utf8'))

// SSC CGL 2026 common Paper I only. Computer is qualifying and excluded from
// Tier II merit. Tier I is a screening score, not part of final selection merit.
export const fullBlueprints = [
  {
    name: 'SSC CGL 2026 Tier I — full paper', category: 'Full_Tier1', stage: 'Tier_1',
    sections: [
      ['Part_A', 'Reasoning', 25, 2, 0.5, 900, true],
      ['Part_B', 'General_Awareness', 25, 2, 0.5, 900, true],
      ['Part_C', 'Quant', 25, 2, 0.5, 900, true],
      ['Part_D', 'English', 25, 2, 0.5, 900, true],
    ],
  },
  {
    name: 'SSC CGL 2026 Tier II Paper I — full paper', category: 'Full_Tier2', stage: 'Tier_2',
    sections: [
      ['Section_I_A', 'Quant', 30, 3, 1, 1800, true],
      ['Section_I_B', 'Reasoning', 30, 3, 1, 1800, true],
      ['Section_II_A', 'English', 45, 3, 1, 2400, true],
      ['Section_II_B', 'General_Awareness', 25, 3, 1, 1200, true],
      ['Section_III', 'Computer_Knowledge', 20, 3, 1, 900, false],
    ],
  },
]
export const MIGRATION_CHECKSUM = createHash('sha256').update(sql).update(JSON.stringify(syllabus)).update(JSON.stringify(fullBlueprints)).digest('hex')

function makeRows() {
  const rows = []
  for (const topic of syllabus.topics) {
    for (const subTopic of topic.sub_topics) {
      const stages = [...topic.stages]
      if (stages.includes('Tier_1') && stages.includes('Tier_2')) stages.push('Both')
      for (const stage of stages) rows.push([topic.subject, topic.topic, subTopic, stage, 2026, syllabus.source_url, topic.source_sections])
    }
  }
  return rows
}

// `client` is one dedicated pg client, not the pool, so the whole operation
// uses one transaction. Re-running an applied migration never erases new data.
export async function migrateSscCgl(client, { resetLegacyBank = false, ensureCoreSchema = null } = {}) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [729001])
    await client.query(`CREATE TABLE IF NOT EXISTS cgl_schema_migrations (
      version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    const existing = await client.query('SELECT checksum FROM cgl_schema_migrations WHERE version = $1', [MIGRATION_VERSION])
    if (existing.rows.length) {
      if (existing.rows[0].checksum !== MIGRATION_CHECKSUM) throw new Error('Applied SSC CGL migration checksum differs; create a new migration instead of rewriting history')
      await client.query('COMMIT')
      return { applied: false, version: MIGRATION_VERSION }
    }
    if (!resetLegacyBank) throw new Error(`This migration removes the old question and mock schemas. Run with ${RESET_FLAG} after taking a database backup.`)
    if (ensureCoreSchema) await ensureCoreSchema(client)
    await client.query(sql)
    const entries = makeRows()
    const values = []
    const placeholders = entries.map((row) => `(${row.map((value) => { values.push(value); return `$${values.length}` }).join(',')})`)
    await client.query(`INSERT INTO cgl_syllabus (subject, topic, sub_topic, exam_stage, notice_year, source_url, source_sections) VALUES ${placeholders.join(',')}`, values)
    for (const blueprint of fullBlueprints) {
      const { rows } = await client.query(`INSERT INTO cgl_mock_blueprints (name, category, exam_stage, notice_year, source_url)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`, [blueprint.name, blueprint.category, blueprint.stage, 2026, syllabus.source_url])
      for (const [index, section] of blueprint.sections.entries()) {
        const [code, subject, count, correct, wrong, seconds, merit] = section
        await client.query(`INSERT INTO cgl_blueprint_sections
          (blueprint_id, section_code, subject, position, question_count, correct_marks, wrong_deduction, time_limit_seconds, counts_for_merit)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [rows[0].id, code, subject, index + 1, count, correct, wrong, seconds, merit])
      }
    }
    await client.query('INSERT INTO cgl_schema_migrations(version, checksum) VALUES ($1,$2)', [MIGRATION_VERSION, MIGRATION_CHECKSUM])
    await client.query('COMMIT')
    return { applied: true, version: MIGRATION_VERSION, syllabusMappings: entries.length, blueprints: fullBlueprints.length }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
