import { ContentError, httpsUrl, text } from './content-utils.js'

// Configured by the operator, never by an HTTP caller. Credentials stay in the
// process environment and are never placed in generated records or logs.
export function createOpenAICompatibleProvider({baseUrl,apiKey,generatorModel,solverModel,auditorModel,fetchImpl=fetch,timeoutMs=60000}) {
  const base=httpsUrl(baseUrl,'AI_BASE_URL').replace(/\/+$/,'')
  const url=new URL(base)
  if (url.search || url.hash) throw new ContentError('AI_BASE_URL must not include query parameters or a fragment')
  const key=text(apiKey,'AI_API_KEY',{max:4000})
  const models={generator:text(generatorModel,'AI_GENERATOR_MODEL',{max:200}),solver:text(solverModel,'AI_SOLVER_MODEL',{max:200}),auditor:text(auditorModel,'AI_AUDITOR_MODEL',{max:200})}
  if (models.generator===models.solver) throw new ContentError('Configure a different solver model for independent verification')
  if (typeof fetchImpl!=='function') throw new ContentError('AI provider fetch is unavailable')
  if (!Number.isInteger(timeoutMs) || timeoutMs<1000 || timeoutMs>300000) throw new ContentError('AI timeout must be 1000–300000 milliseconds')
  return {models, async complete(role,{system,user}) {
    if (!Object.hasOwn(models,role)) throw new ContentError('Invalid AI provider role')
    let response
    try { response=await fetchImpl(`${base}/chat/completions`, {method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),
      headers:{'content-type':'application/json','authorization':`Bearer ${key}`},
      body:JSON.stringify({model:models[role],temperature:role==='generator'?0.5:0,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(user)}]})})
    } catch { throw new ContentError(`AI ${role} request failed or timed out`) }
    if (!response.ok) throw new ContentError(`AI ${role} provider returned HTTP ${response.status}`)
    const length=Number(response.headers?.get('content-length') || 0)
    if (length>1_000_000) throw new ContentError(`AI ${role} response is too large`)
    let raw=''
    if (response.body?.getReader) {
      const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0
      try {
        for (;;) {
          const {done,value}=await reader.read();if(done)break
          bytes+=value.byteLength
          if(bytes>1_000_000){await reader.cancel();throw new ContentError(`AI ${role} response is too large`)}
          raw+=decoder.decode(value,{stream:true})
        }
        raw+=decoder.decode()
      } finally {reader.releaseLock()}
    } else {
      raw=await response.text()
      if (raw.length>1_000_000) throw new ContentError(`AI ${role} response is too large`)
    }
    let payload,content
    try { payload=JSON.parse(raw);content=payload.choices?.[0]?.message?.content } catch { throw new ContentError(`AI ${role} returned invalid JSON`) }
    if (typeof content!=='string' || content.length>300_000) throw new ContentError(`AI ${role} returned no usable content`)
    try { return JSON.parse(content) } catch { throw new ContentError(`AI ${role} did not return a JSON object`) }
  }}
}
export function providerFromEnv(env=process.env) {
  return createOpenAICompatibleProvider({baseUrl:env.AI_BASE_URL || 'https://api.openai.com/v1',apiKey:env.AI_API_KEY,
    generatorModel:env.AI_GENERATOR_MODEL,solverModel:env.AI_SOLVER_MODEL,auditorModel:env.AI_AUDITOR_MODEL,timeoutMs:env.AI_TIMEOUT_MS===undefined ? 120000 : Number(env.AI_TIMEOUT_MS)})
}
