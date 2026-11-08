// The database remains authoritative. The displayed clock uses the server's
// deadline interval and both elapsed clocks, so a suspended browser cannot
// lengthen a section merely because performance.now() paused during sleep.
export function timerAnchor(timer, wallNow, monotonicNow) {
  if (timer?.state !== 'Active' || !Number.isFinite(timer.module_remaining_seconds)) return null
  const serverNow = Date.parse(timer.server_now)
  const deadline = Date.parse(timer.deadline)
  const interval = Number.isFinite(serverNow) && Number.isFinite(deadline)
    ? deadline - serverNow
    : timer.module_remaining_seconds * 1000
  return { remainingMs: Math.max(0, interval), wallNow, monotonicNow }
}

export function remainingSeconds(anchor, wallNow, monotonicNow) {
  if (!anchor) return null
  const elapsed = Math.max(0, wallNow - anchor.wallNow, monotonicNow - anchor.monotonicNow)
  return Math.max(0, Math.ceil((anchor.remainingMs - elapsed) / 1000))
}
