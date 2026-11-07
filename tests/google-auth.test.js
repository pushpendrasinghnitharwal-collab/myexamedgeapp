import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { googleAuthConfig, googleAuthError } from '../src/lib/googleAuthConfig.js'
import { completeWelcome, savedWelcomeStatus, shouldShowWelcome } from '../src/lib/welcome.js'

const env = {
  VITE_FIREBASE_API_KEY: ' api-key ',
  VITE_FIREBASE_AUTH_DOMAIN: ' project.firebaseapp.com ',
  VITE_FIREBASE_PROJECT_ID: ' project ',
  VITE_FIREBASE_APP_ID: ' app-id ',
}

test('Google sign-in is enabled only when all four public Firebase values are present', () => {
  assert.equal(googleAuthConfig({}), null)
  for (const key of Object.keys(env)) {
    assert.equal(googleAuthConfig({ ...env, [key]: '  ' }), null, `${key} is required`)
  }
  assert.deepEqual(googleAuthConfig(env), {
    apiKey: 'api-key', authDomain: 'project.firebaseapp.com', projectId: 'project', appId: 'app-id',
  })
})

test('only a fresh visitor with configured Google sign-in sees the welcome screen', () => {
  assert.equal(shouldShowWelcome(false, false), false)
  assert.equal(shouldShowWelcome(true, false), true)
  assert.equal(shouldShowWelcome(true, true), false)
  assert.equal(savedWelcomeStatus({ profile: { name: 'Existing student' } }), true)
  assert.equal(savedWelcomeStatus({ welcomeComplete: false }), false)
  assert.equal(savedWelcomeStatus({ welcomeComplete: true }), true)
})

test('finishing welcome preserves practice and never overwrites a chosen profile name', () => {
  const state = {
    welcomeComplete: false,
    profile: { name: 'Aspirant', isGuest: true, examId: 'rrb-ntpc' },
    attempts: [{ id: 'a1' }], bookmarks: ['q1'], notes: { q1: 'my note' },
    settings: { lang: 'hi', theme: 'dark' },
  }
  const completed = completeWelcome(state, { uid: 'student-id', displayName: ' Student Name ', email: 'student@example.com' })
  assert.equal(completed.welcomeComplete, true)
  assert.deepEqual(completed.profile, { name: 'Student Name', isGuest: true, examId: 'rrb-ntpc' })
  for (const key of ['attempts', 'bookmarks', 'notes', 'settings']) assert.strictEqual(completed[key], state[key])
  assert.equal(state.profile.name, 'Aspirant')
  assert.equal(Object.hasOwn(completed, 'email'), false)

  const existing = { ...state, profile: { name: 'Chosen name', isGuest: false, examId: 'upsc-cse' } }
  assert.strictEqual(completeWelcome(existing, { uid: 'student-id', displayName: 'Another name' }).profile, existing.profile)
  assert.strictEqual(completeWelcome(state, null), state)
  assert.strictEqual(completeWelcome(state, { displayName: 'No authenticated user' }), state)
  assert.strictEqual(completeWelcome({ ...state, welcomeComplete: true }, { uid: 'student-id', displayName: 'Another name' }).profile, state.profile)
})

test('the first-visit screen offers Google sign-in without a guest action', async () => {
  const welcome = await readFile('src/pages/Welcome.jsx', 'utf8')
  assert.match(welcome, /<GoogleSignInButton\s+onSuccess=\{completeWelcome\}/)
  assert.doesNotMatch(welcome, /continueAsGuest|welcome-guest|continue as (?:a )?guest|अतिथि/i)
})

test('Google auth failures produce understandable English and Hindi messages', () => {
  for (const code of ['auth/popup-closed-by-user', 'auth/popup-blocked', 'auth/network-request-failed', 'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/web-storage-unsupported', 'auth/operation-not-supported-in-this-environment', 'auth/account-exists-with-different-credential', 'unknown']) {
    const result = googleAuthError(code)
    assert.ok(result.en && result.hi, `${code} is translated`)
    assert.doesNotMatch(result.en, /guest/i)
    assert.doesNotMatch(result.hi, /अतिथि/)
  }
  assert.match(googleAuthError('auth/network-request-failed').en, /internet/i)
  assert.match(googleAuthError('auth/popup-blocked').en, /pop-ups/i)
  assert.match(googleAuthError('auth/unauthorized-domain').en, /owner/i)
})
