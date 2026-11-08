import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { EXAMS } from '../src/data/exams.js'
import { QUESTIONS } from '../src/data/questions.js'
import { TEST_CATALOGUE } from '../src/lib/tests.js'

test('retired question banks, seed questions and generated mock records are absent', async () => {
  assert.deepEqual(QUESTIONS, [])
  for (const exam of EXAMS) assert.deepEqual(TEST_CATALOGUE[exam.id], [])
  for (const path of ['src/data/questionBank.core.js','src/data/questionBank.expanded.js','src/data/questionBank.ga.js','src/data/currentAffairs.js','server/seed-data.json','src/lib/leaderboard.js']) {
    await assert.rejects(access(path), { code: 'ENOENT' }, path)
  }
  const runner = await readFile('src/pages/TestRunner.jsx', 'utf8')
  assert.match(runner, /no longer available/)
})
