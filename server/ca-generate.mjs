import {pool} from './db.js'
import {providerFromEnv} from './ai-provider.js'
import {assertCaSchema} from './ca-migration.js'
import {generateCaQuestion} from './ca-ai.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no database was changed.')
  const event=flag('--event'),all=args.includes('--all'),limitRaw=flag('--limit'),year=flag('--year')
  if((!!event===all)||(all&&(!limitRaw||!/^\d+$/.test(limitRaw)||Number(limitRaw)<1||Number(limitRaw)>25))||(year&&!['2025','2026'].includes(year)))throw new Error('Usage: ca:generate -- --event ID OR --all --limit 1..25 [--year 2025|2026]')
  const provider=providerFromEnv(),client=await pool.connect()
  try{
    await assertCaSchema(client)
    if(event)console.log(JSON.stringify(await generateCaQuestion(client,{eventId:event},provider)))
    else{
      const {rows}=await client.query(`SELECT e.id FROM cgl_ca_events e JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id
        WHERE e.status='Published' AND s.allow_republication AND s.allow_derivatives AND s.allow_external_processing AND t.allow_republication AND t.allow_derivatives AND t.allow_external_processing
        AND ($1::int IS NULL OR EXTRACT(YEAR FROM e.event_date)=$1) AND NOT EXISTS (SELECT 1 FROM cgl_ca_questions q WHERE q.event_id=e.id AND q.status IN ('Verified_Draft','Published'))
        ORDER BY e.event_date,e.id LIMIT $2`,[year?Number(year):null,Number(limitRaw)])
      const results=[]
      for(const item of rows){try{results.push({event_id:item.id,...await generateCaQuestion(client,{eventId:item.id},provider)})}catch(error){results.push({event_id:item.id,error:error.message});process.exitCode=1}}
      console.log(JSON.stringify({requested_limit:Number(limitRaw),processed:results.length,results}))
    }
  }finally{client.release()}
}catch(error){console.error(`CA generation failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
