// A saved state from before Google sign-in belongs to an existing visitor.
// It must never be treated as a new user or have its progress replaced.
export function savedWelcomeStatus(saved) {
  return typeof saved?.welcomeComplete === 'boolean' ? saved.welcomeComplete : true
}

export function shouldShowWelcome(configured, complete) {
  return Boolean(configured && !complete)
}

// Signing out requires Google again without deleting any device-local progress.
export function returnToSignIn(state) {
  return { ...state, welcomeComplete: false, requiresExplicitSignIn: true, auth: { token: null, user: null } }
}

// An explicit logout must not be undone by a delayed Firebase restore callback.
export function canRestoreGoogle(state, user, signingOut) {
  return Boolean(!state.welcomeComplete && !state.requiresExplicitSignIn && user?.uid && !signingOut)
}

export function completeWelcome(state, googleUser) {
  // The first-visit screen needs the user supplied by the Google auth flow.
  if (!googleUser?.uid) return state
  const name = typeof googleUser.displayName === 'string' ? googleUser.displayName.trim() : ''
  const mayNameFreshProfile = !state.welcomeComplete && state.profile?.isGuest && state.profile.name === 'Aspirant'
  return {
    ...state,
    welcomeComplete: true,
    requiresExplicitSignIn: false,
    // Keep all existing progress, targets and user-chosen names intact. A Google
    // name is only a convenience for the untouched default local profile.
    profile: mayNameFreshProfile && name ? { ...state.profile, name } : state.profile,
  }
}
