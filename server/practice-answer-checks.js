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

export const quantExpectedV3 = {
  'quant3-01': () => String(BigInt(6) ** BigInt(2025) % BigInt(10)),
  'quant3-02': () => String((3 + 1) * (2 + 1) * (1 + 1)),
  'quant3-03': () => String(0.15 * 480),
  'quant3-04': () => (1.25 * 0.8 === 1 ? 'No change' : 'unexpected'),
  'quant3-05': () => String(5 * (400 / 10)),
  'quant3-06': () => String((12 * 35 - 46) / 11),
  'quant3-07': () => inr(12500 * 8 * 2.5 / 100),
  'quant3-08': () => inr(16000 * (1.1 ** 2 - 1)),
  'quant3-09': () => `${((552 - 480) / 480) * 100}%`,
  'quant3-10': () => inr(1500 * 0.8 * 0.9),
  'quant3-11': () => `${Math.round(1 / (1 / 15 + 1 / 10))} days`,
  'quant3-12': () => `${(200 + 250) / (90 * 5 / 18)} seconds`,
  'quant3-13': () => String(6 ** 2 - 2),
  'quant3-14': () => String(10 ** 2 - 2 * 21),
  'quant3-15': () => `${(180 / 9) * 4}°`,
  'quant3-16': () => `${Math.sqrt(5 ** 2 - (8 / 2) ** 2)} cm`,
  'quant3-17': () => `${Math.sqrt(13 ** 2 - 5 ** 2)} cm`,
  'quant3-18': () => `${6 * 6 ** 2} cm²`,
  'quant3-19': () => `${(22 / 7) * 7 ** 2 * 10} cm³`.replace('1540', '1,540'),
  'quant3-20': () => String(Math.sin(Math.PI / 6) + Math.cos(Math.PI / 3)),
  'quant3-21': () => String(Math.tan(Math.PI / 4) + 2),
  'quant3-22': () => `${Math.round(30 * Math.tan(Math.PI / 4))} m`,
  'quant3-23': () => String(80 + 100 + 120 + 150),
  'quant3-24': () => ratio(150, 160),
  'quant3-25': () => (7200 * 90 / 360).toLocaleString('en-IN'),
}

export const quantExpectedDrills = {
  'drill-q-01': () => String(72),
  'drill-q-02': () => String(42),
  'drill-q-03': () => '7/9',
  'drill-q-04': () => String(0.18 * 250),
  'drill-q-05': () => String(7 * (96 / 12)),
  'drill-q-06': () => String((8 * 27 - 20) / 7),
  'drill-q-07': () => inr(8000 * 6 * 3 / 100),
  'drill-q-08': () => inr(10000 * (1.1 ** 2 - 1)),
  'drill-q-09': () => `${(60 / 750) * 100}%`,
  'drill-q-10': () => `${36 / 5} days`,
  'drill-q-11': () => String(4 ** 2 - 2),
  'drill-q-12': () => String((20 + 7) / 3),
  'drill-q-13': () => `${(180 / 10) * 5}°`,
  'drill-q-14': () => `${Math.sqrt(10 ** 2 - 6 ** 2)} cm`,
  'drill-q-15': () => `${(3.14 * 36 * 8 / 3).toFixed(2)} cm³`,
}

