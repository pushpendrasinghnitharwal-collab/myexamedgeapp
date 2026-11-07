import test from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, EXAMS, examById, officialSourceForExam } from '../src/data/exams.js'
import { QUESTIONS, questionsForExam } from '../src/data/questions.js'
import { TEST_CATALOGUE } from '../src/lib/tests.js'
import { filterExams, hasPractice, latestTargetAttempt, practiceExamCount, practiceSetCount } from '../src/lib/examCatalog.js'

const newGoals = [
  'ssc-mts', 'ssc-cpo', 'ssc-stenographer', 'sbi-clerk', 'ibps-rrb-po',
  'ibps-rrb-clerk', 'ibps-so', 'rrb-alp', 'rrb-technician', 'rpsc-ras',
  'rajasthan-cet-graduation', 'rajasthan-cet-senior-secondary',
]
const officialHosts = new Set(['ssc.gov.in', 'sbi.co.in', 'www.ibps.in', 'www.rrbcdg.gov.in', 'rpsc.rajasthan.gov.in', 'rssb.rajasthan.gov.in'])

test('exam directory has unique IDs, valid categories and official sources for new goals', () => {
  assert.equal(new Set(EXAMS.map((exam) => exam.id)).size, EXAMS.length)
  for (const exam of EXAMS) {
    assert.ok(CATEGORIES.some((category) => category.id === exam.category), `${exam.id} category`)
    assert.ok(Array.isArray(exam.subjects), `${exam.id} subjects`)
  }
  for (const id of newGoals) {
    const exam = examById(id)
    assert.ok(exam, `${id} is listed`)
    const source = officialSourceForExam(exam)
    assert.ok(source?.name && source.hi, `${id} official source is named`)
    const url = new URL(source.url)
    assert.equal(url.protocol, 'https:')
    assert.ok(officialHosts.has(url.hostname), `${id} has an official host`)
    assert.ok(exam.description?.en && exam.description?.hi, `${id} has a bilingual overview`)
  }
})

test('directory-only goals never borrow or invent questions or tests', () => {
  for (const id of newGoals) {
    const exam = examById(id)
    assert.equal(exam.directoryOnly, true)
    assert.deepEqual(exam.subjects, [])
    assert.equal(exam.duration, undefined)
    assert.equal(exam.marksPerQ, undefined)
    assert.equal(QUESTIONS.some((question) => question.exams.includes(id)), false, `${id} has no retagged questions`)
    assert.deepEqual(questionsForExam(exam), [])
    assert.deepEqual(TEST_CATALOGUE[id], [])
    assert.equal(practiceSetCount(id), 0)
    assert.equal(hasPractice(id), false)
  }
})

test('availability, aliases, bilingual search and categories filter real catalogue data', () => {
  assert.deepEqual(filterExams({ query: 'ssc-mts' }).map((exam) => exam.id), ['ssc-mts'])
  assert.deepEqual(filterExams({ query: 'OFFICE assistant' }).map((exam) => exam.id), ['ibps-rrb-clerk'])
  assert.deepEqual(filterExams({ query: 'राजस्थान सीईटी' }).map((exam) => exam.id), ['rajasthan-cet-graduation', 'rajasthan-cet-senior-secondary'])
  assert.ok(filterExams({ query: 'CPO SSC' }).some((exam) => exam.id === 'ssc-cpo'))
  const practice = filterExams({ availability: 'practice' })
  const info = filterExams({ availability: 'info' })
  assert.equal(practice.length, practiceExamCount)
  assert.equal(practice.length + info.length, EXAMS.length)
  assert.ok(practice.every((exam) => hasPractice(exam.id)))
  assert.ok(info.every((exam) => !hasPractice(exam.id)))
  const stateInfo = filterExams({ category: 'state', availability: 'info' })
  assert.deepEqual(stateInfo.map((exam) => exam.id), ['rpsc-ras', 'rajasthan-cet-graduation', 'rajasthan-cet-senior-secondary'])
  assert.deepEqual(filterExams({ query: 'there-is-no-such-exam' }), [])
})

test('dashboard retrieves only a real saved attempt for the selected target', () => {
  const attempts = [{ id: 'b', examId: 'ibps-po' }, { id: 'a2', examId: 'ssc-cgl' }, { id: 'a1', examId: 'ssc-cgl' }]
  assert.equal(latestTargetAttempt(attempts, 'ssc-cgl').id, 'a2')
  assert.equal(latestTargetAttempt(attempts, 'ibps-po').id, 'b')
  assert.equal(latestTargetAttempt(attempts, 'ssc-mts'), null)
  assert.equal(latestTargetAttempt([{ examId: 'ssc-cgl' }], 'ssc-cgl'), null)
})
