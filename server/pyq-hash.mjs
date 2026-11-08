import { fileDigest } from './content-utils.js'
const paths=process.argv.slice(2)
try {
  if (paths.length!==3) throw new Error('Usage: npm run pyq:hash -- PAPER_EVIDENCE FINAL_KEY_EVIDENCE RIGHTS_EVIDENCE')
  const [paper_sha256,final_key_sha256,rights_sha256]=await Promise.all(paths.map(p=>fileDigest(p)))
  console.log(JSON.stringify({paper_sha256,final_key_sha256,rights_sha256},null,2))
} catch(error){console.error(`Evidence hashing failed: ${error.message}`);process.exitCode=1}
