import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { migrateSscCgl, fullBlueprints } from '../server/migration-core.js'

async function fixture(legacy = false) {
  const db = await PGlite.create()
  await db.exec(`CREATE TABLE users(id SERIAL PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE attempts(id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), mode TEXT NOT NULL);
    INSERT INTO users(name,password_hash) VALUES ('Existing learner','keep-hash');
    INSERT INTO attempts(user_id,mode) VALUES (1,'mock');`)
  if (legacy) await db.exec(`CREATE TABLE questions(id TEXT PRIMARY KEY,q_en TEXT); INSERT INTO questions VALUES ('q-old','unverified');
    CREATE TABLE mock_blueprints(id SERIAL PRIMARY KEY); CREATE TABLE mock_tests(id SERIAL PRIMARY KEY);
    CREATE TABLE mock_test_questions(id SERIAL PRIMARY KEY); CREATE TABLE question_sets(id SERIAL PRIMARY KEY);`)
  const client = { query: (sql, args) => sql.includes('DROP TABLE IF EXISTS mock_test_questions;') ? db.exec(sql).then(() => ({ rows: [] })) : db.query(sql, args) }
  return { db, client }
}

const options = JSON.stringify(['A','B','C','D'].map(x=>({en:x,hi:x})))
async function addQuestion(db, overrides = {}) {
  const q = { exam_stage:'Both',subject:'Quant',topic:'Fundamental Arithmetical Operations',sub_topic:'Percentages',difficulty:'Medium',question_type:'Standard_MCQ',passage_set_id:null,
    question_text_en:'Fixture question',question_text_hi:'परीक्षण प्रश्न',media_svg_or_url:null,options,correct_option_index:1,pyq_meta:JSON.stringify({is_pyq:false}),current_affairs_meta:JSON.stringify({is_ca:false}),solution_basic:'Concept steps',solution_trick:'Explain the shortcut',ideal_time_seconds:30,status:'Draft',source_url:null,source_citation:null,reviewed_by:null,reviewed_at:null,...overrides }
  const fields=Object.keys(q), values=Object.values(q)
  const {rows} = await db.query(`INSERT INTO cgl_questions (${fields.join(',')}) VALUES (${fields.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,values)
  return rows[0].id
}
const published = {status:'Published',source_url:'https://ssc.gov.in/',source_citation:'Test citation',reviewed_by:'Reviewer',reviewed_at:new Date().toISOString()}

test('guarded migration clears legacy content once while preserving accounts and personal attempts', async () => {
  const {db,client}=await fixture(true)
  try {
    let coreCalled=false
    await assert.rejects(migrateSscCgl(client,{ensureCoreSchema:async()=>{coreCalled=true}}), /--reset-legacy-bank/)
    assert.equal(coreCalled,false,'the opt-in guard runs before any core setup')
    assert.equal((await db.query("SELECT to_regclass('public.cgl_schema_migrations') AS name")).rows[0].name,null)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM questions')).rows[0].n,1)
    const result=await migrateSscCgl(client,{resetLegacyBank:true})
    assert.equal(result.applied,true); assert.equal(result.syllabusMappings,311); assert.equal(result.blueprints,2)
    const {rows:[state]}=await db.query(`SELECT to_regclass('public.questions') AS old_questions,to_regclass('public.mock_tests') AS old_mocks,
      (SELECT COUNT(*)::int FROM cgl_questions) AS questions,(SELECT COUNT(*)::int FROM cgl_question_sets) AS sets,
      (SELECT COUNT(*)::int FROM cgl_mock_tests) AS mocks,(SELECT COUNT(*)::int FROM cgl_user_attempts) AS attempts,
      (SELECT password_hash FROM users WHERE id=1) AS account,(SELECT COUNT(*)::int FROM attempts) AS history`)
    assert.deepEqual(state,{old_questions:null,old_mocks:null,questions:0,sets:0,mocks:0,attempts:0,account:'keep-hash',history:1})
    const shapes=await db.query(`SELECT b.category,b.exam_stage,SUM(s.question_count)::int questions,
      SUM(s.question_count*s.correct_marks) FILTER (WHERE s.counts_for_merit)::int merit,
      SUM(s.question_count*s.correct_marks) FILTER (WHERE NOT s.counts_for_merit)::int computer
      FROM cgl_mock_blueprints b JOIN cgl_blueprint_sections s ON s.blueprint_id=b.id GROUP BY b.id ORDER BY b.id`)
    assert.deepEqual(shapes.rows.map(r=>[r.category,r.questions,r.merit,r.computer]),[['Full_Tier1',100,200,null],['Full_Tier2',150,390,60]])
    assert.equal(fullBlueprints.length,2)
    await addQuestion(db)
    assert.equal((await migrateSscCgl(client,{resetLegacyBank:true})).applied,false)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n,1,'rerunning does not erase new data')
  } finally {await db.close()}
})

test('unknown legacy dependencies cause a complete rollback instead of cascading into user data', async () => {
  const {db,client}=await fixture(true)
  try {
    await db.exec('CREATE TABLE protected_records(id SERIAL PRIMARY KEY,question_id TEXT REFERENCES questions(id)); INSERT INTO protected_records(question_id) VALUES (\'q-old\');')
    await assert.rejects(migrateSscCgl(client,{resetLegacyBank:true,ensureCoreSchema:(c)=>c.query('CREATE TABLE core_transaction_marker(id INTEGER)')}), /depend/i)
    assert.equal((await db.query("SELECT to_regclass('public.core_transaction_marker') AS name")).rows[0].name,null)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM questions')).rows[0].n,1)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM protected_records')).rows[0].n,1)
    assert.equal((await db.query("SELECT to_regclass('public.cgl_questions') AS name")).rows[0].name,null)
    assert.equal((await db.query("SELECT to_regclass('public.mock_tests') AS name")).rows[0].name,'mock_tests')
  } finally {await db.close()}
})

test('question constraints enforce syllabus, stages, bilingual options, metadata and review', async () => {
  const {db,client}=await fixture();try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const invalid=[
      {subject:'English'}, {sub_topic:'Not on syllabus'}, {exam_stage:'Tier_1',subject:'Computer_Knowledge',topic:'Computer Basics',sub_topic:'Computer organization'},
      {difficulty:'Expert'}, {question_type:'Passage_Based'}, {media_svg_or_url:'javascript:alert(1)'}, {correct_option_index:4}, {ideal_time_seconds:0}, {solution_basic:' '},
      {options:JSON.stringify([{en:'A',hi:'अ'}])}, {options:JSON.stringify([{en:'A',hi:'अ',hint:'extra'},{en:'B',hi:'ब'},{en:'C',hi:'स'},{en:'D',hi:'द'}])}, {options:JSON.stringify([{en:'A',hi:'अ'},{en:'B',hi:'ब'},{en:'C',hi:'स'},{en:'D'}])},
      {pyq_meta:JSON.stringify({is_pyq:true,year:2020,tier:'Tier_1',exam_date:'2020-01-01',shift:'Shift 1'})},
      {pyq_meta:JSON.stringify({is_pyq:true,year:2025,tier:'Tier_1',exam_date:'2025-02-31',shift:'Shift 1'})},
      {pyq_meta:JSON.stringify({is_pyq:true,year:2025,tier:'Tier_2',exam_date:'2026-01-18',shift:'1'} )},
      {exam_stage:'Tier_1',pyq_meta:JSON.stringify({is_pyq:true,year:2025,tier:'Tier_2',exam_date:'2026-01-18',shift:'Shift 1'})},
      {current_affairs_meta:JSON.stringify({is_ca:true,year:2026,month:13,ca_category:'Awards',static_gk_link:'history'})},
      {current_affairs_meta:JSON.stringify({is_ca:true,year:2026,month:1,ca_category:'Awards',static_gk_link:'history'})},
      {status:'Published'},
    ]
    for(const fields of invalid) await assert.rejects(addQuestion(db,fields),undefined,JSON.stringify(fields))
    await addQuestion(db,{media_svg_or_url:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',pyq_meta:JSON.stringify({is_pyq:true,year:2025,tier:'Tier_2',exam_date:'2026-01-18',shift:'Shift 1'})})
    await addQuestion(db,{subject:'General_Awareness',topic:'Current Events',sub_topic:'Current events',current_affairs_meta:JSON.stringify({is_ca:true,year:2026,month:12,ca_category:'Index_Reports',static_gk_link:'Economic scene'})})
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cgl_questions')).rows[0].n,2)
  }finally{await db.close()}
})

test('passage sets enforce subject/stage and four to five children when published', async () => {
  const {db,client}=await fixture();try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const {rows:[set]}=await db.query(`INSERT INTO cgl_question_sets(set_type,exam_stage,subject,passage_text_en,passage_text_hi)
      VALUES ('Reading_Comprehension','Both','English','Passage','गद्यांश') RETURNING id`)
    await assert.rejects(db.query("UPDATE cgl_question_sets SET status='Published' WHERE id=$1",[set.id]),/4–5/)
    for(let i=0;i<4;i++) await addQuestion(db,{subject:'English',topic:'Comprehension',sub_topic:'Comprehension passage',question_type:'Passage_Based',passage_set_id:set.id})
    await db.query("UPDATE cgl_question_sets SET status='Published' WHERE id=$1",[set.id])
    await assert.rejects(addQuestion(db,{passage_set_id:set.id}),/incompatible/)
    await addQuestion(db,{subject:'English',topic:'Comprehension',sub_topic:'Comprehension passage',question_type:'Passage_Based',passage_set_id:set.id})
    await assert.rejects(addQuestion(db,{subject:'English',topic:'Comprehension',sub_topic:'Comprehension passage',question_type:'Passage_Based',passage_set_id:set.id}),/at most 5/)
    await assert.rejects(db.query("INSERT INTO cgl_question_sets(set_type,exam_stage,subject) VALUES ('Data_Interpretation','Both','Quant')"))
  }finally{await db.close()}
})

test('published mocks require complete, reviewed stage-matched questions and are immutable', async () => {
  const {db,client}=await fixture();try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const {rows:[b]}=await db.query("INSERT INTO cgl_mock_blueprints(name,category,exam_stage,target_subject) VALUES ('fixture','Subject_Wise','Tier_2','Quant') RETURNING id")
    const {rows:[s]}=await db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'I','Quant',1,1,3,1,true) RETURNING id",[b.id])
    const {rows:[m]}=await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title) VALUES ($1,'Tier_2','fixture') RETURNING id",[b.id])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/matching every blueprint/)
    const draft=await addQuestion(db)
    await db.query('INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES($1,$2,$3,$4,$5,$6)',[m.id,b.id,s.id,draft,'Quant',1])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/reviewed questions/)
    await db.query("UPDATE cgl_questions SET status='Published',exam_stage='Tier_1',source_url=$2,source_citation=$3,reviewed_by=$4,reviewed_at=$5 WHERE id=$1",[draft,published.source_url,published.source_citation,published.reviewed_by,published.reviewed_at])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/reviewed questions/)
    await db.query("UPDATE cgl_questions SET exam_stage='Both' WHERE id=$1",[draft])
    await db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id])
    await assert.rejects(db.query('DELETE FROM cgl_mock_tests WHERE id=$1',[m.id]),/immutable/)
    await assert.rejects(db.query("UPDATE cgl_questions SET question_text_en='changed' WHERE id=$1",[draft]),/immutable/)
    await assert.rejects(db.query('DELETE FROM cgl_mock_test_questions WHERE mock_test_id=$1',[m.id]),/immutable/)
    await assert.rejects(db.query("UPDATE cgl_blueprint_sections SET question_count=2 WHERE id=$1",[s.id]),/immutable/)
    await assert.rejects(db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'II','English',2,1,3,1,true)",[b.id]),/immutable/)
  }finally{await db.close()}
})

test('PYQ and current-affairs papers require matching source metadata', async () => {
  const {db,client}=await fixture();try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const {rows:[b]}=await db.query("INSERT INTO cgl_mock_blueprints(name,category,exam_stage) VALUES ('Shift fixture','PYQ_Shift_Paper','Tier_1') RETURNING id")
    const {rows:[s]}=await db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'A','Quant',1,1,2,.5,true) RETURNING id",[b.id])
    const pyq={is_pyq:true,year:2025,tier:'Tier_1',exam_date:'2026-01-18',shift:'Shift 1'}
    const {rows:[m]}=await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title,pyq_meta) VALUES ($1,'Tier_1','Shift fixture',$2) RETURNING id",[b.id,JSON.stringify(pyq)])
    const q=await addQuestion(db,published)
    await db.query('INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES ($1,$2,$3,$4,$5,1)',[m.id,b.id,s.id,q,'Quant'])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/matching verified PYQ metadata/)
    await db.query('UPDATE cgl_questions SET pyq_meta=$2 WHERE id=$1',[q,JSON.stringify(pyq)])
    await db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id])

    const {rows:[cb]}=await db.query("INSERT INTO cgl_mock_blueprints(name,category,exam_stage,ca_year,ca_month) VALUES ('Monthly fixture','CA_Monthly_2026','Tier_1',2026,7) RETURNING id")
    const {rows:[cs]}=await db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'B','General_Awareness',1,1,2,.5,true) RETURNING id",[cb.id])
    const {rows:[cm]}=await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title) VALUES ($1,'Tier_1','Monthly fixture') RETURNING id",[cb.id])
    const cq=await addQuestion(db,{...published,subject:'General_Awareness',topic:'Current Events',sub_topic:'Current events',current_affairs_meta:JSON.stringify({is_ca:true,year:2026,month:8,ca_category:'Awards',static_gk_link:'History'})})
    await db.query('INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES ($1,$2,$3,$4,$5,1)',[cm.id,cb.id,cs.id,cq,'General_Awareness'])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[cm.id]),/matching their year and month/)
    await db.query('UPDATE cgl_questions SET current_affairs_meta=$2 WHERE id=$1',[cq,JSON.stringify({is_ca:true,year:2026,month:7,ca_category:'Awards',static_gk_link:'History'})])
    await db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[cm.id])
  }finally{await db.close()}
})

test('published mocks cannot contain an incomplete passage set', async () => {
  const {db,client}=await fixture();try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const {rows:[set]}=await db.query("INSERT INTO cgl_question_sets(set_type,exam_stage,subject,passage_text_en,passage_text_hi) VALUES ('Reading_Comprehension','Both','English','Passage','गद्यांश') RETURNING id")
    const ids=[];for(let i=0;i<4;i++) ids.push(await addQuestion(db,{subject:'English',topic:'Comprehension',sub_topic:'Comprehension passage',question_type:'Passage_Based',passage_set_id:set.id}))
    await db.query("UPDATE cgl_question_sets SET status='Published' WHERE id=$1",[set.id])
    for(const id of ids) await db.query("UPDATE cgl_questions SET status='Published',source_url=$2,source_citation=$3,reviewed_by=$4,reviewed_at=$5 WHERE id=$1",[id,published.source_url,published.source_citation,published.reviewed_by,published.reviewed_at])
    const {rows:[b]}=await db.query("INSERT INTO cgl_mock_blueprints(name,category,exam_stage,target_subject) VALUES ('Passage fixture','Subject_Wise','Tier_1','English') RETURNING id")
    const {rows:[s]}=await db.query("INSERT INTO cgl_blueprint_sections(blueprint_id,section_code,subject,position,question_count,correct_marks,wrong_deduction,counts_for_merit) VALUES ($1,'D','English',1,1,2,.5,true) RETURNING id",[b.id])
    const {rows:[m]}=await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title) VALUES ($1,'Tier_1','Passage fixture') RETURNING id",[b.id])
    await db.query('INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES ($1,$2,$3,$4,$5,1)',[m.id,b.id,s.id,ids[0],'English'])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/complete passage set/)
    await db.query('UPDATE cgl_blueprint_sections SET question_count=4 WHERE id=$1',[s.id])
    for(let i=1;i<4;i++) await db.query('INSERT INTO cgl_mock_test_questions(mock_test_id,blueprint_id,section_id,question_id,subject,position) VALUES ($1,$2,$3,$4,$5,$6)',[m.id,b.id,s.id,ids[i],'English',i+1])
    await db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id])
    await assert.rejects(addQuestion(db,{subject:'English',topic:'Comprehension',sub_topic:'Comprehension passage',question_type:'Passage_Based',passage_set_id:set.id}),/cannot gain children/)
  }finally{await db.close()}
})


test('full blueprint publication enforces the official sectional timers', async () => {
  const {db,client}=await fixture();try {
    await migrateSscCgl(client,{resetLegacyBank:true})
    const {rows:[b]}=await db.query("SELECT id FROM cgl_mock_blueprints WHERE category='Full_Tier1'")
    const {rows:[m]}=await db.query("INSERT INTO cgl_mock_tests(blueprint_id,exam_stage,title) VALUES ($1,'Tier_1','Timer fixture') RETURNING id",[b.id])
    await db.query('UPDATE cgl_blueprint_sections SET time_limit_seconds=NULL WHERE blueprint_id=$1 AND subject=$2',[b.id,'English'])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/timers/)
    await db.query('UPDATE cgl_blueprint_sections SET time_limit_seconds=900 WHERE blueprint_id=$1 AND subject=$2',[b.id,'English'])
    await assert.rejects(db.query("UPDATE cgl_mock_tests SET status='Published' WHERE id=$1",[m.id]),/reviewed questions/)
  }finally{await db.close()}
})
