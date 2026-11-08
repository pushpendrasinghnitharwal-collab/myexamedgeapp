import { CATEGORIES, EXAMS } from '../data/exams.js'
import { TEST_CATALOGUE } from './tests.js'

// Availability is derived from actual published sets, never from a catalogue
// label or a popularity score. The local catalogue is currently empty.
const visibleTypes = new Set(['preview', 'sectional', 'topic'])
export const practiceSetCount = (examId) =>
  (TEST_CATALOGUE[examId] || []).filter((test) => visibleTypes.has(test.type)).length
export const hasPractice = (examId) => practiceSetCount(examId) > 0
export const practiceExamCount = EXAMS.filter((exam) => hasPractice(exam.id)).length

const categoryOrder = new Map(CATEGORIES.map((category, index) => [category.id, index]))
const normalize = (value = '') => value.normalize('NFKC').toLocaleLowerCase()
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()

// Match all search terms across the exam's name, category and known aliases.
export function filterExams({ category = 'all', query = '', availability = 'all' } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return EXAMS.filter((exam) => {
    const group = CATEGORIES.find((item) => item.id === exam.category)
    const searchable = normalize([exam.id, exam.name, exam.hi, exam.subtitle, group?.name, group?.hi, ...(exam.aliases || [])].filter(Boolean).join(' '))
    const matchesAvailability = availability === 'practice' ? hasPractice(exam.id)
      : availability === 'info' ? !hasPractice(exam.id) : true
    return (category === 'all' || exam.category === category)
      && matchesAvailability && terms.every((term) => searchable.includes(term))
  }).sort((a, b) => categoryOrder.get(a.category) - categoryOrder.get(b.category))
}

// Attempts are saved newest-first. Ignore other targets and invalid entries so
// the dashboard never invents a result for the selected exam.
export function latestTargetAttempt(attempts, examId) {
  return attempts.find((attempt) => attempt.examId === examId && attempt.id) || null
}
