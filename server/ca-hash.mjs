import {fileDigest} from './content-utils.js'
const paths=process.argv.slice(2)
try{
  if(paths.length!==2)throw new Error('Usage: npm run ca:hash -- SOURCE_EVIDENCE RIGHTS_EVIDENCE')
  const [evidence_sha256,rights_sha256]=await Promise.all(paths.map(p=>fileDigest(p)))
  console.log(JSON.stringify({evidence_sha256,rights_sha256},null,2))
}catch(error){console.error(`CA evidence hashing failed: ${error.message}`);process.exitCode=1}
