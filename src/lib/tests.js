import { EXAMS, SUBJECTS, TOPICS, examById } from '../data/exams'
import { QUESTIONS, topicsForExam } from '../data/questions'
import { mulberry32, hashString } from './utils'

// Builds a realistic catalogue of tests for any exam.
export function buildTests(exam) {
  const rand = mulberry32(hashString('tests:' + exam.id))
  const tests = []
  const examQuestions = QUESTIONS.filter((q) => q.exams.includes(exam.id))
  const topics = topicsForExam(exam)

  // 1. Full-length mock
  tests.push({
    id: `${exam.id}-mock-1`,
    examId: exam.id,
    type: 'full',
    title: `${exam.name} Full-Length Mock Test`,
    hi: `${exam.hi} पूर्ण लंबाई मॉक टेस्ट`,
    desc: `Official-pattern paper with negative marking, exactly like the real exam.`,
    hiDesc: 'आधिकारिक पैटर्न का पेपर, नेगेटिव मार्किंग के साथ — बिल्कुल असली परीक्षा जैसा।',
    questions: Math.min(exam.questions, 25),
    duration: exam.duration,
    premium: false,
    attempts: 12000 + Math.floor(rand() * 60000),
    avg: Math.round(exam.marks * (0.4 + rand() * 0.25) * 10) / 10,
    rating: 4.8,
    tag: 'Most popular',
  })

  // 2. Another full mock — premium
  tests.push({
    id: `${exam.id}-mock-2`,
    examId: exam.id,
    type: 'full',
    title: `${exam.name} Mock Test 2 — Previous Year Pattern`,
    hi: `${exam.hi} मॉक टेस्ट 2 — पिछले वर्षों का पैटर्न`,
    desc: 'Difficulty tuned higher — 15% extra time compared to your average attempt.',
    hiDesc: 'कठिनाई अधिक — आपके औसत प्रयास की तुलना में 15% अतिरिक्त समय।',
    questions: Math.min(exam.questions, 25),
    duration: exam.duration,
    premium: true,
    attempts: 6000 + Math.floor(rand() * 30000),
    avg: Math.round(exam.marks * (0.38 + rand() * 0.24) * 10) / 10,
    rating: 4.7,
    tag: 'Premium',
  })

  // 3. Sectional tests for each subject that has enough questions
  const subjectCounts = {}
  examQuestions.forEach((q) => {
    const s = TOPICS[q.topic]?.subject
    if (s) subjectCounts[s] = (subjectCounts[s] || 0) + 1
  })

  exam.subjects.forEach((sid, i) => {
    const count = subjectCounts[sid] || 0
    if (!count) return
    const subject = SUBJECTS[sid]
    tests.push({
      id: `${exam.id}-sec-${sid}`,
      examId: exam.id,
      type: 'sectional',
      subject: sid,
      title: `${subject.name} Sectional Test`,
      hi: `${subject.hi} सेक्शनल टेस्ट`,
      desc: `Focused ${subject.name.toLowerCase()} drill with detailed topic analysis.`,
      hiDesc: `${subject.hi} पर केंद्रित अभ्यास और विस्तृत टॉपिक विश्लेषण के साथ।`,
      questions: Math.min(20, Math.max(10, count)),
      duration: 25,
      premium: i % 3 === 2,
      attempts: 3000 + Math.floor(rand() * 18000),
      avg: Math.round((0.5 + rand() * 0.3) * 100) / 10,
      rating: 4.5 + Math.round(rand() * 5) / 10,
      tag: subject.short,
    })
  })

  // 4. Topic drills
  topics.slice(0, 8).forEach((t, i) => {
    const topic = TOPICS[t]
    const count = examQuestions.filter((q) => q.topic === t).length
    if (!count) return
    tests.push({
      id: `${exam.id}-topic-${t}`,
      examId: exam.id,
      type: 'topic',
      subject: topic.subject,
      topic: t,
      title: `${topic.name} — Topic Drill`,
      hi: `${topic.hi} — टॉपिक ड्रिल`,
      desc: `Rapid-fire questions on ${topic.name.toLowerCase()} with instant solutions.`,
      hiDesc: `${topic.hi} पर त्वरित प्रश्न और तुरंत समाधान।`,
      questions: Math.min(15, count * 3),
      duration: 15,
      premium: false,
      attempts: 1200 + Math.floor(rand() * 9000),
      avg: Math.round((0.55 + rand() * 0.3) * 100) / 10,
      rating: 4.6,
      tag: 'Quick',
    })
  })

  // 5. Daily drill
  tests.push({
    id: `${exam.id}-daily`,
    examId: exam.id,
    type: 'drill',
    title: `${exam.name} Daily Drill — 10 Questions`,
    hi: `${exam.hi} डेली ड्रिल — 10 प्रश्न`,
    desc: 'Two minutes a day, keeps your streaks alive and your concepts warm.',
    hiDesc: 'रोज़ दो मिनट — स्ट्रीक जारी रखें और कॉन्सेप्ट ताज़ा रखें।',
    questions: 10,
    duration: 10,
    premium: false,
    attempts: 20000 + Math.floor(rand() * 40000),
    avg: Math.round((0.6 + rand() * 0.25) * 100) / 10,
    rating: 4.6,
    tag: 'Daily',
  })

  // 6. Live all-India test
  tests.push({
    id: `${exam.id}-live`,
    examId: exam.id,
    type: 'live',
    title: `${exam.name} Live All-India Test`,
    hi: `${exam.hi} लाइव ऑल-इंडिया टेस्ट`,
    desc: 'Compete with thousands of aspirants at a scheduled time — full exam environment.',
    hiDesc: 'तय समय पर हज़ारों अभ्यर्थियों से मुकाबला — पूरी परीक्षा का माहौल।',
    questions: Math.min(exam.questions, 25),
    duration: exam.duration,
    premium: true,
    attempts: 4000 + Math.floor(rand() * 25000),
    avg: Math.round(exam.marks * (0.36 + rand() * 0.2) * 10) / 10,
    rating: 4.9,
    tag: 'LIVE',
  })

  return tests
}

export const TEST_CATALOGUE = EXAMS.reduce((acc, e) => {
  acc[e.id] = buildTests(e)
  return acc
}, {})

export function getTest(examId, testId) {
  return (TEST_CATALOGUE[examId] || []).find((t) => t.id === testId)
}

export const TEST_TYPE_LABEL = {
  full: { en: 'Full Mock', hi: 'फुल मॉक' },
  sectional: { en: 'Sectional', hi: 'सेक्शनल' },
  topic: { en: 'Topic Drill', hi: 'टॉपिक ड्रिल' },
  drill: { en: 'Daily Drill', hi: 'डेली ड्रिल' },
  live: { en: 'Live Test', hi: 'लाइव टेस्ट' },
}
