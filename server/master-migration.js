import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {MIGRATION_CHECKSUM,MIGRATION_VERSION} from './migration-core.js'

export const MASTER_MIGRATION_VERSION='005_ssc_cgl_master_assembler'
const sql=await readFile(new URL('./migrations/005_ssc_cgl_master_assembler.sql',import.meta.url),'utf8')
export const MASTER_MIGRATION_CHECKSUM=createHash('sha256').update(sql).digest('hex')
export const PLAYER_MIGRATION_VERSION='006_ssc_cgl_exam_player'
const playerSql=await readFile(new URL('./migrations/006_ssc_cgl_exam_player.sql',import.meta.url),'utf8')
export const PLAYER_MIGRATION_CHECKSUM=createHash('sha256').update(playerSql).digest('hex')
export async function migrateMasterAssembler(client){
  await client.query('BEGIN')
  try{
    await client.query('SELECT pg_advisory_xact_lock($1)',[729008])
    const {rows:[table]}=await client.query("SELECT to_regclass('public.cgl_schema_migrations') IS NOT NULL AS present")
    if(!table.present)throw new Error('Apply SSC CGL migration 001 first')
    const {rows}=await client.query('SELECT version,checksum FROM cgl_schema_migrations WHERE version IN ($1,$2,$3)',[MIGRATION_VERSION,MASTER_MIGRATION_VERSION,PLAYER_MIGRATION_VERSION])
    const old=rows.find(x=>x.version===MIGRATION_VERSION),current=rows.find(x=>x.version===MASTER_MIGRATION_VERSION),player=rows.find(x=>x.version===PLAYER_MIGRATION_VERSION)
    if(!old||old.checksum!==MIGRATION_CHECKSUM)throw new Error('SSC CGL migration 001 is missing or has a different checksum')
    if(current&&current.checksum!==MASTER_MIGRATION_CHECKSUM)throw new Error('Applied master migration checksum differs; create a new migration')
    if(player&&player.checksum!==PLAYER_MIGRATION_CHECKSUM)throw new Error('Applied exam player migration checksum differs; create a new migration')
    if(player&&!current)throw new Error('Exam player migration exists without master migration')
    if(!current){await client.query(sql);await client.query('INSERT INTO cgl_schema_migrations(version,checksum) VALUES($1,$2)',[MASTER_MIGRATION_VERSION,MASTER_MIGRATION_CHECKSUM])}
    if(!player){await client.query(playerSql);await client.query('INSERT INTO cgl_schema_migrations(version,checksum) VALUES($1,$2)',[PLAYER_MIGRATION_VERSION,PLAYER_MIGRATION_CHECKSUM])}
    await client.query('COMMIT');return {applied:!current,version:MASTER_MIGRATION_VERSION,player_applied:!player,player_version:PLAYER_MIGRATION_VERSION,seeded_questions:0,seeded_mocks:0}
  }catch(error){await client.query('ROLLBACK');throw error}
}
export async function masterStatus(query){
  const {rows:[state]}=await query(`SELECT to_regclass('public.cgl_master_mocks') IS NOT NULL AS mocks,
    to_regclass('public.cgl_master_items') IS NOT NULL AS items,to_regclass('public.cgl_master_seen') IS NOT NULL AS seen,
    to_regclass('public.cgl_master_responses') IS NOT NULL AS responses,to_regclass('public.cgl_master_question_labels') IS NOT NULL AS labels,
    to_regclass('public.cgl_master_label_history') IS NOT NULL AS label_history,
    to_regclass('public.cgl_master_player_progress') IS NOT NULL AS player_progress,
    to_regclass('public.cgl_master_player_time') IS NOT NULL AS player_time,
    to_regclass('public.cgl_master_early_advances') IS NOT NULL AS early_advances`)
  if(!Object.values(state).every(Boolean))return {ok:false,code:'SSC_CGL_MASTER_MIGRATION_REQUIRED'}
  const {rows:[version]}=await query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1',[MASTER_MIGRATION_VERSION])
  if(!version)return {ok:false,code:'SSC_CGL_MASTER_MIGRATION_REQUIRED'}
  if(version.checksum!==MASTER_MIGRATION_CHECKSUM)return {ok:false,code:'SSC_CGL_MASTER_CHECKSUM_MISMATCH'}
  const {rows:[player]}=await query('SELECT checksum FROM cgl_schema_migrations WHERE version=$1',[PLAYER_MIGRATION_VERSION])
  if(!player)return {ok:false,code:'SSC_CGL_PLAYER_MIGRATION_REQUIRED'}
  if(player.checksum!==PLAYER_MIGRATION_CHECKSUM)return {ok:false,code:'SSC_CGL_PLAYER_CHECKSUM_MISMATCH'}
  return {ok:true,schema_version:MASTER_MIGRATION_VERSION,player_version:PLAYER_MIGRATION_VERSION}
}
