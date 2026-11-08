// Independent recomputation of every quantitative answer in the Tier-I practice
// pack. Each check derives the value from the question's numbers and formats it
// exactly as the correct option must read. This catches transcription errors
// that a structural validator cannot see.
//
// This is a mathematical check, not a substitute for subject-expert review.

const inr = n => `₹${Number(n).toLocaleString('en-IN')}`
const gcd = (a, b) => (b ? gcd(b, a % b) : a)
const ratio = (a, b) => {
  const g = gcd(a, b)
  return `${a / g} : ${b / g}`
}

function smallestSquareMultiplier(n) {
  let x = n
  let result = 1
  for (let p = 2; p * p <= x; p++) {
    let exponent = 0
    while (x % p === 0) { x /= p; exponent++ }
    if (exponent % 2 === 1) result *= p
  }
  if (x > 1) result *= x
  return result
}

function factor(n) {
  let x = n
  const out = []
  for (let p = 2; p * p <= x; p++) while (x % p === 0) { out.push(p); x /= p }
  if (x > 1) out.push(x)
  return out
}

export const quantExpected = {
  'quant-01': () => String(BigInt(7) ** BigInt(2026) % BigInt(10)),
  'quant-02': () => String(smallestSquareMultiplier(2520)),
  'quant-03': () => (100 * 1.2 * 0.8 === 96 ? '4% decrease' : 'unexpected'),
  'quant-04': () => ratio(3 * 8, 4 * 9),
  'quant-05': () => String(6 * 34 + 6 * 38 - 11 * 36),
  'quant-06': () => `${((400 * 1.25 * 0.9 - 400) / 400) * 100}%`,
  'quant-07': () => inr(8000 * 1.1 ** 2 - 8000),
  'quant-08': () => `${(1 / (1 / 12 - 1 / 20)).toFixed(0)} days`,
  'quant-09': () => `${((150 + 300) / (150 / 9)).toFixed(0)} seconds`,
  'quant-10': () => {
    const milk = 60 * 7 / 10 * (2 / 3)
    const water = 60 - milk
    return ratio(Math.round(milk), Math.round(water))
  },
  'quant-11': () => inr(18000 * (40000 * 12) / (40000 * 12 + 60000 * 10)),
  'quant-12': () => inr(750 * 0.8 * 0.9),
  'quant-13': () => String(5 ** 2 - 2),
  'quant-14': () => {
    const [a, b, c] = [1, 2, -3]
    return String(Math.round((a ** 2) / (b * c) + (b ** 2) / (c * a) + (c ** 2) / (a * b)))
  },
  'quant-15': () => `${((6 - 2) * 180) / 6}°`,
  'quant-16': () => `${0.5 * 7 * 24} cm²`,
  'quant-17': () => `${Math.sqrt(26 ** 2 - 10 ** 2)} cm`,
  'quant-18': () => `${2 * (22 / 7) * 7 * 10} cm²`,
  'quant-19': () => String((4 / 3 * 6 ** 3) / (1 / 3 * 3 ** 2 * 4)),
  'quant-20': () => String(Math.sin(Math.PI / 6) + Math.cos(Math.PI / 3)),
  'quant-21': () => String((1 + 3 / 5) / (4 / 5)),
  'quant-22': () => `60(√3 − 1) m`,
  'quant-23': () => String((120 + 150 + 180 + 210) / 4),
  'quant-24': () => `${((210 - 150) / 150) * 100}%`,
  'quant-25': () => inr(36000 * 120 / 360),
}

// Sanity checks of the arithmetic used above, so a typo in a check cannot
// silently agree with a typo in the content.
export function verifyCheckArithmetic() {
  const problems = []
  if (factor(2520).join('') !== '2223357') problems.push('2520 factorisation changed')
  if (smallestSquareMultiplier(2520) !== 70) problems.push('square multiplier is not 70')
  if (2520 * 70 !== 420 ** 2) problems.push('2520 × 70 is not 420²')
  if (7 ** 2 % 10 !== 9) problems.push('unit-digit cycle changed')
  if (Math.abs((1 / 12 - 1 / 20) - 1 / 30) > 1e-12) problems.push('work-rate arithmetic changed')
  if (Math.round((40000 * 12) / (40000 * 12 + 60000 * 10) * 18000) !== 8000) problems.push('profit share is not 8000')
  if (Math.round((120 + 150 + 180 + 210) / 4) !== 165) problems.push('DI average is not 165')
  return problems
}

export function checkQuantAnswers(questions) {
  const mismatches = []
  const byId = new Map(questions.map(q => [q.qid, q]))
  for (const [qid, compute] of Object.entries(quantExpected)) {
    const question = byId.get(qid)
    if (!question) { mismatches.push({ qid, problem: 'missing question' }); continue }
    const expected = compute()
    const stored = question.options?.[question.correct]?.en
    if (stored !== expected) mismatches.push({ qid, expected, stored })
    const duplicates = question.options?.filter(option => option.en === expected).length
    if (duplicates !== 1) mismatches.push({ qid, problem: 'expected answer is not the only matching option' })
  }
  const quantCount = questions.filter(q => q.subject === 'Quant').length
  if (quantCount !== Object.keys(quantExpected).length) {
    mismatches.push({ problem: `quant question count ${quantCount} has no 1:1 answer check` })
  }
  return mismatches
}
