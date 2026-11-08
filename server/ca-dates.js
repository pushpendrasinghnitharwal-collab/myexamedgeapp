import { ContentError, integer } from './content-utils.js'

// Calendar boundaries are India-local and do not depend on the server timezone.
export function indiaToday(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const fields=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return `${fields.year}-${fields.month}-${fields.day}`
}
export function isoDate(value,label='date') {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ContentError(`${label} must be YYYY-MM-DD`)
  const date=new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10)!==value) throw new ContentError(`${label} is not a real calendar date`)
  return value
}
export const pad = value=>String(value).padStart(2,'0')
export function monthBounds(year,month) {
  integer(year,'year',2025,2026);integer(month,'month',1,12)
  const last=new Date(Date.UTC(year,month,0)).getUTCDate()
  return {start:`${year}-${pad(month)}-01`,end:`${year}-${pad(month)}-${pad(last)}`,days:last}
}
// Within-month weeks: 1–7, 8–14, 15–21, 22–28, 29–month end.
// The last window can be shorter and none crosses a month boundary.
export function weekBounds(year,month,week) {
  const {days}=monthBounds(year,month)
  integer(week,'week',1,5)
  const first=1+(week-1)*7
  if (first>days) throw new ContentError('This month does not have that weekly window')
  const last=Math.min(first+6,days)
  return {start:`${year}-${pad(month)}-${pad(first)}`,end:`${year}-${pad(month)}-${pad(last)}`,partial_window:last-first+1<7}
}
export function weekNumber(date) {return Math.ceil(Number(isoDate(date).slice(-2))/7)}
export function yearBounds(year) {integer(year,'year',2025,2026);return {start:`${year}-01-01`,end:`${year}-12-31`}}
export function validId(value) {const str=String(value??'');if(!/^[1-9]\d{0,17}$/.test(str)) throw new ContentError('Invalid ID');return str}
