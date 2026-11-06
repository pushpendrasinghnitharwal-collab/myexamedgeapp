import { EXAMS, SUBJECTS, TOPICS } from '../data/exams.js'
import { questionsForExam, topicsForExam } from '../data/questions.js'

// These are practice sets assembled from the existing question bank. They are not
// presented as verified PYQs or full-length, research-backed mock papers.
export function buildTests(exam) {
  const tests = []
  const examQuestions = questionsForExam(exam)
  const topics = topicsForExam(exam)

  if (examQuestions.length) {
    const count = Math.min(examQuestions.length, 25)
    tests.push({
      id: `${exam.id}-mock-1`, examId: exam.id, type: 'preview',
      title: `${exam.name} Mixed Practice Set`,
      hi: `${exam.hi} मिश्रित अभ्यास सेट`,
      desc: 'A short practice set from the existing question bank.',
      hiDesc: 'मौजूदा प्रश्न बैंक से एक छोटा अभ्यास सेट।',
      questions: count, duration: count, premium: false, tag: 'Practice',
    })
  }

  const subjectCounts = {}
  examQuestions.forEach((q) => {
    const subject = TOPICS[q.topic]?.subject
    if (subject) subjectCounts[subject] = (subjectCounts[subject] || 0) + 1
  })
  const orderedSubjects = [...new Set(exam.subjects.map((id) => SUBJECTS[id] ? id : TOPICS[id]?.subject).filter(Boolean))]
  orderedSubjects.forEach((sid) => {
    const count = subjectCounts[sid] || 0
    const subject = SUBJECTS[sid]
    if (!count || !subject) return
    tests.push({
      id: `${exam.id}-sec-${sid}`, examId: exam.id, type: 'sectional', subject: sid,
      title: `${subject.name} Practice`, hi: `${subject.hi} अभ्यास`,
      desc: `A focused set from the existing ${subject.name.toLowerCase()} questions.`,
      hiDesc: `${subject.hi} के मौजूदा प्रश्नों से केंद्रित अभ्यास।`,
      questions: Math.min(20, count), duration: Math.min(20, count), premium: false, tag: subject.short,
    })
  })

  topics.forEach((id) => {
    const topic = TOPICS[id]
    const count = examQuestions.filter((q) => q.topic === id).length
    if (!count || !topic) return
    tests.push({
      id: `${exam.id}-topic-${id}`, examId: exam.id, type: 'topic', subject: topic.subject, topic: id,
      title: `${topic.name} — Topic Practice`, hi: `${topic.hi} — टॉपिक अभ्यास`,
      desc: `Practise the available questions on ${topic.name.toLowerCase()}.`,
      hiDesc: `${topic.hi} पर उपलब्ध प्रश्नों का अभ्यास।`,
      questions: Math.min(15, count), duration: Math.min(15, count), premium: false, tag: 'Topic',
    })
  })

  if (examQuestions.length) {
    const count = Math.min(10, examQuestions.length)
    tests.push({
      id: `${exam.id}-daily`, examId: exam.id, type: 'drill',
      title: `${exam.name} Quick Practice`, hi: `${exam.hi} त्वरित अभ्यास`,
      desc: 'A short mixed set for a focused study break.',
      hiDesc: 'थोड़े समय में मिश्रित अभ्यास करें।',
      questions: count, duration: count, premium: false, tag: 'Quick',
    })
  }
  return tests
}

export const TEST_CATALOGUE = EXAMS.reduce((acc, exam) => {
  acc[exam.id] = buildTests(exam)
  return acc
}, {})

export function getTest(examId, testId) {
  return (TEST_CATALOGUE[examId] || []).find((test) => test.id === testId)
}

export const TEST_TYPE_LABEL = {
  full: { en: 'Full mock', hi: 'फुल मॉक' },
  preview: { en: 'Practice set', hi: 'अभ्यास सेट' },
  sectional: { en: 'Subject practice', hi: 'विषय अभ्यास' },
  topic: { en: 'Topic practice', hi: 'टॉपिक अभ्यास' },
  drill: { en: 'Quick practice', hi: 'त्वरित अभ्यास' },
}
