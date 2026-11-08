import {Router} from 'express'
import {ContentError} from './content-utils.js'
import {masterStatus} from './master-migration.js'
import {askMentor} from './mentor-service.js'
import {createMentorLimiter,MentorError} from './mentor-provider.js'
import {formatCatalog} from './master-formats.js'
import {sourceAvailability} from './master-sources.js'
import {MasterSelectionError} from './master-solver.js'
import {prepareMasterMock,launchMasterMock,getActiveMaster,saveMasterResponses,submitMasterMock,reviewMasterMock,cancelMasterMock,advanceMasterSection,listMasterMocks,readMasterMock,simulateMasterTier1} from './master-service.js'

const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next)
const page=(value,fallback,name)=>{if(value===undefined)return fallback;if(typeof value!=='string'||!/^\d{1,7}$/.test(value))throw new ContentError(`Invalid ${name}`);return Number(value)}
export function createMasterRouter({pool,query,auth,mentorOptions}){
  const router=Router(),mentorLimiter=mentorOptions?.limiter||createMentorLimiter()
  const ready=asyncRoute(async(_req,res,next)=>{const state=await masterStatus(query);if(!state.ok)return res.status(503).json(state);next()})
  const withClient=(fn,status=200)=>async(req,res,next)=>{
    let client
    try{
      client=await pool.connect();const result=await fn(client,req)
      if(result?.invalidated)return res.status(409).json(result)
      res.status(status).json(result)
    }catch(error){next(error)}finally{client?.release()}
  }
  router.get('/master/formats',asyncRoute(async(_req,res)=>{
    const [assembler,optional_sources]=await Promise.all([masterStatus(query),sourceAvailability(query)])
    res.json({...formatCatalog,assembler,optional_sources})
  }))
  router.post('/master/mocks',ready,auth,withClient((client,req)=>prepareMasterMock(client,req.userId,req.body),201))
  // The create wrapper is explicit about its 201 status; all operations require
  // backend JWT ownership. No public authoring or answer-key endpoint exists.
  // Aggregate all submitted sessions for accurate stage totals and an IST-day
  // streak, rather than treating the paginated recent-history list as complete.
  router.get('/master/summary',ready,auth,asyncRoute(async(req,res)=>{
    const {rows:counts}=await query(`SELECT exam_stage,COUNT(*)::int AS completed FROM cgl_master_mocks
      WHERE user_id=$1 AND status='Submitted' AND exam_stage IS NOT NULL GROUP BY exam_stage`,[req.userId])
    const {rows:[streak]}=await query(`WITH today AS (SELECT (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date AS day),
      days AS (SELECT DISTINCT (m.submitted_at AT TIME ZONE 'Asia/Kolkata')::date AS day FROM cgl_master_mocks m
        WHERE m.user_id=$1 AND m.status='Submitted' AND m.submitted_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM cgl_master_responses r WHERE r.mock_id=m.id AND r.selected_option_index IS NOT NULL)),
      numbered AS (SELECT days.day,ROW_NUMBER() OVER (ORDER BY days.day DESC)::int AS n FROM days,today WHERE days.day<=today.day),
      base AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM days WHERE days.day=today.day) THEN today.day ELSE today.day-1 END AS day FROM today)
      SELECT COUNT(*) FILTER (WHERE numbered.day=base.day-(numbered.n-1))::int AS current_streak FROM numbered CROSS JOIN base`,[req.userId])
    res.json({stages:{Tier_1:counts.find(r=>r.exam_stage==='Tier_1')?.completed??0,Tier_2:counts.find(r=>r.exam_stage==='Tier_2')?.completed??0},
      current_streak:streak.current_streak,time_zone:'Asia/Kolkata'})
  }))
  router.get('/master/mocks',ready,auth,asyncRoute(async(req,res)=>{
    res.json(await listMasterMocks(query,req.userId,{limit:page(req.query.limit,50,'limit'),offset:page(req.query.offset,0,'offset'),stage:req.query.stage??null,status:req.query.status??null}))
  }))
  // User-attempt routes for assembler-backed papers. They deliberately retain
  // their own IDs/tables: cgl_user_attempts refers only to published legacy
  // cgl_mock_tests and cannot represent mixed-source assembled questions.
  router.get('/attempts/master',ready,auth,asyncRoute(async(req,res)=>{
    res.json(await listMasterMocks(query,req.userId,{limit:page(req.query.limit,50,'limit'),offset:page(req.query.offset,0,'offset'),stage:req.query.stage??null,status:'Submitted'}))
  }))
  router.get('/attempts/master/:id',ready,auth,withClient((client,req)=>reviewMasterMock(client,req.userId,req.params.id)))
  router.post('/attempts/master/:id/mentor',ready,auth,async(req,res,next)=>{
    const release=mentorLimiter.enter(req.userId)
    if(!release){res.set('Retry-After','60');return res.status(429).json({error:'AI Mentor is busy or the request limit has been reached. Please try again shortly.',code:'MENTOR_RATE_LIMIT'})}
    let client;const controller=new AbortController()
    const disconnected=()=>{if(!res.writableEnded)controller.abort()}
    res.once('close',disconnected)
    try{client=await pool.connect();const result=await askMentor(client,req.userId,req.params.id,req.body,{...mentorOptions,signal:controller.signal});if(!res.destroyed)res.json(result)}
    catch(error){if(!res.destroyed)next(error)}finally{res.removeListener('close',disconnected);client?.release();release()}
  })
  router.post('/attempts/master/:id/simulate',ready,auth,withClient((client,req)=>simulateMasterTier1(client,req.userId,req.params.id,req.body??{})))
  router.post('/attempts/master/:id/submit',ready,auth,withClient((client,req)=>submitMasterMock(client,req.userId,req.params.id,req.body??{})))
  router.get('/master/mocks/:id',ready,auth,asyncRoute(async(req,res)=>res.json(await readMasterMock(query,req.userId,req.params.id))))
  router.post('/master/mocks/:id/launch',ready,auth,withClient((client,req)=>launchMasterMock(client,req.userId,req.params.id)))
  router.get('/master/mocks/:id/active',ready,auth,withClient((client,req)=>getActiveMaster(client,req.userId,req.params.id)))
  router.put('/master/mocks/:id/responses',ready,auth,withClient((client,req)=>saveMasterResponses(client,req.userId,req.params.id,req.body)))
  router.post('/master/mocks/:id/advance',ready,auth,withClient((client,req)=>advanceMasterSection(client,req.userId,req.params.id,req.body)))
  router.post('/master/mocks/:id/submit',ready,auth,withClient((client,req)=>submitMasterMock(client,req.userId,req.params.id,req.body??{})))
  router.get('/master/mocks/:id/review',ready,auth,withClient((client,req)=>reviewMasterMock(client,req.userId,req.params.id)))
  router.post('/master/mocks/:id/cancel',ready,auth,withClient((client,req)=>cancelMasterMock(client,req.userId,req.params.id)))
  router.use((error,_req,res,next)=>{
    if(error instanceof MentorError)return res.status(error.status).json({error:error.message,code:error.code})
    if(error instanceof ContentError)return res.status(400).json({error:error.message})
    if(error instanceof MasterSelectionError){
      const status=error.code==='NOT_FOUND'?404:/MIGRATION_REQUIRED|CHECKSUM_MISMATCH|ASSEMBLER_BUSY|ASSEMBLER_TIMEOUT|ASSEMBLER_POOL_TOO_LARGE|ASSEMBLER_FAILED/.test(error.code)?503:409
      return res.status(status).json({error:error.message,code:error.code,...(Object.keys(error.details).length?{details:error.details}:{})})
    }
    next(error)
  })
  return router
}
