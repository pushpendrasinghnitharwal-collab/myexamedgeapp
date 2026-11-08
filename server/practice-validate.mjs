import { PRACTICE_PACKS, PRACTICE_PACK_KEYS, PRACTICE_PACK_KEY, readPracticePack, validatePracticePack, formatValidation } from './practice-content.js'

// Offline structural, quota, duplicate and answer-recomputation checks.
// This command never connects to a database and never publishes anything.
function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const flag = name => process.argv.includes(`--${name}`)

const requested = arg('pack')
if (requested && !Object.hasOwn(PRACTICE_PACKS, requested)) {
  console.error(`Unknown pack: ${requested}`)
  console.error(`Available packs: ${PRACTICE_PACK_KEYS.join(', ')}`)
  process.exit(1)
}
const keys = flag('all') ? PRACTICE_PACK_KEYS : [requested || PRACTICE_PACK_KEY]
let failed = false

for (const key of keys) {
  try {
    const content = await readPracticePack({ dir: PRACTICE_PACKS[key] })
    const report = await validatePracticePack(content)
    console.log(`\n=== ${key} ===`)
    console.log(formatValidation(report))
    console.log(`Content hash: ${report.content_hash}`)
    if (!report.ok) failed = true
  } catch (error) {
    console.error(`\n=== ${key} ===`)
    console.error(`Practice validation failed to run: ${error.message}`)
    failed = true
  }
}

if (!failed) console.log(`\nAll ${keys.length} pack(s) passed offline validation. No database was contacted.`)
if (failed) process.exitCode = 1
