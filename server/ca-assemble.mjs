import {pool} from './db.js'
import {assembleCaMock,allCaSpecs} from './ca-assembler.js'
const args=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
function numeric(name,optional=false){const raw=flag(name);if(optional&&!raw)return null;if(!raw||!/^\d+$/.test(raw))throw new Error(`A numeric ${name} is required`);return Number(raw)}
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no database was changed.')
  const stage=flag('--stage');if(!['Tier_1','Tier_2'].includes(stage))throw new Error('Use --stage Tier_1 or Tier_2')
  const all=args.includes('--all'),client=await pool.connect()
  try{
    if(all){
      const counts={},created=[]
      for(const spec of allCaSpecs(stage)){
        const result=await assembleCaMock(client,spec);const key=result.created?'Created':result.reason
        counts[key]=(counts[key]||0)+1;if(result.created)created.push({id:result.mock_id,kind:result.kind,year:result.year,month:result.month,week:result.week,category:result.category})
      }
      console.log(JSON.stringify({processed:Object.values(counts).reduce((a,b)=>a+b,0),counts,created,publication_requires_human_review:true}))
    }else{
      const spec={kind:flag('--kind'),exam_stage:stage,year:numeric('--year'),month:numeric('--month',true),week:numeric('--week',true),category:flag('--category'),award_group:flag('--award-group')}
      console.log(JSON.stringify(await assembleCaMock(client,spec)))
    }
  }finally{client.release()}
}catch(error){console.error(`CA assembly failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
