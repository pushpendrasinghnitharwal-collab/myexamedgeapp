import { ContentError,text } from './content-utils.js'
import { validId } from './ca-dates.js'
import { assertCaSchema } from './ca-migration.js'
const tables={event:'cgl_ca_events',question:'cgl_ca_questions',mock:'cgl_ca_mocks'}
// A withdrawal hides dependent material but never deletes learner attempts.
export async function withdrawCaRecord(client,{kind,id,reviewer,notes}) {
  if(!Object.hasOwn(tables,kind))throw new ContentError('Invalid CA record kind')
  const table=tables[kind]
  id=validId(id);reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'withdrawal notes',{min:10,max:2000})
  await client.query('BEGIN')
  try{
    await assertCaSchema(client)
    const {rows:[record]}=await client.query(`SELECT id,status FROM ${table} WHERE id=$1 FOR UPDATE`,[id])
    if(!record)throw new ContentError('CA record not found')
    if(record.status==='Withdrawn'){await client.query('COMMIT');return {withdrawn:false,kind,id,status:'Withdrawn'}}
    if(record.status!=='Published')throw new ContentError('Only published CA records may be withdrawn')
    await client.query(`UPDATE ${table} SET status='Withdrawn',withdrawn_by=$2,withdrawal_notes=$3,withdrawn_at=NOW() WHERE id=$1`,[id,reviewer,notes])
    await client.query('COMMIT');return {withdrawn:true,kind,id,status:'Withdrawn'}
  }catch(error){await client.query('ROLLBACK');throw error}
}

// Reject a draft without deleting it; its key is released for a corrected version.
export async function rejectCaDraft(client,{kind,id,reviewer,notes}) {
  if(!Object.hasOwn(tables,kind))throw new ContentError('Invalid CA record kind')
  const table=tables[kind],expected=kind==='question'?'Verified_Draft':'Draft'
  id=validId(id);reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'rejection notes',{min:10,max:2000})
  await client.query('BEGIN')
  try{
    await assertCaSchema(client)
    const {rows:[record]}=await client.query(`SELECT id,status FROM ${table} WHERE id=$1 FOR UPDATE`,[id])
    if(!record)throw new ContentError('CA record not found')
    if(record.status==='Rejected'){await client.query('COMMIT');return {rejected:false,kind,id,status:'Rejected'}}
    if(record.status!==expected)throw new ContentError('Only unpublished CA drafts can be rejected')
    await client.query(`UPDATE ${table} SET status='Rejected',rejected_by=$2,rejection_notes=$3,rejected_at=NOW() WHERE id=$1`,[id,reviewer,notes])
    await client.query('COMMIT');return {rejected:true,kind,id,status:'Rejected'}
  }catch(error){await client.query('ROLLBACK');throw error}
}
