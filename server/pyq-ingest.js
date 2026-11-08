import { ContentError, digestJson, fileDigest, httpsUrl, integer, onlyKeys, text } from './content-utils.js'
import { PYQ_MIGRATION_CHECKSUM, PYQ_MIGRATION_VERSION } from './pyq-migration.js'

const shaRe=/^[a-f0-9]{64}$/
const stages=['Tier_1','Tier_2']
const optText=(value,label,max=10000)=>text(value,label,{optional:true,max})
function checkHash(value,label) {
  if (typeof value!=='string' || !shaRe.test(value)) throw new ContentError(`${label} must be a lowercase SHA-256 digest`)
  return value
}
function checkDate(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ContentError('exam_date must be YYYY-MM-DD')
  const parsed=new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0,10)!==value) throw new ContentError('exam_date is not a valid calendar date')
  return value
}
function options(value,label) {
  if (!Array.isArray(value) || value.length!==4) throw new ContentError(`${label} must have four choices in source order`)
  return value.map((item,i)=>{
    onlyKeys(item,['en','hi'],`${label}[${i}]`)
    return {en:text(item.en,`${label}[${i}].en`,{max:3000}),hi:optText(item.hi,`${label}[${i}].hi`,3000)}
  })
}
function marks(value,label,{positive=false}={}) {
  if (typeof value!=='number' || !Number.isFinite(value) || value < (positive ? 0.01 : 0) || value>1000 || Math.abs(value*100-Math.round(value*100))>1e-7) throw new ContentError(`${label} must be a nonnegative value with at most two decimal places`)
  return value
}
function array(value,label,max) {
  if (!Array.isArray(value) || value.length>max) throw new ContentError(`${label} must be an array with at most ${max} entries`)
  return value
}

