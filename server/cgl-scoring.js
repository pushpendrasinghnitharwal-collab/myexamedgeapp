const validStates = new Set(['Not_Visited', 'Not_Answered', 'Answered', 'Marked_For_Review', 'Answered_And_Marked'])
const answeredStates = new Set(['Answered', 'Answered_And_Marked'])
const round = (n) => Math.round(n * 100) / 100

export class AttemptValidationError extends Error {}

// Grades only against the immutable, published mock supplied by the database.
// The client never supplies the key, section allocation or marking scheme.
export function gradeCglAttempt(stage, questions, inputAnswers) {
  if (!['Tier_1', 'Tier_2'].includes(stage) || !questions.length || !Array.isArray(inputAnswers)) throw new AttemptValidationError('A published mock and answers array are required')
  const expected = new Map(questions.map((q) => [String(q.question_id), q]))
  if (expected.size !== questions.length || inputAnswers.length > questions.length) throw new AttemptValidationError('Invalid mock or too many answers')
  const responses = new Map()
  for (const answer of inputAnswers) {
    const id = String(answer?.question_id ?? '')
    const selected = answer?.selected_option_index ?? null
    const state = answer?.option_state
    const time = answer?.time_spent_seconds
    if (!expected.has(id) || responses.has(id)) throw new AttemptValidationError('Answers must refer to unique questions in this mock')
    if (!validStates.has(state) || (answeredStates.has(state) !== (selected !== null))) throw new AttemptValidationError('Option state and selected option do not agree')
    if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected > 3)) throw new AttemptValidationError('Selected option index must be 0–3 or null')
    if (!Number.isInteger(time) || time < 0 || time > 2147483647) throw new AttemptValidationError('Question time must be a non-negative integer')
    responses.set(id, { selected, state, time })
  }
  const sections = new Map()
  const graded = []
  let timeSpent = 0
  for (const q of questions) {
    const id = String(q.question_id)
    const response = responses.get(id) || { selected: null, state: 'Not_Visited', time: 0 }
    const correct = response.selected === null ? null : response.selected === q.correct_option_index
    const marks = correct === null ? 0 : correct ? Number(q.correct_marks) : -Number(q.wrong_deduction)
    const key = String(q.section_id)
    const section = sections.get(key) || { section_id: key, subject: q.subject, section_code: q.section_code, counts_for_merit: q.counts_for_merit, question_count: 0, correct_count: 0, wrong_count: 0, skipped_count: 0, score: 0, max_score: 0 }
    section.question_count++
    if (correct === null) section.skipped_count++
    else if (correct) section.correct_count++
    else section.wrong_count++
    section.score = round(section.score + marks)
    section.max_score = round(section.max_score + Number(q.correct_marks))
    sections.set(key, section)
    timeSpent += response.time
    if (timeSpent > 2147483647) throw new AttemptValidationError('Total time is too large')
    graded.push({ question_id: id, selected_option_index: response.selected, option_state: response.state, time_spent_seconds: response.time, is_correct: correct, awarded_marks: round(marks) })
  }
  const sectionList = [...sections.values()]
  const merit = sectionList.filter((s) => s.counts_for_merit)
  const computers = sectionList.filter((s) => s.subject === 'Computer_Knowledge')
  return {
    merit_score: round(merit.reduce((sum, s) => sum + s.score, 0)),
    merit_out_of: stage === 'Tier_1' ? 200 : 390,
    actual_max_merit_score: round(merit.reduce((sum, s) => sum + s.max_score, 0)),
    computer_score: computers.length ? round(computers.reduce((sum, s) => sum + s.score, 0)) : null,
    computer_max_score: computers.length ? round(computers.reduce((sum, s) => sum + s.max_score, 0)) : null,
    // SSC cutoffs depend on category/post/notice and are not guessed.
    computer_qualifying_status: computers.length ? 'Pending' : 'Not_Applicable',
    time_spent_seconds: timeSpent,
    sections: sectionList,
    answers: graded,
  }
}
