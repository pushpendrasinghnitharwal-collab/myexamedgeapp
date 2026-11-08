// Both the retained legacy runner and the server-backed CGL session must avoid
// suggesting a reload while answers or a timed module are in progress.
export function isTestRoute(route){
  const path=String(route||'').split('?')[0]
  return ['/test','/session','/dest'].some(prefix=>path===prefix||path.startsWith(`${prefix}/`))
}
