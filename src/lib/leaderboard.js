import { mulberry32, hashString } from './utils'
import { EXAMS } from '../data/exams'

const FIRST = [
  'Aarav','Aditi','Vivaan','Ananya','Vihaan','Diya','Arjun','Saanvi','Reyansh','Ira','Kabir','Myra','Advait','Kiara','Rudra','Anika','Yash','Saanvi','Ishaan','Pari','Devansh','Navya','Karan','Riya','Rohan','Tanvi','Aryan','Meera','Krishna','Priya','Siddharth','Anjali','Manav','Sneha','Nikhil','Divya','Varun','Shreya','Om','Nisha','Akash','Kavya','Harsh','Trisha','Rahul','Pooja','Vivek','Deepa','Gaurav','Srishti','Naveen','Ritika','Siddharth','Pooja','Anupam','Shruti','Bhavesh','Ekta','Rakesh','Charu','Sunil','Megha','Vikas','Sarika','Manish','Kiran','Ashok','Neha','Manoj','Swati','Tarun','Ridhi','Yogesh','Sakshi','Harsh','Payal','Nitin','Bhavna','Ravi','Aditi','Gaurav','Preeti','Sameer','Ankita','Nishant','Juhi','Raj','Pinky','Sanjay','Kavita','Alok','Ritu','Naveen','Sonia','Deep','Babita',
]
const LAST = [
  'Sharma','Verma','Patel','Singh','Kumar','Gupta','Mehta','Reddy','Nair','Iyer','Chauhan','Rathore','Yadav','Prasad','Mishra','Tiwari','Pandey','Joshi','Desai','Kulkarni','Shetty','Naidu','Menon','Das','Bose','Ghosh','Banerjee','Chatterjee','Mukherjee','Chopra','Kapoor','Malhotra','Agarwal','Bansal','Goyal','Jain','Shah','Trivedi','Rathore','Solanki','Thakur','Pawar','Kadam','Sahu','Das','Padhy','Rao','Naidu','Set','Patil','Deshmukh','Khan','Singh','Gill','Sandhu','Dhillon','Bhatia','Saxena','Mishra','Pandey',
]
const CITIES = ['Jaipur','Delhi','Mumbai','Lucknow','Patna','Bhopal','Indore','Pune','Surat','Patna','Nagpur','Lucknow','Kolkata','Chennai','Bengaluru','Hyderabad','Ahmedabad','Coimbatore','Kochi','Guwahati','Bhubaneswar','Chandigarh','Dehradun','Raipur','Ranchi','Varanasi','Agra','Nashik','Amritsar','Madurai']

export function buildLeaderboard(examId, size = 600) {
  const rand = mulberry32(hashString('lb:' + examId))
  const rows = []
  for (let i = 0; i < size; i++) {
    // bell-ish distribution of scores
    const base = 30 + rand() * 55
    const noise = (rand() + rand() + rand() - 1.5) * 9
    const score = Math.max(6, Math.min(98, base + noise))
    rows.push({
      id: `u${i}`,
      name: FIRST[Math.floor(rand() * FIRST.length)] + ' ' + LAST[Math.floor(rand() * LAST.length)],
      city: CITIES[Math.floor(rand() * CITIES.length)],
      examId,
      score: Math.round(score * 10) / 10,
      accuracy: Math.round((0.35 + rand() * 0.6) * 100),
      time: Math.round(1200 + rand() * 2400),
      streak: 1 + Math.floor(rand() * 120),
      tests: 5 + Math.floor(rand() * 200),
      premium: rand() > 0.78,
      avatar: Math.floor(rand() * 12),
    })
  }
  rows.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy)
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

// Insert the signed-in user into the board at the right place.
export function rankUser(rows, user) {
  if (!user) return { rows, userRank: null, total: rows.length }
  const idx = rows.findIndex((r) => r.score < user.score)
  const rank = idx === -1 ? rows.length + 1 : idx + 1
  const me = {
    id: 'me',
    name: user.name,
    city: 'You',
    examId: user.examId,
    score: user.score,
    accuracy: user.accuracy,
    time: user.time,
    streak: user.streak,
    tests: user.tests,
    premium: user.plan === 'pro',
    avatar: user.avatar ?? 0,
    rank,
    isMe: true,
  }
  const merged = [...rows.slice(0, rank - 1), me, ...rows.slice(rank - 1)].map((r, i) => ({ ...r, rank: i + 1 }))
  return { rows: merged, userRank: rank, total: rows.length + 1 }
}

export function percentileOf(score, rows) {
  if (!rows.length) return 0
  const below = rows.filter((r) => r.score < score).length
  return below / rows.length
}

export const FRIENDS = [
  { id: 'f1', name: 'Rohit Meena', avatar: 3, streak: 21, score: 78.4, status: 'online' },
  { id: 'f2', name: 'Priya Sharma', avatar: 6, streak: 14, score: 74.1, status: 'online' },
  { id: 'f3', name: 'Aman Verma', avatar: 1, streak: 9, score: 69.8, status: 'away' },
  { id: 'f4', name: 'Sneha Joshi', avatar: 9, streak: 33, score: 81.6, status: 'offline' },
  { id: 'f5', name: 'Karan Rathore', avatar: 4, streak: 6, score: 63.2, status: 'online' },
]

export const LIVE_SLOTS = [
  { hour: 11, label: '11:00 AM' },
  { hour: 15, label: '3:00 PM' },
  { hour: 19, label: '7:00 PM' },
]

export function nextLiveSlot(now = new Date()) {
  for (const s of LIVE_SLOTS) {
    const d = new Date(now)
    d.setHours(s.hour, 0, 0, 0)
    if (d > now) return { ...s, at: d, startsIn: d - now }
  }
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(11, 0, 0, 0)
  return { ...LIVE_SLOTS[0], at: d, startsIn: d - now }
}

export const EXAM_IDS = EXAMS.map((e) => e.id)
