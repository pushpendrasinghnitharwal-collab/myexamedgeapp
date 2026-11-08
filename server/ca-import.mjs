import {readFile,stat} from 'node:fs/promises'
import {pool} from './db.js'
import {ingestCaManifest} from './ca-ingest.js'
const [file,...args]=process.argv.slice(2)
function flag(name){const i=args.indexOf(name);return i<0?null:args[i+1]}
try{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required; no database was changed.')
  const evidence=flag('--evidence-index')
  if(!file||!evidence)throw new Error('Usage: npm run ca:import -- manifest.json --evidence-index evidence-paths.json')
  if((await stat(file)).size>20*1024*1024||(await stat(evidence)).size>1024*1024)throw new Error('Manifest or evidence index is too large')
  const [manifest,index]=await Promise.all([readFile(file,'utf8').then(JSON.parse),readFile(evidence,'utf8').then(JSON.parse)])
  const client=await pool.connect()
  try{console.log(JSON.stringify(await ingestCaManifest(client,manifest,index)))}finally{client.release()}
}catch(error){console.error(`CA import failed: ${error.message}`);process.exitCode=1}finally{await pool.end()}
