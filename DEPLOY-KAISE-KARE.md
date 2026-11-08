# ExamEdge deployment — simple guide

Google sign-in aur existing Vercel setup ke liye [Google sign-in guide](docs/google-sign-in.md) dekhein. Google sign-in local progress ko cloud mein sync nahi karta. Express API aur PostgreSQL alag, optional services hain.

## SSC CGL database reset se pehle

1. **Sahi database verify karein aur restorable backup lein.** Backup ko repository se bahar surakshit rakhein. Reset ke dauran writes rok dein.
2. Backend ke secure environment mein existing `DATABASE_URL` rakhein. Password ya connection string chat, Git, ya documentation mein paste na karein.
3. Backend folder mein ek baar explicit migration chalayein:

   ```bash
   cd server
   npm ci
   npm run migrate:ssc-cgl -- --reset-legacy-bank
   npm run seed
   ```

   Migration purani question aur mock tables hatata hai, lekin users aur unka purana attempt history rakhta hai. Browser ke local attempts, bookmarks aur notes bhi nahi mitte. Purane question details dobara nahi dikh sakte. `seed` 2026 ka official blueprint aur syllabus catalog add karta hai; koi question ya mock nahi banata. Ye additive aur repeat-safe hai. Migration startup par apne aap nahi chalti aur repeat karne par naya data nahi mitati.
4. Existing Express backend ko start/redeploy karein. Usi backend URL par `/api/health` kholein. Fresh setup mein `ok: true`, `clean: true`, 0 questions aur 0 mock tests, 311 syllabus mappings aur 2 empty blueprints dikhne chahiye; seed ke baad `catalog.ok: true` bhi hona chahiye. Agar backend deploy nahi hai, Vercel frontend ka `/api/health` 404 ho sakta hai — usse database verify nahi hota.
5. Naye verified questions aur mocks publish hone tak practice mein pending/empty state dikhegi; purane score aur saved notes bane rahenge. Master/player ke liye backend folder mein backup ke baad `npm run migrate:master` chalayein (005 aur 006 additive hain). Isse questions publish nahi hote. Site storage clear karne ki zarurat nahi hai.

Agar migration foreign-key dependency ki wajah se ruk jaye, poora transaction rollback hota hai. Zabardasti `CASCADE` na chalayein; pehle dependency aur backup check karein. Detailed schema, API aur scoring ke liye [SSC CGL database reference](docs/ssc-cgl-database.md) dekhein.

Agar 001 migration pehle se apply hai, backup aur `DATABASE_URL` confirm karne ke baad sirf `cd server && npm run seed:ssc-cgl-catalog` chalayein; legacy reset dobara zaroori nahi. Topic-wise question counts SSC ne prescribe nahi kiye, isliye API unhe `null` dikhati hai.

2021–2025 PYQ/AI vault की migration शुरुआत में खाली है। Licensed स्रोत, समीक्षा और सेटअप के लिए [PYQ एवं AI गाइड](docs/ssc-cgl-pyq-ai.md) देखें।

2025–2026 Current Affairs इंजन भी शुरुआत में खाली है; स्रोत और समीक्षा के लिए [Current Affairs गाइड](docs/ssc-cgl-current-affairs.md) देखें।

## Vercel par exam player

Vercel sirf frontend serve karta hai. Express aur PostgreSQL alag configure/deploy karke Vercel mein public HTTPS backend origin ko `VITE_API_URL` set karein aur frontend rebuild karein. `DATABASE_URL` aur `JWT_SECRET` sirf backend ke secure environment mein rakhein; Google/Firebase login practice account se alag hai. Dekhein [Command Center guide](docs/ssc-cgl-command-center.md).

Answers backend aur current browser origin ke local storage mein save hote hain. Preview aur production domains ka local storage alag hota hai. Deadline ke baad server par na pahunche answers ko accept karna sambhav nahi; player pending changes ki warning dikhata hai.
