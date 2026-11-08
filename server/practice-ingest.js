import { practiceContentHash } from './practice-content.js'
import { practiceStatus } from './practice-migration.js'

export const PREVIEW_REVIEWER = 'PREVIEW BUILD — automated checks only; NOT human reviewed'

const normalize = value => String(value).toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[.,;:!?'"()[\]{}\-–—]/g, '').trim()

function reviewState(mode) {
  if (mode === 'draft') return 'draft'
  if (mode === 'preview') return 'preview_not_human_reviewed'
  if (mode === 'publish') return 'human_reviewed'
  throw new Error(`Unknown import mode: ${mode}`)
}

async function existingPack(client, packKey) {
  const { rows } = await client.query('SELECT * FROM cgl_practice_packs WHERE pack_key=$1 FOR UPDATE', [packKey])
  return rows[0] || null
}

async function assertNoDuplicateContent(client, questions) {
  const subjects = [...new Set(questions.map(question => question.subject))]
  const { rows } = await client.query(`SELECT id, subject, question_text_en FROM cgl_questions
    WHERE subject = ANY($1::text[]) AND status IN ('Draft','Published')`, [subjects])
  const existing = new Map()
  for (const row of rows) existing.set(`${row.subject}|${normalize(row.question_text_en)}`, String(row.id))
  const clashes = []
  for (const question of questions) {
    const id = existing.get(`${question.subject}|${normalize(question.text_en)}`)
    if (id) clashes.push({ qid: question.qid, existing_question_id: id })
  }
  if (clashes.length) {
    const error = new Error(`This pack duplicates ${clashes.length} existing question(s). Remove or revise them before importing; nothing was changed.`)
    error.code = 'PRACTICE_DUPLICATE_CONTENT'
    error.details = clashes.slice(0, 10)
    throw error
  }
}

async function publishRows(client, packKey, reviewer, reviewedAt, reviewStatus) {
  const { rows: items } = await client.query('SELECT question_id, set_id FROM cgl_practice_pack_items WHERE pack_key=$1 ORDER BY position', [packKey])
  const questionIds = items.map(item => item.question_id)
  const setIds = [...new Set(items.map(item => item.set_id).filter(Boolean))]
  if (setIds.length) {
    await client.query(`UPDATE cgl_question_sets SET status='Published'
      WHERE id = ANY($1::bigint[]) AND status='Draft'`, [setIds])
  }
  await client.query(`UPDATE cgl_questions SET status='Published', reviewed_by=$2, reviewed_at=$3
    WHERE id = ANY($1::bigint[]) AND status='Draft'`, [questionIds, reviewer, reviewedAt])
  await client.query(`UPDATE cgl_question_sets SET status='Published'
    WHERE id = ANY($1::bigint[])`, [setIds])
  await client.query(`UPDATE cgl_practice_packs SET review_status=$2, reviewer=$3, reviewed_at=$4,
    published_at=COALESCE(published_at, NOW()) WHERE pack_key=$1`, [packKey, reviewStatus, reviewer, reviewedAt])
}

export async function importPracticePack(client, { content, report, mode = 'draft', reviewer = null, reviewedAt = null, importedBy = null, notes = null }) {
  if (!report?.ok) {
    const error = new Error('The practice pack failed validation; nothing was imported')
    error.code = 'PRACTICE_VALIDATION_FAILED'
    error.details = report?.errors
    throw error
  }
  if (!['draft', 'preview', 'publish'].includes(mode)) throw new Error(`Unknown import mode: ${mode}`)
  if (mode === 'publish' && !String(reviewer || '').trim()) throw new Error('Human publication requires a named reviewer')
  const contentHash = practiceContentHash(content)
  if (contentHash !== report.content_hash) throw new Error('Pack changed after validation; re-run validation')

  const schema = await practiceStatus(client.query.bind(client))
  if (!schema.ok) {
    const error = new Error(`Practice schema is not ready (${schema.code}). Run npm run migrate:practice first.`)
    error.code = schema.code
    throw error
  }

  const { pack, sets, questions } = content
  const review = reviewState(mode)
  const actualReviewer = mode === 'preview' ? PREVIEW_REVIEWER : mode === 'publish' ? reviewer : null
  const actualReviewedAt = mode === 'draft' ? null : (reviewedAt || new Date())

  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [729011])
    const previous = await existingPack(client, pack.pack_key)
    if (previous) {
      if (previous.content_sha256 !== contentHash) {
        const error = new Error('This pack key was imported with different content. Create a new pack version instead of rewriting published practice content.')
        error.code = 'PRACTICE_PACK_CHANGED'
        throw error
      }
      let published = previous.published_at !== null
      if (mode === 'publish' && previous.review_status !== 'human_reviewed') {
        await publishRows(client, pack.pack_key, actualReviewer, actualReviewedAt, 'human_reviewed')
        published = true
      }
      await client.query('COMMIT')
      return { imported: false, pack_key: pack.pack_key, review_status: mode === 'publish' ? 'human_reviewed' : previous.review_status, published, questions: 0, note: 'Already imported; no duplicate content created.' }
    }

    await assertNoDuplicateContent(client, questions)

    await client.query(`INSERT INTO cgl_practice_packs
      (pack_key, pack_version, content_sha256, exam, exam_stage, review_status, reviewer, reviewed_at, imported_by, notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [pack.pack_key, pack.pack_version, contentHash, pack.exam, pack.exam_stage, review, actualReviewer, actualReviewedAt, importedBy, notes])

    const setIds = new Map()
    const insertSet = async set => {
      const { rows: [row] } = await client.query(`INSERT INTO cgl_question_sets
        (set_type, exam_stage, subject, passage_text_en, passage_text_hi, chart_data, status)
        VALUES($1,'Tier_1',$2,$3,$4,$5,'Draft') RETURNING id`,
        [set.set_type, set.subject, set.passage_en || null, set.passage_hi || null, set.chart_data ? JSON.stringify(set.chart_data) : null])
      setIds.set(set.ref, row.id)
    }
    for (const set of sets) await insertSet(set)

    let position = 0
    for (const question of questions) {
      position++
      const { rows: [row] } = await client.query(`INSERT INTO cgl_questions
        (exam_stage, subject, topic, sub_topic, difficulty, question_type, passage_set_id,
         question_text_en, question_text_hi, options, correct_option_index,
         solution_basic, solution_basic_hi, solution_trick, solution_trick_hi,
         ideal_time_seconds, status, source_url, source_citation)
        VALUES('Tier_1',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Draft',$16,$17) RETURNING id`,
        [question.subject, question.topic, question.sub_topic, question.difficulty, question.question_type,
          question.set_ref ? setIds.get(question.set_ref) ?? null : null,
          question.text_en, question.text_hi, JSON.stringify(question.options), question.correct,
          question.solution_en, question.solution_hi, question.trick_en, question.trick_hi,
          question.ideal_time_seconds, question.source.url, question.source.citation])
      await client.query(`INSERT INTO cgl_practice_pack_items(pack_key,qid,question_id,set_ref,set_id,position)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [pack.pack_key, question.qid, row.id, question.set_ref || null, question.set_ref ? setIds.get(question.set_ref) ?? null : null, position])
    }

    if (mode !== 'draft') await publishRows(client, pack.pack_key, actualReviewer, actualReviewedAt, review)

    await client.query('COMMIT')
    return {
      imported: true,
      pack_key: pack.pack_key,
      review_status: review,
      published: mode !== 'draft',
      reviewer: actualReviewer,
      questions: questions.length,
      sets: sets.length,
      content_sha256: contentHash,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function readPracticePackStatus(query, packKey) {
  const { rows: [pack] } = await query('SELECT * FROM cgl_practice_packs WHERE pack_key=$1', [packKey])
  if (!pack) return { available: false, code: 'PRACTICE_PACK_NOT_IMPORTED' }
  const { rows: [counts] } = await query(`SELECT COUNT(*)::int AS questions,
    COUNT(*) FILTER (WHERE q.status='Published')::int AS published_questions
    FROM cgl_practice_pack_items i JOIN cgl_questions q ON q.id=i.question_id WHERE i.pack_key=$1`, [packKey])
  return {
    available: true,
    pack_key: pack.pack_key,
    review_status: pack.review_status,
    human_reviewed: pack.review_status === 'human_reviewed',
    reviewer: pack.reviewer,
    published_at: pack.published_at,
    ...counts,
  }
}
