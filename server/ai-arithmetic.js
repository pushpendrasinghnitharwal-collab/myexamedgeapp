import { ContentError } from './content-utils.js'

// A tiny exact rational-expression interpreter. It never runs model-supplied
// source code, imports, shell commands or JavaScript. It checks the declared
// expression against numerical options, not whether it matches the prose.
const LIMIT=10n**60n
function gcd(a,b) { a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b]}return a||1n }
function frac(n,d=1n) {
  if (d===0n) throw new ContentError('Division by zero in verification expression')
  if (d<0n){n=-n;d=-d}
  const g=gcd(n,d);n/=g;d/=g
  if (n>LIMIT || n< -LIMIT || d>LIMIT) throw new ContentError('Verification expression exceeds numeric limits')
  return {n,d}
}
export function parseNumericOption(text) {
  if (typeof text!=='string') return null
  let v=text.trim().replace(/−/g,'-')
  let percent=false
  if (v.endsWith('%')) {percent=true;v=v.slice(0,-1).trim()}
  if (v.includes(',')) {
    const grouped=/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,9})?$/.test(v) || /^-?\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d{1,9})?$/.test(v)
    if (!grouped) return null
    v=v.replace(/,/g,'')
  }
  let result
  if (/^-?\d{1,15}\/\d{1,15}$/.test(v)) {
    const [n,d]=v.split('/').map(BigInt); if(d===0n)return null; result=frac(n,d)
  } else if (/^-?\d{1,15}(?:\.\d{1,9})?$/.test(v)) {
    const negative=v.startsWith('-'), unsigned=negative?v.slice(1):v, [whole,dec='']=unsigned.split('.')
    result=frac(BigInt((negative?'-':'')+whole+dec),10n**BigInt(dec.length))
  } else return null
  return percent ? frac(result.n,result.d*100n) : result
}
export function evaluateExpression(expression) {
  let visited=0
  function walk(node,depth) {
    if (++visited>80 || depth>12) throw new ContentError('Verification expression is too complex')
    if (Number.isSafeInteger(node) && Math.abs(node)<=1_000_000_000) return frac(BigInt(node))
    if (!node || typeof node!=='object' || Array.isArray(node) || Object.keys(node).sort().join(',')!=='args,op' || !Array.isArray(node.args) || node.args.length!==2) throw new ContentError('Invalid verification expression node')
    const a=walk(node.args[0],depth+1),b=walk(node.args[1],depth+1)
    switch(node.op) {
      case 'add':return frac(a.n*b.d+b.n*a.d,a.d*b.d)
      case 'sub':return frac(a.n*b.d-b.n*a.d,a.d*b.d)
      case 'mul':return frac(a.n*b.n,a.d*b.d)
      case 'div':return frac(a.n*b.d,a.d*b.n)
      case 'pow':if (b.d!==1n || b.n<0n || b.n>5n) throw new ContentError('Exponent must be an integer from 0 to 5');return frac(a.n**b.n,a.d**b.n)
      default:throw new ContentError('Unsupported verification operation')
    }
  }
  return walk(expression,0)
}
export function checkNumericExpression(expression, options, expectedIndex) {
  const result=evaluateExpression(expression), parsed=options.map(o=>parseNumericOption(o.en))
  if (parsed.some(x=>x===null)) throw new ContentError('Numeric code verification requires four plain numeric English options')
  const matching=parsed.map((v,i)=>v.n*result.d===result.n*v.d ? i : -1).filter(i=>i>=0)
  if (matching.length!==1 || matching[0]!==expectedIndex) throw new ContentError('Numeric code verification disagrees or has non-unique options')
  return {method:'exact_rational_expression',result:`${result.n}/${result.d}`,matched_index:matching[0], caveat:'Checks the declared expression, not its correspondence to the question wording.'}
}
