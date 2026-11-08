import { EXAMS } from '../data/exams.js'

// The old generated practice sets were retired with their source question bank.
// This static catalogue remains empty until the new published SSC CGL mocks are
// connected to the frontend; it must not invent tests from stale local data.
export const TEST_CATALOGUE = Object.fromEntries(EXAMS.map((exam) => [exam.id, []]))
export const getTest = (examId, testId) => (TEST_CATALOGUE[examId] || []).find((test) => test.id === testId)
