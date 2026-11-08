import {ContentError,integer,text} from './content-utils.js'
import {validId} from './ca-dates.js'
import {masterStatus} from './master-migration.js'
import {sourceAvailability} from './master-sources.js'

// Trusted editorial annotation, not a public HTTP write. The previous label is
// retained in append-only history, while already assembled items keep a snapshot.
export async function labelMasterQuestion(client,{kind,id,part=0,difficulty,mains_level,reviewer,notes}){
  if(!['Bank','AI','CA'].includes(kind))throw new ContentError('kind must be Bank, AI or CA')
  id=validId(id);part=integer(part,'part',0,300)
  if((kind==='AI'&&part===0)||(kind!=='AI'&&part!==0))throw new ContentError('AI requires a one-based question part; Bank and CA use part 0')
  if(!['Easy','Medium','Hard'].includes(difficulty)||typeof mains_level!=='boolean')throw new ContentError('Specify a valid difficulty and boolean mains_level')
  reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'label notes',{min:10,max:2000})
  await client.query('BEGIN')
  try{
    await client.query('SELECT pg_advisory_xact_lock($1,hashtext($2))',[729010,`${kind}:${id}:${part}`])
    const status=await masterStatus(client.query.bind(client));if(!status.ok)throw new ContentError('Apply the master assembler migration first')
    const availability=await sourceAvailability(client.query.bind(client))
    if(kind==='Bank'){
      const {rows:[q]}=await client.query('SELECT status,difficulty,exam_stage FROM cgl_questions WHERE id=$1 FOR SHARE',[id])
      if(!q||q.status!=='Published')throw new ContentError('A published bank question is required')
      if(q.difficulty!==difficulty)throw new ContentError('Bank labels cannot override the reviewed native difficulty')
      if(mains_level&&q.exam_stage==='Tier_1')throw new ContentError('A Tier-I-only question cannot be labelled Mains Level')
    }else if(kind==='AI'){
      if(!availability.pyq.ok)throw new ContentError('Apply the PYQ/AI migration first')
      const {rows:[b]}=await client.query(`SELECT b.status,b.exam_stage,b.content,p.status AS paper_status FROM cgl_ai_batches b
        JOIN cgl_pyq_questions q ON q.id=b.source_question_id JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE b.id=$1 FOR SHARE OF b,p`,[id])
      if(!b||b.status!=='Published'||b.paper_status!=='Published'||!b.content?.questions?.[part-1])throw new ContentError('A published AI question with active source is required')
      if(mains_level&&b.exam_stage!=='Tier_2')throw new ContentError('A Tier-I AI question cannot be labelled Mains Level')
    }else{
      if(!availability.ca.ok)throw new ContentError('Apply the current-affairs migration first')
      const {rows:[q]}=await client.query(`SELECT q.status,e.status AS event_status FROM cgl_ca_questions q JOIN cgl_ca_events e ON e.id=q.event_id WHERE q.id=$1 FOR SHARE OF q,e`,[id])
      if(!q||q.status!=='Published'||q.event_status!=='Published')throw new ContentError('A published CA question with active source is required')
    }
    await client.query(`INSERT INTO cgl_master_label_history(source_kind,source_id,source_part,difficulty,mains_level,reviewer,notes) VALUES($1,$2,$3,$4,$5,$6,$7)`,[kind,id,part,difficulty,mains_level,reviewer,notes])
    await client.query(`INSERT INTO cgl_master_question_labels(source_kind,source_id,source_part,difficulty,mains_level,reviewer,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_kind,source_id,source_part) DO UPDATE SET difficulty=EXCLUDED.difficulty,
      mains_level=EXCLUDED.mains_level,reviewer=EXCLUDED.reviewer,notes=EXCLUDED.notes,updated_at=NOW()`,[kind,id,part,difficulty,mains_level,reviewer,notes])
    await client.query('COMMIT');return {kind,id,part,difficulty,mains_level,labelled:true}
  }catch(error){await client.query('ROLLBACK');throw error}
}
