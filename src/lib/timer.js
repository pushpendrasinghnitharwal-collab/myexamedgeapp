// Derive the display from elapsed wall-clock time rather than counting timer ticks.
// This keeps a timed session accurate when the browser throttles background tabs.
export function sessionTiming(startTime, durationSeconds, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now - startTime) / 1000))
  const remaining = Math.max(0, durationSeconds - elapsed)
  return { elapsed, remaining, expired: remaining === 0 }
}
