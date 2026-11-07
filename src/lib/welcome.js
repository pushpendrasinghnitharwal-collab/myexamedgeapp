// A saved state from before Google sign-in belongs to an existing visitor.
// It must never be treated as a new user or have its progress replaced.
export function savedWelcomeStatus(saved) {
  return typeof saved?.welcomeComplete === 'boolean' ? saved.welcomeComplete : true
}

export function shouldShowWelcome(configured, complete) {
  return Boolean(configured && !complete)
}

export function completeWelcome(state, googleUser) {
  const name = typeof googleUser?.displayName === 'string' ? googleUser.displayName.trim() : ''
  const mayNameFreshProfile = !state.welcomeComplete && state.profile?.isGuest && state.profile.name === 'Aspirant'
  return {
    ...state,
    welcomeComplete: true,
    // Keep all existing progress, targets and user-chosen names intact. A Google
    // name is only a convenience for the untouched default local profile.
    profile: mayNameFreshProfile && name ? { ...state.profile, name } : state.profile,
  }
}
