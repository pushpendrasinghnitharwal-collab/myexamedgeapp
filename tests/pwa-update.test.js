import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const versionMatch = source.match(/const CACHE = 'examedge-v(\d+)'/)
assert.ok(versionMatch, 'worker has a versioned ExamEdge cache')
const version = Number(versionMatch[1])
const cacheName = (offset = 0) => `examedge-v${version - offset}`

function worker({ caches, fetch = () => { throw new Error('unexpected fetch') }, onSkip = () => {}, onClaim = () => {} }) {
  const handlers = {}
  const self = {
    location: { origin: 'https://app.example' },
    addEventListener: (type, handler) => { handlers[type] = handler },
    skipWaiting: onSkip,
    clients: { claim: onClaim },
  }
  runInNewContext(source, { self, caches, fetch, URL })
  return handlers
}

function lifecycle(handler) {
  let promise
  handler({ waitUntil: (value) => { promise = value } })
  return promise
}

function request(handler, req) {
  let promise
  handler({ request: req, respondWith: (value) => { promise = value } })
  return promise
}

test('a failed offline-shell download does not activate an incomplete update', async () => {
  let skipped = false
  const caches = { open: async () => ({ addAll: async () => { throw new Error('offline') } }) }
  const handlers = worker({ caches, onSkip: () => { skipped = true } })
  await assert.rejects(lifecycle(handlers.install), /offline/)
  assert.equal(skipped, false)

  const complete = worker({ caches: { open: async () => ({ addAll: async () => {} }) }, onSkip: () => { skipped = true } })
  await lifecycle(complete.install)
  assert.equal(skipped, true)
})

test('upgrade keeps two previous ExamEdge shells and other applications’ caches', async () => {
  const removed = []
  let claimed = false
  const caches = {
    keys: async () => ['other-app', cacheName(3), cacheName(2), cacheName(1), cacheName()],
    delete: async (key) => { removed.push(key) },
  }
  const handlers = worker({ caches, onClaim: () => { claimed = true } })
  await lifecycle(handlers.activate)
  assert.deepEqual(removed, [cacheName(3)])
  assert.equal(claimed, true)
})

test('navigation bypasses the HTTP cache, preserves the offline shell on errors and works offline', async () => {
  let puts = 0
  let options
  let mode = 'success'
  const offlineShell = { label: 'saved offline shell' }
  const cache = {
    put: async (key, value) => { assert.equal(key, '/index.html'); assert.equal(value.label, 'new shell'); puts++ },
    match: async (key) => { assert.equal(key, '/index.html'); return offlineShell },
  }
  const caches = { open: async () => cache }
  const fetch = async (_request, opts) => {
    options = opts
    if (mode === 'offline') throw new Error('network down')
    return {
      ok: mode === 'success',
      headers: { get: () => 'text/html; charset=utf-8' },
      clone: () => ({ label: 'new shell' }),
    }
  }
  const handlers = worker({ caches, fetch })
  const navigation = { method: 'GET', url: 'https://app.example/', mode: 'navigate' }
  await request(handlers.fetch, navigation)
  assert.equal(options.cache, 'no-store')
  assert.equal(puts, 1)
  mode = 'error'
  await request(handlers.fetch, navigation)
  assert.equal(puts, 1, 'a server error must not replace the offline shell')
  mode = 'offline'
  assert.equal(await request(handlers.fetch, navigation), offlineShell)
})

test('an open older tab can load its fingerprinted lazy assets from the previous shell', async () => {
  const oldAsset = { label: 'old lazy chunk' }
  const matched = []
  const stores = {
    [cacheName()]: { match: async () => undefined },
    [cacheName(1)]: { match: async (req, options) => { matched.push([req.url, options.ignoreVary]); return oldAsset } },
  }
  const caches = {
    open: async (name) => stores[name],
    keys: async () => ['other-app', cacheName(1), cacheName()],
  }
  const handlers = worker({ caches })
  const asset = { method: 'GET', url: 'https://app.example/assets/auth-old.js', mode: 'cors' }
  assert.equal(await request(handlers.fetch, asset), oldAsset)
  assert.deepEqual(matched, [['https://app.example/assets/auth-old.js', true]])
})

test('published shell and service worker bypass stale HTTP caches', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  for (const path of ['/', '/index.html', '/sw.js']) {
    const entry = config.headers.find((header) => header.source === path)
    assert.ok(entry?.headers.some((header) => header.key.toLowerCase() === 'cache-control' && /no-store/.test(header.value)), path)
  }
})
