import {ContentError} from './content-utils.js'

// Shared by the master assembler and the older Bank/PYQ/AI/CA submission
// routes. Always acquire before locking source rows so a concurrent submission
// cannot commit new attributable exposure halfway through master selection.
export function lockLearnerContent(client,userId){
  const id=Number(userId)
  if(!Number.isInteger(id)||id<1||id>2147483647)throw new ContentError('Invalid backend account')
  return client.query('SELECT pg_advisory_xact_lock($1,$2)',[729009,id])
}
