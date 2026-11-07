# EXAMEDGE: Google sign-in setup (Hinglish)

Google sign-in ka code Firebase Authentication use karta hai. **Firebase project aur Vercel settings complete hone ke baad hi button aur first-visit welcome screen active honge.** Tab tak app pehle ki tarah guest mode mein khulti rahegi. Setup ka test karne ke liye owner ke Firebase project aur ek real Google account ki zaroorat hai.

## 1. Firebase project aur web app

1. [Firebase Console](https://console.firebase.google.com/) kholkar apne Google account se sign in karein. Existing Firebase project select karein ya **Create project** se naya project banayein.
2. Project overview mein web icon (`</>`) se **Add app → Web** choose karein, naam `EXAMEDGE` rakhein aur app register karein. Firebase Hosting enable karna zaroori nahi hai: app Vercel par hi rahegi.
3. Project settings (gear icon) → **Your apps** → web app → **SDK setup and configuration** mein `firebaseConfig` dekhein. `apiKey`, `authDomain`, `projectId` aur `appId` ki values step 3 ke liye chahiye.

## 2. Google provider aur domain

1. Firebase mein **Authentication → Get started** (agar naya project hai) → **Sign-in method → Add new provider → Google** kholkar **Enable** karein. Project support email select karke **Save** karein.
2. **Authentication → Settings → Authorized domains → Add domain** mein sirf hostname add karein:
   ```text
   myexamedgeapp-um97.vercel.app
   ```
   `https://` ya aakhir mein `/` na lagayein. Koi custom domain ya alag Vercel preview URL test karna ho to uska actual hostname bhi authorize karna hoga. Local development ke liye `localhost` explicitly add karna pad sakta hai; naye Firebase projects mein yeh by default nahi hota.
3. Agar Google Cloud ke OAuth consent screen par app **Testing** mode mein hai aur Google test users maangta hai, to pehle test account add karein ya Google ki instructions ke mutabik app publish karein. Provider setup ke liye normally manually OAuth client secret banane ki zaroorat nahi hoti.

## 3. Vercel mein web configuration

1. [Vercel](https://vercel.com/) → project **myexamedgeapp-um97** → **Settings → Environment Variables** kholein.
2. Ye chaar variables **Production** ke liye add karein. Har value Firebase web app config se bilkul same copy karein:

   | Vercel variable | Firebase config field |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   `authDomain` Firebase config wala domain hi rakhein (normally `…firebaseapp.com`), Vercel hostname nahi. Agar preview deployments test karni hain, unke liye variables **Preview** environment mein bhi set karein aur unka actual hostname Firebase mein authorize karein.
3. **Save** ke baad Vercel → **Deployments** mein latest production deployment ko **Redeploy** karein. Vite variables build ke waqt app mein embed hote hain; sirf save karne se purana deployment change nahi hota.

> Firebase web configuration public hoti hai aur browser tak jaati hai. Usmein kabhi service-account private key, OAuth client secret, database password ya doosra secret na daalein. Password, token ya 2FA code kisi chat mein share na karein.

## 4. Test kaise karein

1. Redeploy successful hone ke baad `https://myexamedgeapp-um97.vercel.app/` ek naye private/incognito browser window mein kholein. Pehli visit par **Continue with Google** aur **Continue as guest** dikhna chahiye.
2. **Continue with Google** dabayein, Google account choose karein aur consent complete karein. Student ka account Firebase → Authentication → **Users** mein dikhna chahiye. Browser popup block kare to popups allow karein.
3. App refresh karein: usi browser par session restore hona chahiye. **Profile → Google account** se sign out ya dobara sign in karein. Google sign-out local practice progress nahi mitata.
4. Kisi purane browser/device par bhi kholkar existing test history, bookmarks aur settings check karein. Purane saved profiles ko first-visit screen se nahi roka jata; woh Profile se Google sign-in kar sakte hain.

**Zaroori:** Google login sirf identity/sign-in hai. Abhi practice, notes, bookmarks aur profile **isi device/browser mein local** hain; doosre phone par automatically sync ya account-wise private nahi hote. Shared device par us device ki local progress doosre users ko bhi dikh sakti hai. Purana optional email/password backend account Google account se alag hai. Google sign-in use karne ke liye Render/Neon backend zaroori nahi hai.

Agar domain/provider/config galat ho, ya internet/popup available na ho, student guest ke roop mein app use kar sakta hai. Real Google login verify karne ke liye above setup aur real account test zaroor karein.

References: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [authorized-domain troubleshooting](https://firebase.google.com/docs/auth/faq-and-troubleshooting), [Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables).
