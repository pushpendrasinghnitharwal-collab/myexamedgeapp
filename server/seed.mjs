import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query, initSchema, pool } from './db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(fs.readFileSync(path.join(here, 'seed-data.json'), 'utf-8'))

await initSchema()

// Seed exams
for (const e of data.exams) {
  await query(
    `INSERT INTO exams (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [e.id, JSON.stringify(e)]
  )
}

// Seed questions
let inserted = 0
for (const q of data.questions) {
  await query(
    `INSERT INTO questions (id, topic, subject, diff, exams, q_en, q_hi, o_en, o_hi, a, exp_en, exp_hi)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       topic=EXCLUDED.topic, subject=EXCLUDED.subject, diff=EXCLUDED.diff,
       exams=EXCLUDED.exams, q_en=EXCLUDED.q_en, q_hi=EXCLUDED.q_hi,
       o_en=EXCLUDED.o_en, o_hi=EXCLUDED.o_hi, a=EXCLUDED.a,
       exp_en=EXCLUDED.exp_en, exp_hi=EXCLUDED.exp_hi`,
    [
      q.id,
      q.topic,
      data.topics[q.topic]?.subject || 'ga',
      q.diff,
      JSON.stringify(q.exams),
      q.q.en,
      q.q.hi,
      JSON.stringify(q.o.map((o) => o.en)),
      JSON.stringify(q.o.map((o) => o.hi)),
      q.a,
      q.exp.en,
      q.exp.hi,
    ]
  )
  inserted++
}

const { rows } = await query('SELECT COUNT(*)::int AS c FROM questions')
console.log(`Seeded ${inserted} questions (table now has ${rows[0].c}), ${data.exams.length} exams.`)
await pool.end()
