import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { TIER1_DIFFICULTY, TIER1_EDITORIAL_SETS, TIER1_EDITORIAL_TOPICS } from './master-formats.js'
import { checkQuantAnswers, verifyCheckArithmetic } from './practice-answer-checks.js'

export const PRACTICE_PACKS = {
  'ssc-cgl-2026-tier1-practice-v1': new URL('./data/ssc-cgl-2026-tier1-practice/', import.meta.url),
  'ssc-cgl-2026-tier1-practice-v2': new URL('./data/ssc-cgl-2026-tier1-practice-v2/', import.meta.url),
}
export const PRACTICE_PACK_KEY = 'ssc-cgl-2026-tier1-practice-v1'
export const PRACTICE_PACK_KEYS = Object.keys(PRACTICE_PACKS)
export const PRACTICE_DIR = PRACTICE_PACKS[PRACTICE_PACK_KEY]
export const SUBJECT_ORDER = ['Reasoning', 'General_Awareness', 'Quant', 'English']

const text = value => typeof value === 'string' && value.trim().length > 0
const normalize = value => String(value).toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[.,;:!?'"()[\]{}\-–—]/g, '').trim()

export async function readPracticePack({ dir = PRACTICE_DIR } = {}) {
  const read = async name => JSON.parse(await readFile(new URL(name, dir), 'utf8'))
  const pack = await read('pack.json')
  const sets = []
  const questions = []
  for (const file of pack.question_files) {
    const part = await read(file)
    sets.push(...(part.sets || []))
    questions.push(...(part.questions || []))
  }
  return { pack, sets, questions }
}

export function practiceContentHash({ pack, sets, questions }) {
  const stable = JSON.stringify({ pack, sets, questions })
  return createHash('sha256').update(stable).digest('hex')
}

function tier1Syllabus() {
  return readFile(new URL('./data/ssc-cgl-syllabus.json', import.meta.url), 'utf8').then(raw => {
    const data = JSON.parse(raw)
    const keys = new Set()
    for (const topic of data.topics) {
      if (!topic.stages.includes('Tier_1')) continue
      for (const sub of topic.sub_topics) keys.add(`${topic.subject}|${topic.topic}|${sub}`)
    }
    return keys
  })
}

const requiredSetTypes = { Data_Interpretation: 2, Cloze_Test: 5 }

export async function validatePracticePack(content) {
  const { pack, sets, questions } = content
  const errors = []
  const warnings = []
  const fail = (message, detail) => errors.push(detail === undefined ? message : `${message}: ${detail}`)

  if (!Object.hasOwn(PRACTICE_PACKS, pack.pack_key)) fail('Unexpected pack key', pack.pack_key)
  if (!text(pack.title)) fail('Pack title is required')
  if (pack.exam !== 'SSC CGL' || pack.exam_stage !== 'Tier_1') fail('Pack must target SSC CGL Tier-I')
  if (pack.provenance?.is_pyq !== false || pack.provenance?.kind !== 'original_practice') fail('Pack must be explicitly marked original practice, not PYQ')
  if (!text(pack.pattern_baseline?.notice_url) || !pack.pattern_baseline.notice_url.startsWith('https://')) fail('Official notice URL is required')
  if (!text(pack.pattern_baseline?.verified_on)) fail('Pattern verification date is required')
  if (pack.review?.human_reviewed !== false && pack.review?.status !== 'human_reviewed') fail('This pack must not claim human review until it actually happened')
  if (pack.review?.status === 'human_reviewed' && !text(pack.review?.reviewed_by)) fail('A human-reviewed pack needs a named reviewer')

  if (questions.length !== 100) fail('A Tier-I full-mock pack must contain exactly 100 questions', questions.length)

  const qidSeen = new Set()
  const textSeen = new Map()
  const bySubject = {}
  const byTopic = {}
  const byDifficulty = {}
  const setChildren = new Map()
  const setsByRef = new Map(sets.map(set => [set.ref, set]))

  for (const set of sets) {
    if (!text(set.ref)) fail('Set without ref')
    if (setsByRef.get(set.ref) !== set) fail('Duplicate set ref', set.ref)
    if (!Object.hasOwn(requiredSetTypes, set.set_type)) fail('Unsupported set type', set.set_type)
    if (set.subject !== 'Quant' && set.subject !== 'English') fail('Tier-I sets must be Quant or English', set.ref)
    if (set.set_type === 'Data_Interpretation') {
      if (set.subject !== 'Quant') fail('DI sets must be Quant', set.ref)
      if (!set.chart_data && !text(set.media_svg_or_url)) fail('DI set needs chart_data or media', set.ref)
      if (!text(set.passage_en) && !text(set.passage_hi)) fail('DI set needs an instruction', set.ref)
    } else {
      if (set.subject !== 'English') fail('Cloze sets must be English', set.ref)
      if (!text(set.passage_en) || !text(set.passage_hi)) fail('Cloze set needs English and Hindi passage text', set.ref)
    }
    if (!text(set.source?.url) || !set.source.url.startsWith('https://') || !text(set.source?.citation)) fail('Set source must be an https URL with a citation', set.ref)
    if (!text(set.source?.checked_on)) fail('Set source needs a checked-on date', set.ref)
  }

  for (const question of questions) {
    const qid = question.qid
    if (!text(qid)) { fail('Question without qid'); continue }
    if (qidSeen.has(qid)) fail('Duplicate qid', qid)
    qidSeen.add(qid)
    if (!SUBJECT_ORDER.includes(question.subject)) fail('Invalid subject', qid)
    if (!text(question.topic) || !text(question.sub_topic)) fail('Topic and sub-topic are required', qid)
    if (!Object.hasOwn(TIER1_DIFFICULTY, question.difficulty)) fail('Invalid difficulty', `${qid} ${question.difficulty}`)
    if (question.question_type !== 'Standard_MCQ' && question.question_type !== 'Passage_Based') fail('Only MCQ formats are supported by this pack', qid)

    if (!text(question.text_en) || !text(question.text_hi)) fail('English and Hindi question text are required', qid)
    if (!Array.isArray(question.options) || question.options.length !== 4) fail('Exactly four options are required', qid)
    else {
      for (const [index, option] of question.options.entries()) {
        if (!text(option?.en) || !text(option?.hi)) fail('Every option needs English and Hindi text', `${qid} option ${index}`)
      }
      const english = question.options.map(option => normalize(option.en))
      if (new Set(english).size !== 4) fail('Options must be distinct', qid)
      if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct > 3) fail('Correct option index must be 0-3', qid)
    }
    if (!text(question.solution_en) || !text(question.solution_hi)) fail('Solution is required in both languages', qid)
    if (!text(question.trick_en) || !text(question.trick_hi)) fail('Trick/common-mistake note is required in both languages', qid)
    if (!Number.isInteger(question.ideal_time_seconds) || question.ideal_time_seconds <= 0) fail('Ideal time must be a positive integer', qid)
    if (!text(question.source?.url) || !question.source.url.startsWith('https://')) fail('Source must be an https URL', qid)
    if (!text(question.source?.citation)) fail('Source citation is required', qid)
    if (!text(question.source?.checked_on)) fail('Source checked-on date is required', qid)

    const fingerprint = `${question.subject}|${normalize(question.text_en)}|${normalize(question.options?.[question.correct]?.en)}`
    if (textSeen.has(fingerprint)) fail('Duplicate question text', `${qid} duplicates ${textSeen.get(fingerprint)}`)
    else textSeen.set(fingerprint, qid)

    if (question.set_ref) {
      const set = setsByRef.get(question.set_ref)
      if (!set) fail('Unknown set_ref', `${qid} ${question.set_ref}`)
      else {
        if (question.subject !== set.subject) fail('Set and question subjects differ', qid)
        if (question.question_type !== 'Passage_Based') fail('Set children must be Passage_Based', qid)
        setChildren.set(set.ref, (setChildren.get(set.ref) || 0) + 1)
      }
    } else if (question.question_type === 'Passage_Based') {
      fail('Passage_Based question has no set_ref', qid)
    }

    bySubject[question.subject] = (bySubject[question.subject] || 0) + 1
    const topicKey = `${question.subject}|${question.topic}`
    byTopic[topicKey] = (byTopic[topicKey] || 0) + 1
    byDifficulty[question.difficulty] = (byDifficulty[question.difficulty] || 0) + 1
  }

  for (const subject of SUBJECT_ORDER) {
    if (bySubject[subject] !== 25) fail(`${subject} must have exactly 25 questions`, bySubject[subject] ?? 0)
  }
  for (const [subject, topics] of Object.entries(TIER1_EDITORIAL_TOPICS)) {
    for (const [topic, count] of Object.entries(topics)) {
      const actual = byTopic[`${subject}|${topic}`] || 0
      if (actual !== count) fail(`Topic quota mismatch for ${subject} / ${topic}`, `expected ${count}, found ${actual}`)
    }
  }
  for (const [difficulty, count] of Object.entries(TIER1_DIFFICULTY)) {
    if (byDifficulty[difficulty] !== count) fail(`Difficulty quota mismatch for ${difficulty}`, `expected ${count}, found ${byDifficulty[difficulty] ?? 0}`)
  }
  if (Object.keys(byTopic).length !== Object.values(TIER1_EDITORIAL_TOPICS).reduce((total, topics) => total + Object.keys(topics).length, 0)) {
    fail('Pack contains topics outside the official Tier-I editorial profile')
  }

  for (const set of sets) {
    const required = requiredSetTypes[set.set_type]
    const actual = setChildren.get(set.ref) || 0
    if (actual !== required) fail(`Set ${set.ref} must contain ${required} questions`, actual)
  }
  for (const [setType, expected] of Object.entries(TIER1_EDITORIAL_SETS)) {
    const actualQuestions = questions.filter(question => setsByRef.get(question.set_ref)?.set_type === setType).length
    if (actualQuestions !== expected) fail(`Editorial set quota mismatch for ${setType}`, `expected ${expected}, found ${actualQuestions}`)
  }

  const syllabus = await tier1Syllabus()
  for (const question of questions) {
    if (!syllabus.has(`${question.subject}|${question.topic}|${question.sub_topic}`)) {
      fail('Question is not mapped to a Tier-I syllabus row', `${question.qid} ${question.subject} / ${question.topic} / ${question.sub_topic}`)
    }
  }

  const quantProblems = checkQuantAnswers(questions, pack.pack_key)
  for (const problem of quantProblems) fail('Quantitative answer check failed', JSON.stringify(problem))
  for (const problem of verifyCheckArithmetic()) fail('Answer-check arithmetic is inconsistent', problem)

  const sources = new Set(questions.map(question => question.source.url))
  if (sources.size < 10) warnings.push(`Only ${sources.size} distinct source URLs; factual items should cite specific sources`)

  const stats = {
    questions: questions.length,
    sets: sets.length,
    by_subject: bySubject,
    by_topic: byTopic,
    by_difficulty: byDifficulty,
    distinct_sources: sources.size,
    warning_count: warnings.length,
  }
  return { ok: errors.length === 0, errors, warnings, stats, content_hash: practiceContentHash(content) }
}

export function formatValidation(report) {
  const lines = []
  lines.push(report.ok ? 'Practice pack validation: OK' : 'Practice pack validation: FAILED')
  lines.push(JSON.stringify(report.stats, null, 2))
  if (report.warnings.length) lines.push(`Warnings:\n- ${report.warnings.join('\n- ')}`)
  if (report.errors.length) lines.push(`Errors:\n- ${report.errors.join('\n- ')}`)
  return lines.join('\n')
}
