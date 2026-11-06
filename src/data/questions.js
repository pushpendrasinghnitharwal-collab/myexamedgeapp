import { CORE_QUESTIONS } from './questionBank.core'
import { GA_QUESTIONS } from './questionBank.ga'
import { EXPANDED_QUESTIONS } from './questionBank.expanded'
import { TOPICS, SUBJECTS } from './exams'

export const QUESTIONS = [...CORE_QUESTIONS, ...GA_QUESTIONS, ...EXPANDED_QUESTIONS]

export const questionById = (id) => QUESTIONS.find((q) => q.id === id)

// Deterministic pseudo-random generator so a test looks the same on every device.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function shuffleWith(list, rand) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Build a paper for an exam, honouring subject weights and the exam's blueprint.
export function buildPaper(exam, { count = 25, seed = 1, topicIds = null } = {}) {
  const rand = mulberry32(hashString(exam.id + ':' + seed))
  const pool = QUESTIONS.filter((q) => {
    if (topicIds && topicIds.length) return topicIds.includes(q.topic)
    return exam.exams.includes(q.id) || q.exams.includes(exam.id)
  })
  const usable = pool.length ? pool : QUESTIONS.filter((q) => q.exams.includes(exam.id))

  // distribute across the exam's subjects as evenly as the paper allows
  const bySubject = {}
  usable.forEach((q) => {
    const subj = TOPICS[q.topic]?.subject || 'ga'
    ;(bySubject[subj] = bySubject[subj] || []).push(q)
  })
  const subjectOrder = exam.subjects.filter((s) => bySubject[s]?.length)
  const extra = Object.keys(bySubject).filter((s) => !exam.subjects.includes(s))

  const picked = []
  const pools = [...subjectOrder, ...extra].map((s) => shuffleWith(bySubject[s], rand))
  let guard = 0
  while (picked.length < count && guard < count * 40) {
    guard++
    let progressed = false
    for (const pool of pools) {
      if (picked.length >= count) break
      if (pool.length) {
        picked.push(pool.pop())
        progressed = true
      }
    }
    if (!progressed) break
  }
  return shuffleWith(picked, rand)
}

export function topicsForExam(exam) {
  const set = new Set()
  QUESTIONS.filter((q) => q.exams.includes(exam.id)).forEach((q) => set.add(q.topic))
  return [...set]
}

export function subjectOfTopic(topicId) {
  return TOPICS[topicId]?.subject
}

export { TOPICS, SUBJECTS }
