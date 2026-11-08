import { pool } from './db.js'
import { readPracticePack, validatePracticePack, formatValidation } from './practice-content.js'
import { migratePracticePacks } from './practice-migration.js'
import { importPracticePack } from './practice-ingest.js'

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const flag = name => process.argv.includes(`--${name}`)

const mode = flag('preview') ? 'preview' : arg('mode') || 'draft'
const reviewer = arg('reviewer')
const reviewedOn = arg('reviewed-on')
const notes = arg('notes')
const importedBy = arg('imported-by') || process.env.USER || 'operator'

if (!['draft', 'preview', 'publish'].includes(mode)) {
  console.error('--mode must be draft, preview or publish (or use --preview). Nothing was changed.')
  process.exit(1)
}
if (mode === 'publish' && (!reviewer || !flag('confirm-human-review'))) {
  console.error('Publication is blocked. A named human reviewer and --confirm-human-review are required. Use --mode draft (default) or --preview otherwise. Nothing was changed.')
  process.exit(1)
}
if (mode === 'preview' && flag('confirm-human-review')) {
  console.error('Preview mode cannot be combined with a human-review attestation. Nothing was changed.')
  process.exit(1)
}

let reviewedAt = null
if (reviewedOn) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn) || Number.isNaN(Date.parse(reviewedOn))) {
    console.error('--reviewed-on must be a valid YYYY-MM-DD date. Nothing was changed.')
    process.exit(1)
  }
  reviewedAt = new Date(`${reviewedOn}T00:00:00Z`)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No database was changed.')
  process.exit(1)
}

let client
try {
  const content = await readPracticePack()
  const report = await validatePracticePack(content)
  if (!report.ok) {
    console.error(formatValidation(report))
    console.error('Nothing was imported.')
    process.exit(1)
  }

  if (mode === 'draft') console.log('Draft import: questions remain unavailable to the mock engine until a human review is recorded.')
  if (mode === 'preview') console.log('PREVIEW import: content is labelled as automatically checked and NOT human reviewed. Do not use this on a production learner service.')
  if (mode === 'publish') console.log(`Human-reviewed publication requested for reviewer: ${reviewer}. Only proceed if that review genuinely happened.`)

  client = await pool.connect()
  console.log(JSON.stringify(await migratePracticePacks(client)))
  const result = await importPracticePack(client, {
    content,
    report,
    mode,
    reviewer,
    reviewedAt,
    importedBy,
    notes,
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(`Practice import failed; the transaction was rolled back: ${error.message}`)
  if (error.details) console.error(JSON.stringify(error.details, null, 2))
  process.exitCode = 1
} finally {
  client?.release()
  await pool.end()
}
