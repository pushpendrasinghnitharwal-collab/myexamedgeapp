import { pool } from './db.js'
import { assertPyqSchema } from './pyq-ingest.js'
const id=process.argv[2]
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
  if (!id || !/^[1-9]\d{0,17}$/.test(id)) throw new Error('Usage: npm run pyq:inspect -- PAPER_ID')
  const client=await pool.connect()
  try {
    await assertPyqSchema(client)
    const {rows:[paper]}=await client.query("SELECT p.*,to_char(p.exam_date,'YYYY-MM-DD') AS exam_date FROM cgl_pyq_papers p WHERE p.id=$1",[id])
    if (!paper) throw new Error('Paper not found')
    const {rows:sections}=await client.query('SELECT * FROM cgl_pyq_sections WHERE paper_id=$1 ORDER BY position',[id])
    const {rows:passages}=await client.query('SELECT * FROM cgl_pyq_passages WHERE paper_id=$1 ORDER BY passage_ref',[id])
    const {rows:questions}=await client.query('SELECT * FROM cgl_pyq_questions WHERE paper_id=$1 ORDER BY position',[id])
    console.log(JSON.stringify({paper,sections,passages,questions},null,2))
  } finally {client.release()}
} catch(error){console.error(`PYQ inspection failed: ${error.message}`);process.exitCode=1}
finally{await pool.end()}
