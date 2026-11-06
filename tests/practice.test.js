import test from 'node:test'
import assert from 'node:assert/strict'
import { EXAMS, SUBJECTS, TOPICS } from '../src/data/exams.js'
import { buildPaper, hashString, questionsForExam } from '../src/data/questions.js'
import { TEST_CATALOGUE } from '../src/lib/tests.js'

test('each practice set has the advertised number of existing exam-specific questions', () => {
  for (const exam of EXAMS) {
    for (const item of TEST_CATALOGUE[exam.id]) {
      const topicIds = item.topic ? [item.topic] : item.subject
        ? Object.keys(TOPICS).filter((id) => TOPICS[id].subject === item.subject)
        : null
      const paper = buildPaper(exam, { count: item.questions, seed: hashString(item.id), topicIds })
      assert.equal(paper.length, item.questions, `${item.id} count`)
      assert.equal(new Set(paper.map((q) => q.id)).size, paper.length, `${item.id} unique questions`)
      for (const q of paper) {
        assert.ok(q.exams.includes(exam.id), `${q.id} must be tagged for ${exam.id}`)
        if (item.topic) assert.equal(q.topic, item.topic)
        if (item.subject) assert.equal(TOPICS[q.topic].subject, item.subject)
      }
    }
  }
})

test('a filtered set never falls back to another exam or subject', () => {
  const exam = EXAMS.find((item) => item.id === 'ssc-cgl')
  assert.deepEqual(buildPaper(exam, { count: 10, topicIds: ['not-a-real-topic'] }), [])
  const configured = new Set(exam.subjects.map((id) => SUBJECTS[id] ? id : TOPICS[id]?.subject))
  assert.ok(questionsForExam(exam).every((question) => configured.has(TOPICS[question.topic]?.subject)))
})

test('paper ordering is repeatable for the same seed', () => {
  const exam = EXAMS.find((item) => item.id === 'ibps-po')
  const one = buildPaper(exam, { count: 15, seed: 100 }).map((q) => q.id)
  const two = buildPaper(exam, { count: 15, seed: 100 }).map((q) => q.id)
  assert.deepEqual(one, two)
})
