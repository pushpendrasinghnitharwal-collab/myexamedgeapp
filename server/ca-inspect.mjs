import {pool} from './db.js'
import {assertCaSchema} from './ca-migration.js'
import {validId} from './ca-dates.js'
const [kind,inputId]=process.argv.slice(2)
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.')
  if(!['event','question','mock'].includes(kind)||!inputId)throw new Error('Usage: npm run ca:inspect -- event|question|mock ID')
  const id=validId(inputId),client=await pool.connect()
  try{
    await assertCaSchema(client)
    if(kind==='event'){
      const {rows:[event]}=await client.query(`SELECT e.*,to_char(e.event_date,'YYYY-MM-DD') AS event_date,to_char(e.static_as_of,'YYYY-MM-DD') AS static_as_of,
        row_to_json(s) AS event_source,row_to_json(t) AS static_source FROM cgl_ca_events e JOIN cgl_ca_sources s ON s.id=e.event_source_id
        JOIN cgl_ca_sources t ON t.id=e.static_source_id WHERE e.id=$1`,[id])
      if(!event)throw new Error('CA event not found');console.log(JSON.stringify(event,null,2))
    }else if(kind==='question'){
      const {rows:[q]}=await client.query('SELECT * FROM cgl_ca_questions WHERE id=$1',[id]);if(!q)throw new Error('CA question not found');console.log(JSON.stringify(q,null,2))
    }else{
      const {rows:[mock]}=await client.query(`SELECT m.*,to_char(m.period_start,'YYYY-MM-DD') AS period_start,to_char(m.period_end,'YYYY-MM-DD') AS period_end,
        to_char(m.as_of_date,'YYYY-MM-DD') AS as_of_date FROM cgl_ca_mocks m WHERE m.id=$1`,[id]);if(!mock)throw new Error('CA mock not found')
      const {rows:items}=await client.query(`SELECT i.position,q.id AS question_id,q.status AS question_status,q.content,q.verification,e.id AS event_id,e.status AS event_status,
        e.event_key,to_char(e.event_date,'YYYY-MM-DD') AS event_date,e.category,e.award_group,e.fact_en,e.static_fact_en,e.static_fact_hi,e.static_link_en,e.static_link_hi,
        s.source_url AS event_source_url,t.source_url AS static_source_url FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id
        JOIN cgl_ca_events e ON e.id=i.event_id JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id WHERE i.mock_id=$1 ORDER BY i.position`,[id])
      console.log(JSON.stringify({mock,items},null,2))
    }
  }finally{client.release()}
}catch(error){console.error(`CA inspection failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
