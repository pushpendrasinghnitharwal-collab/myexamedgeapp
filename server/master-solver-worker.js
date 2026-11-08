import {parentPort} from 'node:worker_threads'
import solver from 'javascript-lp-solver'
parentPort.once('message',model=>{
  try{parentPort.postMessage({ok:true,result:solver.Solve(model)})}
  catch(error){parentPort.postMessage({ok:false,error:error.message})}
})
