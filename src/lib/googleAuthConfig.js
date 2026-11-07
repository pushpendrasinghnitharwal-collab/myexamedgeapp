// Firebase's web app configuration is public project identification, not a
// server credential. Keep Google sign-in disabled until every value is present.
export function googleAuthConfig(env = {}) {
  const read = (name) => typeof env[name] === 'string' ? env[name].trim() : ''
  const config = {
    apiKey: read('VITE_FIREBASE_API_KEY'),
    authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: read('VITE_FIREBASE_PROJECT_ID'),
    appId: read('VITE_FIREBASE_APP_ID'),
  }
  return Object.values(config).every(Boolean) ? config : null
}

// Never display raw provider errors or configuration values to students.
export function googleAuthError(code) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return { en: 'Sign-in was cancelled. You can try again or continue as a guest.', hi: 'साइन इन रद्द हो गया। फिर कोशिश करें या अतिथि के रूप में आगे बढ़ें।' }
    case 'auth/popup-blocked':
      return { en: 'Your browser blocked the sign-in window. Allow pop-ups and try again.', hi: 'ब्राउज़र ने साइन इन विंडो रोक दी। पॉप-अप की अनुमति दें और फिर कोशिश करें।' }
    case 'auth/network-request-failed':
      return { en: 'Connect to the internet to sign in with Google, or continue as a guest.', hi: 'Google से साइन इन करने के लिए इंटरनेट से जुड़ें, या अतिथि के रूप में आगे बढ़ें।' }
    case 'auth/unauthorized-domain':
      return { en: 'Google sign-in is not enabled for this website yet. Please contact the app owner.', hi: 'इस वेबसाइट के लिए Google साइन इन अभी सक्षम नहीं है। ऐप के मालिक से संपर्क करें।' }
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
    case 'auth/invalid-auth-domain':
      return { en: 'Google sign-in is not set up correctly yet. Please contact the app owner.', hi: 'Google साइन इन अभी सही तरह सेट नहीं हुआ है। ऐप के मालिक से संपर्क करें।' }
    case 'auth/web-storage-unsupported':
      return { en: 'Your browser is blocking sign-in storage. Try a regular browser window or continue as a guest.', hi: 'ब्राउज़र साइन इन स्टोरेज रोक रहा है। सामान्य ब्राउज़र विंडो में कोशिश करें या अतिथि बनें।' }
    case 'auth/operation-not-supported-in-this-environment':
      return { en: 'Google sign-in cannot open here. Try a regular browser window or continue as a guest.', hi: 'यहाँ Google साइन इन नहीं खुल सकता। सामान्य ब्राउज़र में कोशिश करें या अतिथि बनें।' }
    case 'auth/account-exists-with-different-credential':
      return { en: 'This email already uses a different sign-in method. Please use that method instead.', hi: 'इस ईमेल के लिए साइन इन का दूसरा तरीका पहले से है। कृपया उसी तरीके का उपयोग करें।' }
    default:
      return { en: 'Could not sign in with Google. Check your connection and try again, or continue as a guest.', hi: 'Google से साइन इन नहीं हो पाया। इंटरनेट जाँचें और फिर कोशिश करें, या अतिथि बनें।' }
  }
}
