import { readFile, stat } from 'node:fs/promises'
import { pool } from './db.js'
import { ingestPyqManifest } from './pyq-ingest.js'

const [manifestFile,...args]=process.argv.slice(2)
function flag(name) { const i=args.indexOf(name); return i<0 ? null : args[i+1] }
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.')
  if (!manifestFile || !flag('--paper-evidence') || !flag('--key-evidence') || !flag('--rights-evidence')) throw new Error('Usage: npm run pyq:import -- manifest.json --paper-evidence PATH --key-evidence PATH --rights-evidence PATH [--replace-draft]')
  if ((await stat(manifestFile)).size>20*1024*1024) throw new Error('Manifest exceeds 20 MiB')
  const manifest=JSON.parse(await readFile(manifestFile,'utf8'))
  const client=await pool.connect()
  try { console.log(JSON.stringify(await ingestPyqManifest(client,manifest,{paper:flag('--paper-evidence'),finalKey:flag('--key-evidence'),rights:flag('--rights-evidence')},{replaceDraft:args.includes('--replace-draft')}))) } finally { client.release() }
} catch(error) { console.error(`PYQ import failed: ${error.message}`);process.exitCode=1 }
finally { await pool.end() }
