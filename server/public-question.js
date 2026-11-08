// Public question payloads may include flexible nested JSON (e.g. chart data).
// Remove answer, solution, explanation and verification keys recursively. This
// is not a substitute for reviewing text, images and external links for answers.
export function redactPublicQuestion(value){
  if(Array.isArray(value))return value.map(redactPublicQuestion)
  if(!value||typeof value!=='object')return value
  const sensitive=/^(?:correct|iscorrect|answer|solution|explanation|verification|staticgkbooster|voidpolicy|finalkey)/i
  return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!sensitive.test(key.replace(/[_\-\s]/g,'')))
    .map(([key,child])=>[key,redactPublicQuestion(child)]))
}