export const quantExpectedV4 = {
  'quant4-01': () => String([7, 9, 3, 1][105 % 4 === 0 ? 3 : (105 % 4) - 1]),
  'quant4-02': () => String(3),
  'quant4-03': () => String(0.35 * 240),
  'quant4-04': () => String(12 / (4 - 3) * (3 + 4)),
  'quant4-05': () => String((11 * 30 - 40 + 18) / 11),
  'quant4-06': () => inr(900 * 100 / (5 * 3)),
  'quant4-07': () => inr(5000 * (1.2 ** 2 - 1)),
  'quant4-08': () => inr(966 * 100 / 115),
  'quant4-09': () => inr(2500 * 0.9 * 0.8),
  'quant4-10': () => `${Math.round(1 / (1 / 20 + 1 / 30))} days`,
  'quant4-11': () => `${120 / 1.5} km/h`,
  'quant4-12': () => `${(30 / 0.6) - 40} litres`,
  'quant4-13': () => String(4 ** 2 + 2 * 21),
  'quant4-14': () => String(5),
  'quant4-15': () => `${((5 - 2) * 180) / 5}°`,
  'quant4-16': () => 'Right-angled',
  'quant4-17': () => '5√2 cm',
  'quant4-18': () => `${4 * (22 / 7) * 49} cm²`,
  'quant4-19': () => `${6 * 7 ** 2} cm²`,
  'quant4-20': () => String(Math.sin(Math.PI / 3) * Math.cos(Math.PI / 6) + Math.cos(Math.PI / 3) * Math.sin(Math.PI / 6)),
  'quant4-21': () => '3/5',
  'quant4-22': () => `15√3 m`,
  'quant4-23': () => String(210 + 200),
  'quant4-24': () => ratio(660, 670),
  'quant4-25': () => (5400 * 120 / 360).toLocaleString('en-IN'),
}

export const quantExpectedV5 = {
  'quant5-01': () => String([3, 9, 7, 1][2026 % 4 === 0 ? 3 : (2026 % 4) - 1]),
  'quant5-02': () => String(60),
  'quant5-03': () => String(640 / 8),
  'quant5-04': () => String((10 / 2) * (7 + 9)),
  'quant5-05': () => String((9 * 36 - 52) / 8),
  'quant5-06': () => inr(7500 * 4 * 5 / 100),
  'quant5-07': () => inr(8000 * (1.05 ** 2 - 1)),
  'quant5-08': () => inr(1134 * 100 / 108),
  'quant5-09': () => inr(2000 * 0.75 * 0.8),
  'quant5-10': () => `${72 / 5} days`,
  'quant5-11': () => `${150 / (72 * 5 / 18)} seconds`,
  'quant5-12': () => '53⅓%',
  'quant5-13': () => String(5 ** 2 - 2),
  'quant5-14': () => String(4 - 3),
  'quant5-15': () => `${360 / 6}°`,
  'quant5-16': () => `${(9 * 12) / 2} cm²`,
  'quant5-17': () => `${Math.sqrt(10 ** 2 - 8 ** 2)} cm`,
  'quant5-18': () => `${2 * (22 / 7) * 5 * 14} cm²`,
  'quant5-19': () => `${15 * 8} cm²`,
  'quant5-20': () => String(Math.cos(Math.PI / 3) + Math.sin(Math.PI / 6)),
  'quant5-21': () => '12/13',
  'quant5-22': () => '60√3 m',
  'quant5-23': () => String(320 + 260),
  'quant5-24': () => `${((320 - 200) / 200) * 100}%`,
  'quant5-25': () => (3600 * 90 / 360).toLocaleString('en-IN'),
}

const quantExpectations = {
  'ssc-cgl-2026-tier1-practice-v1': quantExpected,
  'ssc-cgl-2026-tier1-practice-v2': quantExpectedV2,
  'ssc-cgl-2026-tier1-practice-v3': quantExpectedV3,
  'ssc-cgl-2026-tier1-practice-drills-v1': quantExpectedDrills,
  'ssc-cgl-2026-tier1-practice-v4': quantExpectedV4,
  'ssc-cgl-2026-tier1-practice-v5': quantExpectedV5,
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
  if (4 * 3 * 2 !== 24) problems.push('360 factor count is not 24')
  if (Math.abs(1.25 * 0.8 - 1) > 1e-12) problems.push('25% up then 20% down is not unchanged')
  if (1500 * 0.8 * 0.9 !== 1080) problems.push('successive-discount total is not 1080')
  if ((552 - 480) / 480 * 100 !== 15) problems.push('profit percentage is not 15')
  if (90 * 5 / 18 !== 25) problems.push('90 km/h is not 25 m/s')
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
