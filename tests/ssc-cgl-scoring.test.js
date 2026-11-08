import test from 'node:test'
import assert from 'node:assert/strict'
import { gradeCglAttempt } from '../server/cgl-scoring.js'

function q(id, section, subject, stage = 'Tier_1') {
  return { question_id: String(id), section_id: String(section), subject, section_code: 'A', correct_option_index: 1,
    correct_marks: stage === 'Tier_1' ? '2.00' : '3.00', wrong_deduction: stage === 'Tier_1' ? '0.50' : '1.00', counts_for_merit: subject !== 'Computer_Knowledge' }
}
const a = (question_id, selected_option_index, option_state = selected_option_index === null ? 'Not_Answered' : 'Answered', time_spent_seconds = 10) => ({ question_id, selected_option_index, option_state, time_spent_seconds })

test('Tier I scoring applies +2/−0.5, retains review states and does not scale partial papers', () => {
  const result = gradeCglAttempt('Tier_1', [q(1,1,'Quant'),q(2,1,'Quant'),q(3,1,'Quant')], [a(1,1,'Answered_And_Marked'),a(2,0)])
  assert.equal(result.merit_score, 1.5); assert.equal(result.merit_out_of, 200); assert.equal(result.actual_max_merit_score, 6)
  assert.equal(result.time_spent_seconds, 20); assert.equal(result.computer_qualifying_status, 'Not_Applicable')
  assert.deepEqual(result.sections.map(s=>[s.correct_count,s.wrong_count,s.skipped_count]),[[1,1,1]])
  assert.equal(result.answers[0].option_state, 'Answered_And_Marked'); assert.equal(result.answers[2].option_state, 'Not_Visited')
})

test('Tier II excludes computer from the 390 merit maximum and never guesses a cutoff', () => {
  const result = gradeCglAttempt('Tier_2',[q(1,1,'Quant','Tier_2'),q(2,2,'English','Tier_2'),q(3,3,'Computer_Knowledge','Tier_2')],[a(1,1),a(2,0),a(3,0)])
  assert.equal(result.merit_score,2); assert.equal(result.merit_out_of,390); assert.equal(result.actual_max_merit_score,6)
  assert.equal(result.computer_score,-1); assert.equal(result.computer_max_score,3); assert.equal(result.computer_qualifying_status,'Pending')
})

test('invalid, duplicate, foreign or contradictory answer states are rejected', () => {
  const questions=[q(1,1,'Quant')]
  for (const answers of [[a(2,1)], [a(1,4)], [a(1,1,'Not_Answered')], [a(1,null,'Answered')], [a(1,1,'Answered',-1)], [a(1,1),a(1,0)]]) {
    assert.throws(()=>gradeCglAttempt('Tier_1',questions,answers))
  }
})
