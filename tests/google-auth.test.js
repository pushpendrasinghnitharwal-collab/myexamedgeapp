import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { googleAuthConfig, googleAuthError } from '../src/lib/googleAuthConfig.js'
import { canRestoreGoogle, completeWelcome, returnToSignIn, savedWelcomeStatus, shouldShowWelcome } from '../src/lib/welcome.js'

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

test('logout requires a new Google sign-in while preserving all device-local progress', () => {
  const state = {
    welcomeComplete: true, requiresExplicitSignIn: false,
    auth: { token: 'backend-token', user: { id: 'backend-user' } },
    profile: { name: 'My chosen name', examId: 'rrb-ntpc' },
    attempts: [{ id: 'attempt-1' }], bookmarks: ['q1'], notes: { q1: 'my note' },
    settings: { lang: 'hi', theme: 'dark' }, streak: { count: 2 }, xp: 40, coins: 65,
  }
  const signedOut = returnToSignIn(state)
  assert.equal(signedOut.welcomeComplete, false)
  assert.equal(signedOut.requiresExplicitSignIn, true)
  assert.deepEqual(signedOut.auth, { token: null, user: null })
  for (const key of ['profile', 'attempts', 'bookmarks', 'notes', 'settings', 'streak', 'xp', 'coins']) {
    assert.strictEqual(signedOut[key], state[key], `${key} is not reset`)
  }
  assert.equal(state.auth.token, 'backend-token')
  assert.equal(shouldShowWelcome(true, signedOut.welcomeComplete), true)
  assert.equal(shouldShowWelcome(false, signedOut.welcomeComplete), false)

  const delayedUser = { uid: 'google-user', displayName: 'Another name' }
  assert.equal(canRestoreGoogle(signedOut, delayedUser, false), false, 'a delayed auth callback must not undo logout')
  assert.equal(canRestoreGoogle(JSON.parse(JSON.stringify(signedOut)), delayedUser, false), false, 'the logout guard survives reload')
  assert.equal(canRestoreGoogle({ ...signedOut, requiresExplicitSignIn: false }, delayedUser, true), false, 'do not restore while signing out')
  assert.equal(canRestoreGoogle({ ...signedOut, requiresExplicitSignIn: false }, delayedUser, false), true, 'a fresh visit may restore its session')
  assert.equal(canRestoreGoogle({ ...signedOut, requiresExplicitSignIn: false }, {}, false), false)
  const signedIn = completeWelcome(signedOut, delayedUser)
  assert.equal(signedIn.welcomeComplete, true)
  assert.equal(signedIn.requiresExplicitSignIn, false)
  assert.strictEqual(signedIn.profile, state.profile)
  assert.strictEqual(signedIn.attempts, state.attempts)
})

test('the first-visit screen offers Google sign-in without a guest action', async () => {
  const welcome = await readFile('src/pages/Welcome.jsx', 'utf8')
  assert.match(welcome, /<GoogleSignInButton\s+onSuccess=\{completeWelcome\}/)
  assert.doesNotMatch(welcome, /continueAsGuest|welcome-guest|continue as (?:a )?guest|अतिथि/i)
  for (const file of ['src/pages/Materials.jsx', 'src/pages/MaterialReader.jsx']) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /guest|अतिथि/i, `${file} should not label resources as a guest mode`)
  }
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
