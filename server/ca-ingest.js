import { isIP } from 'node:net'
import { ContentError,digestJson,fileDigest,integer,onlyKeys,text } from './content-utils.js'
import { CA_CATEGORY_CODES,AWARD_GROUPS } from './data/ssc-cgl-ca-categories.js'
import { indiaToday,isoDate,validId } from './ca-dates.js'
import { assertCaSchema } from './ca-migration.js'
const shaRe=/^[a-f0-9]{64}$/
const refRe=/^[a-z0-9][a-z0-9._-]{0,119}$/
const hash=(value,label)=>{if(typeof value!=='string'||!shaRe.test(value))throw new ContentError(`${label} must be a lowercase SHA-256 digest`);return value}
const ref=(value,label)=>{if(typeof value!=='string'||!refRe.test(value))throw new ContentError(`${label} must be a lowercase stable identifier`);return value}
const array=(value,label,max)=>{if(!Array.isArray(value)||!value.length||value.length>max)throw new ContentError(`${label} must contain 1–${max} entries`);return value}
function flag(value,label){if(typeof value!=='boolean')throw new ContentError(`${label} must be a boolean`);return value}

// PIB and other primary sources often use ?PRID=... links. Permit public query
// parameters but reject common secret-bearing URLs. Operator must review links.
export function publicSourceUrl(value,label) {
  const input=text(value,label,{max:2000});let url
  try {url=new URL(input)} catch {throw new ContentError(`${label} must be an HTTPS URL`)}
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new ContentError(`${label} must be HTTPS without credentials or fragment`)
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,''),ip=isIP(host)
  const privateV4=ip===4&&(()=>{const p=host.split('.').map(Number);return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||
    (p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)})()
  const privateV6=ip===6&&(/^(::|::1|::ffff:)/.test(host)||/^f[cd]/.test(host)||/^fe[89ab]/.test(host))
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||privateV4||privateV6)throw new ContentError(`${label} must use a public host`)
  const sensitive=/(token|auth|password|secret|api[_-]?key|signature|session|credential|access[_-]?key|(^|[_-])sig($|[_-]))/i
  if([...url.searchParams.keys()].some(k=>sensitive.test(k)))throw new ContentError(`${label} must not contain secret query parameters`)
  return input
}
export function normalizeCaManifest(input,{today=indiaToday()}={}) {
  isoDate(today,'today');onlyKeys(input,['schema_version','revision','sources','events'],'manifest')
  if(input.schema_version!==1)throw new ContentError('Unsupported CA manifest schema_version')
  const sourceRefs=new Set(),eventKeys=new Set()
  const sources=array(input.sources,'sources',500).map(s=>{
    onlyKeys(s,['ref','title','url','evidence_sha256','rights_sha256','rights_reference','allow_republication','allow_derivatives','allow_external_processing'],'source')
    const row={ref:ref(s.ref,'source.ref'),title:text(s.title,'source.title',{max:300}),url:publicSourceUrl(s.url,'source.url'),
      evidence_sha256:hash(s.evidence_sha256,'source.evidence_sha256'),rights_sha256:hash(s.rights_sha256,'source.rights_sha256'),rights_reference:text(s.rights_reference,'source.rights_reference',{max:1000}),
      allow_republication:flag(s.allow_republication,'source.allow_republication'),allow_derivatives:flag(s.allow_derivatives,'source.allow_derivatives'),allow_external_processing:flag(s.allow_external_processing,'source.allow_external_processing')}
    if(sourceRefs.has(row.ref))throw new ContentError('Duplicate source ref')
    sourceRefs.add(row.ref);return row
  }).sort((a,b)=>a.ref.localeCompare(b.ref,'en'))
  const events=array(input.events,'events',1000).map(e=>{
    onlyKeys(e,['event_key','event_date','category','award_group','editorial_priority','title_en','fact_en','event_source_ref','static_booster'],'event')
    onlyKeys(e.static_booster,['source_ref','title_en','title_hi','fact_en','fact_hi','link_en','link_hi','translation_note','as_of'],'static_booster')
    const date=isoDate(e.event_date,'event_date'),staticDate=isoDate(e.static_booster.as_of,'static_booster.as_of')
    if(!date.startsWith('2025-')&&!date.startsWith('2026-'))throw new ContentError('CA event year must be 2025 or 2026')
    if(date>today||staticDate>today)throw new ContentError('Future events and future-dated static facts cannot be imported')
    if(!CA_CATEGORY_CODES.includes(e.category))throw new ContentError('Unsupported CA category')
    if(e.category==='Awards'&&!AWARD_GROUPS.includes(e.award_group))throw new ContentError('Awards require a Padma, National, International or Other award_group')
    if(e.category!=='Awards'&&e.award_group!=null)throw new ContentError('award_group applies only to Awards')
    const row={event_key:ref(e.event_key,'event_key'),event_date:date,category:e.category,award_group:e.award_group??null,
      editorial_priority:integer(e.editorial_priority,'editorial_priority',1,5),title_en:text(e.title_en,'event.title_en',{max:300}),
      fact_en:text(e.fact_en,'event.fact_en',{min:10,max:10000}),event_source_ref:ref(e.event_source_ref,'event_source_ref'),
      static_booster:{source_ref:ref(e.static_booster.source_ref,'static_booster.source_ref'),title_en:text(e.static_booster.title_en,'static.title_en',{max:300}),
        title_hi:text(e.static_booster.title_hi,'static.title_hi',{max:300}),fact_en:text(e.static_booster.fact_en,'static.fact_en',{min:10,max:3000}),fact_hi:text(e.static_booster.fact_hi,'static.fact_hi',{min:5,max:3000}),
        link_en:text(e.static_booster.link_en,'static.link_en',{min:10,max:1000}),link_hi:text(e.static_booster.link_hi,'static.link_hi',{min:5,max:1000}),
        translation_note:text(e.static_booster.translation_note,'static.translation_note',{max:1000}),as_of:staticDate}}
    if(eventKeys.has(row.event_key))throw new ContentError('Duplicate event_key')
    if(!sourceRefs.has(row.event_source_ref)||!sourceRefs.has(row.static_booster.source_ref))throw new ContentError('Every event and static booster needs a source ref in this manifest')
    eventKeys.add(row.event_key);return row
  }).sort((a,b)=>a.event_key.localeCompare(b.event_key,'en'))
  const revision=input.revision==null?null:text(input.revision,'manifest.revision',{max:200})
  return {schema_version:1,revision,sources,events}
}
export async function ingestCaManifest(client,input,evidenceIndex,{today=indiaToday()}={}) {
  const manifest=normalizeCaManifest(input,{today})
  onlyKeys(evidenceIndex,['sources'],'evidence index')
  const index=evidenceIndex.sources
  if(!index||typeof index!=='object'||Array.isArray(index)||Object.getPrototypeOf(index)!==Object.prototype)throw new ContentError('Evidence index sources must be an object')
  if(Object.keys(index).some(k=>!manifest.sources.some(s=>s.ref===k)))throw new ContentError('Evidence index contains an unknown source ref')
  const cache=new Map()
  const digest=path=>{if(!cache.has(path))cache.set(path,fileDigest(path));return cache.get(path)}
  for(const source of manifest.sources){
    const files=index[source.ref];onlyKeys(files,['evidence','rights'],`evidence index for ${source.ref}`)
    if(typeof files.evidence!=='string'||typeof files.rights!=='string'||!files.evidence||!files.rights)throw new ContentError('Evidence and rights file paths are required')
    const [contentHash,rightsHash]=await Promise.all([digest(files.evidence),digest(files.rights)])
    if(contentHash!==source.evidence_sha256||rightsHash!==source.rights_sha256)throw new ContentError(`Evidence digest mismatch for ${source.ref}; no events imported`)
  }
  const fingerprint=digestJson(manifest)
  await client.query('BEGIN')
  try{
    await client.query('SELECT pg_advisory_xact_lock($1)',[729006]);await assertCaSchema(client)
    const {rows:[prior]}=await client.query('SELECT id FROM cgl_ca_imports WHERE manifest_sha256=$1',[fingerprint])
    if(prior){await client.query('COMMIT');return {imported:false,import_id:prior.id}}
    const {rows:[batch]}=await client.query('INSERT INTO cgl_ca_imports(manifest_sha256,import_manifest) VALUES($1,$2) RETURNING id',[fingerprint,JSON.stringify(manifest)])
    const ids=new Map()
    for(const s of manifest.sources){
      const {rows:[saved]}=await client.query(`INSERT INTO cgl_ca_sources(import_id,source_ref,title,source_url,evidence_sha256,rights_sha256,rights_reference,allow_republication,allow_derivatives,allow_external_processing)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[batch.id,s.ref,s.title,s.url,s.evidence_sha256,s.rights_sha256,s.rights_reference,s.allow_republication,s.allow_derivatives,s.allow_external_processing])
      ids.set(s.ref,saved.id)
    }
    const eventIds=[]
    for(const e of manifest.events){const b=e.static_booster
      const {rows:[saved]}=await client.query(`INSERT INTO cgl_ca_events(import_id,event_key,event_date,category,award_group,editorial_priority,title_en,fact_en,event_source_id,static_source_id,
        static_title_en,static_title_hi,static_fact_en,static_fact_hi,static_link_en,static_link_hi,static_translation_note,static_as_of)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id,event_key`,
        [batch.id,e.event_key,e.event_date,e.category,e.award_group,e.editorial_priority,e.title_en,e.fact_en,ids.get(e.event_source_ref),ids.get(b.source_ref),b.title_en,b.title_hi,b.fact_en,b.fact_hi,b.link_en,b.link_hi,b.translation_note,b.as_of])
      eventIds.push(saved)
    }
    await client.query('COMMIT');return {imported:true,import_id:batch.id,events:eventIds}
  }catch(error){await client.query('ROLLBACK');throw error}
}
export async function publishCaEvent(client,{eventId,reviewer,notes}) {
  const id=validId(eventId);reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'review notes',{min:10,max:2000})
  await client.query('BEGIN')
  try{
    await assertCaSchema(client)
    const {rows:[event]}=await client.query('SELECT id,status FROM cgl_ca_events WHERE id=$1 FOR UPDATE',[id])
    if(!event)throw new ContentError('CA event not found')
    if(event.status==='Published'){await client.query('COMMIT');return {published:false,event_id:id,status:'Published'}}
    if(['Withdrawn','Rejected'].includes(event.status))throw new ContentError('Withdrawn or rejected events cannot be republished; import a corrected version')
    await client.query("UPDATE cgl_ca_events SET status='Published',reviewed_by=$2,review_notes=$3,reviewed_at=NOW() WHERE id=$1",[id,reviewer,notes])
    await client.query('COMMIT');return {published:true,event_id:id,status:'Published'}
  }catch(error){await client.query('ROLLBACK');throw error}
}
