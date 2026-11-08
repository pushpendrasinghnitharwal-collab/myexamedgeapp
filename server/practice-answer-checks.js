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

export const quantExpectedV2 = {
  'quant2-01': () => String(BigInt(9) ** BigInt(2027) % BigInt(10)),
  'quant2-02': () => String([5, 25, 125].reduce((total, divisor) => total + Math.floor(100 / divisor), 0)),
  'quant2-03': () => `${((1.1 * 1.2 - 1) * 100).toFixed(0)}%`,
  'quant2-04': () => ratio(5 * 14, 7 * 15),
  'quant2-05': () => Math.sqrt(1.44).toFixed(1),
  'quant2-06': () => String(15 + 1),
  'quant2-07': () => inr(15000 * 6 * 3 / 100),
  'quant2-08': () => inr(20000 * (1.05 ** 2 - 1)),
  'quant2-09': () => `${((700 - 625) / 625) * 100}%`,
  'quant2-10': () => inr(2400 * 0.9 * 0.95),
  'quant2-11': () => inr(22000 * (25000 * 12) / (25000 * 12 + 40000 * 9)),
  'quant2-12': () => ratio(40, 40),
  'quant2-13': () => String(3 ** 2 + 2),
  'quant2-14': () => `2√3`,
  'quant2-15': () => `${180 * 5 / 12}°`,
  'quant2-16': () => `${Math.sqrt(13 ** 2 - 12 ** 2)} cm`,
  'quant2-17': () => `${81 * (16 / 9) ** 2} cm²`,
  'quant2-18': () => `${Math.round(2 * (22 / 7) * 14 * 5)} cm²`,
  'quant2-19': () => `${9 * (15 + 9)}π cm²`,
  'quant2-20': () => String(Math.sin(Math.PI / 4) * Math.cos(Math.PI / 4) + Math.cos(Math.PI / 4) * Math.sin(Math.PI / 4)),
  'quant2-21': () => '17/13',
  'quant2-22': () => `15√3 m`,
  'quant2-23': () => `${(100 + 125 + 150 + 180 + 225) / 5} thousand units`,
  'quant2-24': () => `${((180 - 150) / 150) * 100}%`,
  'quant2-25': () => (5400 * 120 / 360).toLocaleString('en-IN'),
}

const quantExpectations = {
  'ssc-cgl-2026-tier1-practice-v1': quantExpected,
  'ssc-cgl-2026-tier1-practice-v2': quantExpectedV2,
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
  if ([5, 25, 125].reduce((total, divisor) => total + Math.floor(100 / divisor), 0) !== 24) problems.push('100! trailing-zero count is not 24')
  if (Math.abs(2400 * 0.9 * 0.95 - 2052) > 1e-9) problems.push('successive-discount total is not 2052')
  if (Math.round(22000 * 300000 / 660000) !== 10000) problems.push('partnership share is not 10000')
  if (Math.abs(45 / Math.sqrt(3) - 15 * Math.sqrt(3)) > 1e-9) problems.push('30-degree height is not 15sqrt3')
  if (81 * (16 / 9) ** 2 !== 256) problems.push('similar-triangle area is not 256')
  if (5400 * 120 / 360 !== 1800) problems.push('pie-chart count is not 1800')
  if (Math.abs((Math.sqrt(75) - Math.sqrt(27)) - 2 * Math.sqrt(3)) > 1e-12) problems.push('surd difference is not 2sqrt3')
  if ((4 - 2) ** 3 !== 8) problems.push('unpainted cube count is not 8')
  return problems
}

export function checkQuantAnswers(questions, packKey = 'ssc-cgl-2026-tier1-practice-v1') {
  const mismatches = []
  const expectedForPack = quantExpectations[packKey]
  if (!expectedForPack) return [{ problem: `No quantitative answer checks registered for pack ${packKey}` }]
  const byId = new Map(questions.map(q => [q.qid, q]))
  for (const [qid, compute] of Object.entries(expectedForPack)) {
    const question = byId.get(qid)
    if (!question) { mismatches.push({ qid, problem: 'missing question' }); continue }
    const expected = compute()
    const stored = question.options?.[question.correct]?.en
    if (stored !== expected) mismatches.push({ qid, expected, stored })
    const duplicates = question.options?.filter(option => option.en === expected).length
    if (duplicates !== 1) mismatches.push({ qid, problem: 'expected answer is not the only matching option' })
  }
  const quantCount = questions.filter(q => q.subject === 'Quant').length
  if (quantCount !== Object.keys(expectedForPack).length) {
    mismatches.push({ problem: `quant question count ${quantCount} has no 1:1 answer check` })
  }
  return mismatches
}