// Input is a redacted, transcribed, rights-cleared manifest. This validation
// checks structure and evidence digests, not authenticity or legal rights.
export function normalizePyqManifest(value) {
  onlyKeys(value,['schema_version','paper','source','sections','passages','questions'],'manifest')
  if (value.schema_version!==1) throw new ContentError('Unsupported manifest schema_version')
  const paper=value.paper, src=value.source
  onlyKeys(paper,['cycle_year','exam_stage','paper_code','exam_date','shift_label','title','duration_seconds','expected_questions'],'paper')
  onlyKeys(src,['paper_url','final_key_url','final_key_type','paper_sha256','final_key_sha256','rights_sha256','rights_reference','source_description','allow_derivatives','allow_external_processing','redacted'],'source')
  if (!stages.includes(paper.exam_stage)) throw new ContentError('Invalid paper exam_stage')
  if (src.final_key_type!=='Final' || src.redacted!==true || typeof src.allow_derivatives!=='boolean' || typeof src.allow_external_processing!=='boolean') throw new ContentError('A final key, redaction attestation and explicit AI permissions are required')
  if (src.allow_external_processing && !src.allow_derivatives) throw new ContentError('External AI processing requires derivative permission as well')
  const normalized={schema_version:1,paper:{
    cycle_year:integer(paper.cycle_year,'cycle_year',2021,2025),exam_stage:paper.exam_stage,
    paper_code:text(paper.paper_code,'paper_code',{max:100}),exam_date:checkDate(paper.exam_date),
    shift_label:text(paper.shift_label,'shift_label',{max:100}),title:text(paper.title,'title',{max:300}),
    duration_seconds:integer(paper.duration_seconds,'duration_seconds',1,86400),expected_questions:integer(paper.expected_questions,'expected_questions',1,300),
  },source:{paper_url:httpsUrl(src.paper_url,'paper_url'),final_key_url:httpsUrl(src.final_key_url,'final_key_url'),final_key_type:'Final',
    paper_sha256:checkHash(src.paper_sha256,'paper_sha256'),final_key_sha256:checkHash(src.final_key_sha256,'final_key_sha256'),rights_sha256:checkHash(src.rights_sha256,'rights_sha256'),
    rights_reference:text(src.rights_reference,'rights_reference',{max:1000}),source_description:text(src.source_description,'source_description',{max:1000}),
    allow_derivatives:src.allow_derivatives,allow_external_processing:src.allow_external_processing,redacted:true},sections:[],passages:[],questions:[]}
  const sections=new Map(), positions=new Set()
  for (const s of array(value.sections,'sections',30)) {
    onlyKeys(s,['code','label','position','expected_questions','correct_marks','wrong_deduction'],'section')
    const row={code:text(s.code,'section.code',{max:100}),label:text(s.label,'section.label',{max:200}),position:integer(s.position,'section.position',1,30),
      expected_questions:integer(s.expected_questions,'section.expected_questions',1,300),correct_marks:marks(s.correct_marks,'section.correct_marks',{positive:true}),wrong_deduction:marks(s.wrong_deduction,'section.wrong_deduction')}
    if (sections.has(row.code) || positions.has(row.position)) throw new ContentError('Duplicate section code or position')
    sections.set(row.code,row);positions.add(row.position);normalized.sections.push(row)
  }
  if (!sections.size || [...sections.values()].reduce((sum,s)=>sum+s.expected_questions,0)!==normalized.paper.expected_questions) throw new ContentError('Expected section counts must sum to the full paper count')
  const passages=new Set()
  for (const p of array(value.passages || [],'passages',100)) {
    onlyKeys(p,['ref','text_en','text_hi','translation_note'],'passage')
    const row={ref:text(p.ref,'passage.ref',{max:120}),text_en:text(p.text_en,'passage.text_en',{max:20000}),text_hi:optText(p.text_hi,'passage.text_hi',20000),translation_note:optText(p.translation_note,'passage.translation_note',1000)}
    if (row.text_hi && !row.translation_note) throw new ContentError('Passage translation_note must identify original or translated Hindi text')
    if (passages.has(row.ref)) throw new ContentError('Duplicate passage reference')
    passages.add(row.ref);normalized.passages.push(row)
  }
  const refs=new Set(), qPositions=new Set(), sectionCounts=new Map()
  for (const q of array(value.questions,'questions',300)) {
    onlyKeys(q,['source_question_ref','section_code','position','subject','chapter','sub_chapter','canonical','passage_ref','question_text_en','question_text_hi','translation_note','media_url','options','answer_status','correct_option_indices','void_policy','solution_basic','solution_trick'],'question')
    const canonical=q.canonical
    if (canonical!==null && canonical!==undefined) {
      onlyKeys(canonical,['subject','topic','sub_topic','exam_stage'],'canonical')
      if (![normalized.paper.exam_stage,'Both'].includes(canonical.exam_stage)) throw new ContentError('Canonical mapping stage does not match paper')
    }
    const row={source_question_ref:text(q.source_question_ref,'source_question_ref',{max:120}),section_code:text(q.section_code,'section_code',{max:100}),
      position:integer(q.position,'question.position',1,normalized.paper.expected_questions),subject:text(q.subject,'subject',{max:120}),chapter:text(q.chapter,'chapter',{max:200}),
      sub_chapter:optText(q.sub_chapter,'sub_chapter',200),canonical:canonical?{subject:text(canonical.subject,'canonical.subject',{max:120}),topic:text(canonical.topic,'canonical.topic',{max:200}),sub_topic:text(canonical.sub_topic,'canonical.sub_topic',{max:200}),exam_stage:canonical.exam_stage}:null,
      passage_ref:optText(q.passage_ref,'passage_ref',120),question_text_en:text(q.question_text_en,'question_text_en',{max:10000}),question_text_hi:optText(q.question_text_hi,'question_text_hi'),
      translation_note:optText(q.translation_note,'translation_note',1000),media_url:q.media_url == null ? null : httpsUrl(q.media_url,'media_url'),options:options(q.options,'options'),
      answer_status:q.answer_status,correct_option_indices:q.correct_option_indices,void_policy:q.void_policy ?? null,
      solution_basic:optText(q.solution_basic,'solution_basic'),solution_trick:optText(q.solution_trick,'solution_trick')}
    if ((row.question_text_hi || row.options.some(option=>option.hi)) && !row.translation_note) throw new ContentError('Question translation_note must identify original or translated Hindi text')
    if (!sections.has(row.section_code) || (row.passage_ref && !passages.has(row.passage_ref))) throw new ContentError('Question references an unknown section or passage')
    if (refs.has(row.source_question_ref) || qPositions.has(row.position)) throw new ContentError('Duplicate question reference or position')
    const a=row.correct_option_indices
    if (!Array.isArray(a) || a.some(x=>!Number.isInteger(x)||x<0||x>3) || new Set(a).size!==a.length ||
      !((row.answer_status==='Single' && a.length===1 && row.void_policy===null) || (row.answer_status==='Multiple' && a.length>=2 && a.length<=4 && row.void_policy===null) ||
        (row.answer_status==='Void' && a.length===0 && ['Excluded','All_Awarded'].includes(row.void_policy)))) throw new ContentError('Invalid final-key answer status, indices or void policy')
    refs.add(row.source_question_ref);qPositions.add(row.position)
    sectionCounts.set(row.section_code,(sectionCounts.get(row.section_code)||0)+1)
    if (sectionCounts.get(row.section_code)>sections.get(row.section_code).expected_questions) throw new ContentError('Too many questions in section')
    normalized.questions.push(row)
  }
  normalized.sections.sort((a,b)=>a.position-b.position)
  normalized.questions.sort((a,b)=>a.position-b.position)
  normalized.passages.sort((a,b)=>a.ref.localeCompare(b.ref))
  return normalized
}

