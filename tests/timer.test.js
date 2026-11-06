import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionTiming } from '../src/lib/timer.js'

test('timed sessions use elapsed wall-clock time, including skipped timer ticks', () => {
  const start = 1_000_000
  assert.deepEqual(sessionTiming(start, 120, start + 1_999), { elapsed: 1, remaining: 119, expired: false })
  assert.deepEqual(sessionTiming(start, 120, start + 123_000), { elapsed: 123, remaining: 0, expired: true })
  assert.deepEqual(sessionTiming(start, 120, start - 5_000), { elapsed: 0, remaining: 120, expired: false })
})
