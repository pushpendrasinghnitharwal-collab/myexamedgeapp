import test from 'node:test'
import assert from 'node:assert/strict'
import {createMentorProvider,createMentorLimiter,mentorProviderFromEnv} from '../mentor-provider.js'
import {lockAndCheckSource} from '../mentor-service.js'

test('Mentor provider keeps credentials server-side, bounds replies and fails closed',async()=>{
  assert.equal(mentorProviderFromEnv({}),null)
  assert.equal(mentorProviderFromEnv({MENTOR_API_KEY:'x',MENTOR_MODEL:'m',MENTOR_BASE_URL:'http://insecure'}),null)
  let sent
  const provider=createMentorProvider({baseUrl:'https://ai.example/v1',apiKey:'server-secret',model:'fixture',fetchImpl:async(url,request)=>{
    sent={url,request};return new Response(JSON.stringify({choices:[{message:{content:'a'.repeat(2000)}}]}),{status:200})
  }})
  const answer=await provider.complete({question:'Fictional question',reviewed_basic_solution:'Fictional basic',reviewed_trick_solution:'Fictional trick'})
  assert.equal(answer.length,1800);assert.equal(sent.url,'https://ai.example/v1/chat/completions')
  assert.equal(sent.request.headers.authorization,'Bearer server-secret');assert.equal(JSON.parse(sent.request.body).model,'fixture')
  assert.doesNotMatch(answer,/server-secret/)
  const rejecting=createMentorProvider({baseUrl:'https://ai.example/v1',apiKey:'server-secret',model:'fixture',fetchImpl:async()=>new Response('private provider error',{status:500})})
  await assert.rejects(rejecting.complete({}),e=>e.code==='MENTOR_PROVIDER_UNAVAILABLE'&&!e.message.includes('private'))
  const oversized=createMentorProvider({baseUrl:'https://ai.example/v1',apiKey:'x',model:'fixture',fetchImpl:async()=>new Response('x'.repeat(100001))})
  await assert.rejects(oversized.complete({}),e=>e.code==='MENTOR_PROVIDER_UNAVAILABLE')
})

test('Mentor limiter enforces per-user, concurrency, global and expiry limits',()=>{
  let time=1000;const limiter=createMentorLimiter({now:()=>time,perUser:2,global:3,maxConcurrent:2,windowMs:100})
  const first=limiter.enter(1);assert.ok(first);assert.equal(limiter.enter(1),null,'one in-flight request per account')
  const second=limiter.enter(2);assert.ok(second);assert.equal(limiter.enter(3),null,'global concurrency cap')
  first();first();const third=limiter.enter(1);assert.ok(third);third();assert.equal(limiter.enter(1),null,'per-account window cap')
  second();assert.equal(limiter.enter(3),null,'global window cap');time+=101;assert.ok(limiter.enter(3),'window expires')
})

test('all CA source flags and source availability are checked before external processing',async()=>{
  const base={q_status:'Published',e_status:'Published',event_derivatives:true,event_external:true,static_derivatives:true,static_external:true}
  const item={source_kind:'CA',source_id:'1'},review={mock:{selection:{}}}
  const client=value=>({query:async()=>({rows:[value]})})
  await lockAndCheckSource(client(base),item,review,false)
  for(const name of ['event_derivatives','event_external','static_derivatives','static_external']){
    await assert.rejects(lockAndCheckSource(client({...base,[name]:false}),item,review,true),e=>e.code==='MENTOR_RIGHTS_REQUIRED')
    await lockAndCheckSource(client({...base,[name]:false}),item,review,false,false)
  }
  for(const name of ['q_status','e_status'])await assert.rejects(lockAndCheckSource(client({...base,[name]:'Withdrawn'}),item,review,true),e=>e.code==='MENTOR_CONTENT_UNAVAILABLE')
})

test('Bank defaults to deny; AI derivatives require a published parent and explicit external permission',async()=>{
  const review={mock:{selection:{}}},bank={source_kind:'Bank',source_id:'1'},ai={source_kind:'AI',source_id:'2'}
  const bankClient={query:async()=>({rows:[{status:'Published',passage_set_id:null}]})}
  await assert.rejects(lockAndCheckSource(bankClient,bank,review,false),e=>e.code==='MENTOR_RIGHTS_REQUIRED')
  await lockAndCheckSource(bankClient,bank,review,true)
  const aiClient=paper=>({query:async sql=>({rows:[sql.includes('cgl_pyq_papers')?paper:{status:'Published'}]})})
  await lockAndCheckSource(aiClient({status:'Published',allow_derivatives:true,allow_external_processing:true}),ai,review,false)
  for(const field of ['allow_derivatives','allow_external_processing']){
    await assert.rejects(lockAndCheckSource(aiClient({status:'Published',allow_derivatives:true,allow_external_processing:true,[field]:false}),ai,review,true),e=>e.code==='MENTOR_RIGHTS_REQUIRED')
  }
  await assert.rejects(lockAndCheckSource(aiClient({status:'Withdrawn',allow_derivatives:true,allow_external_processing:true}),ai,review,true),e=>e.code==='MENTOR_CONTENT_UNAVAILABLE')
})

test('provider timeout aborts a pending HTTP request without exposing its error',async()=>{
  let wasAborted=false
  const provider=createMentorProvider({baseUrl:'https://ai.example/v1',apiKey:'secret',model:'fixture',timeoutMs:1000,fetchImpl:(_url,{signal})=>new Promise((_,reject)=>{
    signal.addEventListener('abort',()=>{wasAborted=true;reject(new Error('sensitive provider details'))},{once:true})
  })})
  // Timeout signals are unref'ed in Node; this timer keeps the test alive.
  const keepAlive=setTimeout(()=>{},1500)
  try{await assert.rejects(provider.complete({}),e=>e.code==='MENTOR_PROVIDER_UNAVAILABLE'&&!e.message.includes('sensitive'));assert.equal(wasAborted,true)}finally{clearTimeout(keepAlive)}
})