export async function assertPyqSchema(client) {
  const {rows:[table]}=await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
  if (!table.present) throw new ContentError('Apply migration 001 and PYQ migration 003 first')
  const {rows:[version]}=await client.query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1',[PYQ_MIGRATION_VERSION])
  if (!version || version.checksum!==PYQ_MIGRATION_CHECKSUM) throw new ContentError('PYQ migration 003 missing or checksum differs')
}

// Dedicated client only. If any row, evidence or FK fails, no draft is inserted.
export async function ingestPyqManifest(client, input, evidence, {replaceDraft=false}={}) {
  if (typeof replaceDraft!=='boolean') throw new ContentError('replaceDraft must be a boolean')
  const manifest=normalizePyqManifest(input)
  if (!evidence?.paper || !evidence?.finalKey || !evidence?.rights) throw new ContentError('Paper, final-key and rights evidence files are required')
  const [paperHash,keyHash,rightsHash]=await Promise.all([fileDigest(evidence.paper),fileDigest(evidence.finalKey),fileDigest(evidence.rights)])
  if (paperHash!==manifest.source.paper_sha256 || keyHash!==manifest.source.final_key_sha256 || rightsHash!==manifest.source.rights_sha256) throw new ContentError('Evidence digest mismatch; no paper imported')
  const hash=digestJson(manifest), p=manifest.paper, s=manifest.source
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)',[729004])
    await assertPyqSchema(client)
    const {rows:[previous]}=await client.query('SELECT p.id,p.status,p.import_sha256 AS current_hash FROM cgl_pyq_import_history h JOIN cgl_pyq_papers p ON p.id=h.paper_id WHERE h.import_sha256=$1',[hash])
    if (previous && (!replaceDraft || previous.status!=='Draft' || previous.current_hash===hash)) {
      await client.query('COMMIT'); return {imported:false,paper_id:previous.id,status:previous.status}
    }
    const {rows:[existing]}=await client.query(`SELECT id,status,import_manifest FROM cgl_pyq_papers
      WHERE cycle_year=$1 AND exam_stage=$2 AND exam_date=$3 AND shift_label=$4 AND paper_code=$5 AND status IN ('Draft','Published') FOR UPDATE`,
      [p.cycle_year,p.exam_stage,p.exam_date,p.shift_label,p.paper_code])
    let paper, oldPassages=new Set(), oldQuestions=new Set(),rebuild=false
    if (replaceDraft && !existing) throw new ContentError('No active draft matches this identity; nothing was replaced')
    if (existing) {
      if (existing.status!=='Draft') throw new ContentError('A published paper with this shift identity is immutable; withdraw it first')
      if (replaceDraft) {
        const {rows:[linked]}=await client.query(`SELECT EXISTS(SELECT 1 FROM cgl_pyq_attempts WHERE paper_id=$1)
          OR EXISTS(SELECT 1 FROM cgl_ai_batches b JOIN cgl_pyq_questions q ON q.id=b.source_question_id WHERE q.paper_id=$1) AS present`,[existing.id])
        if (linked.present) throw new ContentError('This draft has dependent records and cannot be replaced')
        await client.query('DELETE FROM cgl_pyq_questions WHERE paper_id=$1',[existing.id])
        await client.query('DELETE FROM cgl_pyq_passages WHERE paper_id=$1',[existing.id])
        await client.query('DELETE FROM cgl_pyq_sections WHERE paper_id=$1',[existing.id])
        await client.query(`UPDATE cgl_pyq_papers SET title=$2,duration_seconds=$3,expected_questions=$4,paper_url=$5,final_key_url=$6,final_key_type=$7,
          paper_sha256=$8,final_key_sha256=$9,rights_sha256=$10,rights_reference=$11,source_description=$12,allow_derivatives=$13,allow_external_processing=$14,
          import_sha256=$15,import_manifest=$16 WHERE id=$1`,[existing.id,p.title,p.duration_seconds,p.expected_questions,s.paper_url,s.final_key_url,s.final_key_type,
          s.paper_sha256,s.final_key_sha256,s.rights_sha256,s.rights_reference,s.source_description,s.allow_derivatives,s.allow_external_processing,hash,JSON.stringify(manifest)])
        rebuild=true
      } else {
        const old=existing.import_manifest
        if (digestJson(old.paper)!==digestJson(manifest.paper) || digestJson(old.source)!==digestJson(manifest.source) || digestJson(old.sections)!==digestJson(manifest.sections)) throw new ContentError('Draft source, paper identity or section rules conflict; no content was replaced')
        const nextPassages=new Map(manifest.passages.map(item=>[item.ref,item]))
        const nextQuestions=new Map(manifest.questions.map(item=>[item.source_question_ref,item]))
        for (const item of old.passages) {
          if (!nextPassages.has(item.ref) || digestJson(item)!==digestJson(nextPassages.get(item.ref))) throw new ContentError('Draft extension cannot remove or change an existing passage')
          oldPassages.add(item.ref)
        }
        for (const item of old.questions) {
          if (!nextQuestions.has(item.source_question_ref) || digestJson(item)!==digestJson(nextQuestions.get(item.source_question_ref))) throw new ContentError('Draft extension cannot remove or change an existing question')
          oldQuestions.add(item.source_question_ref)
        }
      }
      paper=existing
    } else {
      const inserted=await client.query(`INSERT INTO cgl_pyq_papers(cycle_year,exam_stage,paper_code,exam_date,shift_label,title,duration_seconds,expected_questions,
        paper_url,final_key_url,final_key_type,paper_sha256,final_key_sha256,rights_sha256,rights_reference,source_description,allow_derivatives,allow_external_processing,import_sha256,import_manifest)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
        [p.cycle_year,p.exam_stage,p.paper_code,p.exam_date,p.shift_label,p.title,p.duration_seconds,p.expected_questions,s.paper_url,s.final_key_url,s.final_key_type,s.paper_sha256,s.final_key_sha256,s.rights_sha256,s.rights_reference,s.source_description,s.allow_derivatives,s.allow_external_processing,hash,JSON.stringify(manifest)])
      paper=inserted.rows[0]
    }
    if (!existing || rebuild) for (const x of manifest.sections) await client.query(`INSERT INTO cgl_pyq_sections(paper_id,section_code,label,position,expected_questions,correct_marks,wrong_deduction) VALUES($1,$2,$3,$4,$5,$6,$7)`,[paper.id,x.code,x.label,x.position,x.expected_questions,x.correct_marks,x.wrong_deduction])
    for (const x of manifest.passages.filter(item=>!oldPassages.has(item.ref))) await client.query('INSERT INTO cgl_pyq_passages(paper_id,passage_ref,text_en,text_hi,translation_note) VALUES($1,$2,$3,$4,$5)',[paper.id,x.ref,x.text_en,x.text_hi,x.translation_note])
    for (const q of manifest.questions.filter(item=>!oldQuestions.has(item.source_question_ref))) await client.query(`INSERT INTO cgl_pyq_questions(paper_id,section_code,source_question_ref,position,subject,chapter,sub_chapter,canonical_subject,canonical_topic,canonical_sub_topic,canonical_stage,passage_ref,question_text_en,question_text_hi,translation_note,media_url,options,answer_status,correct_option_indices,void_policy,solution_basic,solution_trick)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [paper.id,q.section_code,q.source_question_ref,q.position,q.subject,q.chapter,q.sub_chapter,q.canonical?.subject||null,q.canonical?.topic||null,q.canonical?.sub_topic||null,q.canonical?.exam_stage||null,q.passage_ref,q.question_text_en,q.question_text_hi,q.translation_note,q.media_url,JSON.stringify(q.options),q.answer_status,JSON.stringify(q.correct_option_indices),q.void_policy,q.solution_basic,q.solution_trick])
    if (existing && !rebuild) await client.query('UPDATE cgl_pyq_papers SET import_sha256=$2,import_manifest=$3 WHERE id=$1',[paper.id,hash,JSON.stringify(manifest)])
    await client.query('INSERT INTO cgl_pyq_import_history(import_sha256,paper_id,import_manifest) VALUES($1,$2,$3) ON CONFLICT(import_sha256) DO NOTHING',[hash,paper.id,JSON.stringify(manifest)])
    await client.query('COMMIT')
    return {imported:true,extended:!!existing&&!rebuild,replaced:rebuild,paper_id:paper.id,status:'Draft',questions:manifest.questions.length,expected_questions:p.expected_questions}
  } catch (error) { await client.query('ROLLBACK'); throw error }
}

