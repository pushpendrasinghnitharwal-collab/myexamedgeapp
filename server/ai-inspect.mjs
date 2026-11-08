import { pool } from './db.js'
import { assertPyqSchema } from './pyq-ingest.js'
const id=process.argv[2]
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
  if (!id || !/^[1-9]\d{0,17}$/.test(id)) throw new Error('Usage: npm run ai:inspect -- BATCH_ID')
  const client=await pool.connect()
  try {
    await assertPyqSchema(client)
    const {rows:[batch]}=await client.query('SELECT id,source_question_id,exam_stage,format,subject,topic,sub_topic,generator_model,solver_model,auditor_model,content,verification,status FROM cgl_ai_batches WHERE id=$1',[id])
    if (!batch) throw new Error('Batch not found')
    console.log(JSON.stringify(batch,null,2))
  } finally {client.release()}
} catch(error){console.error(`AI inspection failed: ${error.message}`);process.exitCode=1}
finally{await pool.end()}
