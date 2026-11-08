import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'

export class ContentError extends Error {}
export function stableJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  throw new ContentError('Unsupported value in JSON content')
}
export const sha256 = value => createHash('sha256').update(value).digest('hex')
export const digestJson = value => sha256(stableJson(value))
export function text(value,label,{min=1,max=1000,optional=false}={}) {
  if (optional && (value === null || value === undefined)) return null
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new ContentError(`${label} must be nonempty text (maximum ${max} characters)`)
  return value.trim()
}
export function integer(value,label,min,max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new ContentError(`${label} must be an integer from ${min} to ${max}`)
  return value
}
export function onlyKeys(obj,allowed,label) {
  if (!obj || typeof obj!=='object' || Array.isArray(obj) || Object.getPrototypeOf(obj)!==Object.prototype) throw new ContentError(`${label} must be an object`)
  const extra=Object.keys(obj).filter(key=>!allowed.includes(key))
  if (extra.length) throw new ContentError(`${label} has unsupported fields: ${extra.join(', ')}`)
}
export function httpsUrl(value,label) {
  const input=text(value,label,{max:2000})
  let url
  try { url=new URL(input) } catch { throw new ContentError(`${label} must be an HTTPS URL`) }
  if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw new ContentError(`${label} must be an HTTPS URL without credentials, query parameters or fragments`)
  return input
}
export async function fileDigest(path,{maxBytes=50*1024*1024}={}) {
  const info=await stat(path)
  if (!info.isFile() || info.size<1 || info.size>maxBytes) throw new ContentError(`Evidence file must be a non-empty regular file under ${maxBytes} bytes`)
  return sha256(await readFile(path))
}