// Local operator review, never an unauthenticated HTTP write. It records the
// explicit attestation; neither hashes nor this flag prove rights or accuracy.
export async function publishPyqPaper(client, {paperId,reviewer,notes}) {
  const id=String(paperId||'')
  if (!/^[1-9]\d{0,17}$/.test(id)) throw new ContentError('Invalid paper ID')
  reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'review notes',{min:10,max:2000})
  await client.query('BEGIN')
  try {
    await assertPyqSchema(client)
    const {rows:[paper]}=await client.query('SELECT id,status FROM cgl_pyq_papers WHERE id=$1 FOR UPDATE',[id])
    if (!paper) throw new ContentError('Paper not found')
    if (paper.status==='Published') { await client.query('COMMIT');return {published:false,paper_id:id,status:'Published'} }
    if (paper.status==='Withdrawn') throw new ContentError('Withdrawn papers cannot be republished; import a corrected version')
    await client.query("UPDATE cgl_pyq_papers SET status='Published',reviewed_by=$2,review_notes=$3,reviewed_at=NOW() WHERE id=$1",[id,reviewer,notes])
    await client.query('COMMIT');return {published:true,paper_id:id,status:'Published'}
  } catch (error) { await client.query('ROLLBACK');throw error }
}

// Withdrawal hides source content and derivative batches without deleting learner history.
export async function withdrawPyqPaper(client,{paperId,reviewer,notes}) {
  const id=String(paperId||'')
  if (!/^[1-9]\d{0,17}$/.test(id)) throw new ContentError('Invalid paper ID')
  reviewer=text(reviewer,'reviewer',{max:200});notes=text(notes,'withdrawal notes',{min:10,max:2000})
  await client.query('BEGIN')
  try {
    await assertPyqSchema(client)
    const {rows:[paper]}=await client.query('SELECT id,status FROM cgl_pyq_papers WHERE id=$1 FOR UPDATE',[id])
    if (!paper) throw new ContentError('Paper not found')
    if (paper.status==='Withdrawn') {await client.query('COMMIT');return {withdrawn:false,paper_id:id,status:'Withdrawn'}}
    if (paper.status!=='Published') throw new ContentError('Only a published paper can be withdrawn')
    await client.query("UPDATE cgl_pyq_papers SET status='Withdrawn',withdrawn_by=$2,withdrawal_notes=$3,withdrawn_at=NOW() WHERE id=$1",[id,reviewer,notes])
    await client.query('COMMIT');return {withdrawn:true,paper_id:id,status:'Withdrawn'}
  } catch(error){await client.query('ROLLBACK');throw error}
}
