import { readPracticePack, validatePracticePack, formatValidation } from './practice-content.js'

// Offline structural, quota, duplicate and answer-recomputation checks.
// This command never connects to a database and never publishes anything.
try {
  const content = await readPracticePack()
  const report = await validatePracticePack(content)
  console.log(formatValidation(report))
  console.log(`Content hash: ${report.content_hash}`)
  if (!report.ok) process.exitCode = 1
} catch (error) {
  console.error(`Practice validation failed to run: ${error.message}`)
  process.exitCode = 1
}
