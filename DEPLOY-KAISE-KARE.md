# 🎓 EXAMEDGE ko LIVE kaise kare — Bilkul Beginner Guide (Hinglish)

> **Chinta mat kar, kuch nahi aata toh bhi chalega.** Ye guide maine aise likhi hai jaise tumhe pehli baar samjhata hoon. Har step mein bataaya hai: **kya karna hai** + **woh kya hai** + **kyun karte hain**.

---

## 🧠 Pehle 60 second mein concepts samajho

| Word | Matlab (simple) | Example |
|------|-----------------|---------|
| **App / Frontend** | Jo user phone/browser mein dekhta hai — hamari EXAMEDGE PWA | WhatsApp ka interface |
| **Backend / API** | "Brain" jo server pe chalta hai — login check, test bhejna, marks nikalna | WhatsApp ka server |
| **Database (PostgreSQL)** | Ek bada digital register jisme users, questions, scores store hote hain | Ek bada godam |
| **Deploy karna** | Apni app ko internet pe daalna taaki duniya bhar ke log use kar saken | Dukaan ki jagah kiraye pe lena aur kholna |
| **GitHub** | Code ka Google Drive — yahan code save hota hai, aur Vercel/Render wahi se uthate hain | Code ka safe locker |
| **Environment Variable (.env)** | Secret settings jo code mein nahi, server ki settings mein hoti hain — jaise DB ka password | Chabhi (key) jo code mein nahi dikhti |
| **URL / Domain** | Internet ka address | `examedge.vercel.app` |

**Hamari app 3 tukdon mein hai:**
1. **Frontend** (React PWA) — user ko dikhta hai
2. **Backend API** (Node/Express) — kaam karta hai
3. **Database** (PostgreSQL) — yaad rakhta hai

Teeno ko **free** mein internet pe daalenge. Total cost: **₹0** 💰

---

## 📋 Step 0 — GitHub account aur code upload (15 min)

**Kya hai:** GitHub = code ka online locker. Render aur Vercel isi locker se code uthate hain.

**Steps:**
1. [github.com](https://github.com) pe jao → **Sign up** (free) → email verify karo.
2. GitHub pe nayi **Repository** banao: naam do `examedge`, **Public** rakho, "Add README" **mat** lagao → Create.
3. Apne computer pe terminal kholo (VS Code mein ya jo bhi hai) aur ye commands chalao:

```bash
cd /home/user          # hamara project folder
git init
git add -A
git commit -m "EXAMEDGE v1 - full app ready"
git branch -M main
git remote add origin https://github.com/TERA-USERNAME/examedge.git
git push -u origin main
```

> 💡 `TERA-USERNAME` ki jagah apna GitHub username likho. Pehli baar `git push` pe username/password maangega — password ki jagah **Personal Access Token** (GitHub → Settings → Developer settings → Tokens) daalo.

**Verify:** GitHub pe repo refresh karo — saari files dikhni chahiye. ✅

---

## 🗄️ Step 1 — Database: NEON (free Postgres) (10 min)

**Kya hai:** Neon = free online database. Hamara saara data (users, 399 questions, scores) yahan safe rahega.

**Steps:**
1. [neon.tech](https://neon.tech) → **Sign up** (GitHub se sign up kar sakte ho).
2. Dashboard pe **New Project** → naam: `examedge` → region koi bhi (Singapore/Mumbai nearest) → **Create Project**.
3. Project khulne ke baad **Connection string** copy karo. Woh aisa dikhega:
   ```
   postgres://neondb_owner:abc123@ep-cool-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   📋 Isko kahin safe jagah paste karke rakho (Notepad mein).
4. Ab database mein hamara data daalo (terminal mein):

```bash
cd /home/user/server
DATABASE_URL="yahan-upar-wali-connection-string-paste-karo" npm run seed
```

Output aana chahiye: `Seeded 399 questions, 19 exams` ✅

> 🧠 **Samajho:** `npm run seed` ek script hai jo hamari 399 questions ko Neon database mein daal deti hai.

---

## ⚙️ Step 2 — Backend API: RENDER (free server) (15 min)

**Kya hai:** Render = free online computer jahan hamara API (brain) chalega. Jab bhi koi user test karega, ye wahi marks niklega.

**Steps:**
1. [render.com](https://render.com) → **Sign up** (GitHub se).
2. Dashboard → **New +** → **Web Service** → apna `examedge` GitHub repo connect karo.
3. Ye settings bharo:
   - **Name:** `examedge-api`
   - **Root Directory:** `server`  ← important! (hamara API isi folder mein hai)
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
4. **Environment Variables** section mein ye add karo (Add Environment Variable):
   - `DATABASE_URL` = Neon ki connection string (Step 1 wali)
   - `JWT_SECRET` = koi bhi lambi random string, e.g. `examedge-secret-2026-xyz-789`
   - `PORT` = `4000`
5. **Create Web Service** dabao. 2-3 minute mein deploy ho jayega.
6. Upar **URL** dikhega — kuch aisa: `https://examedge-api.onrender.com`
   📋 Copy kar lo.
7. Verify karo (browser mein kholo):
   ```
   https://examedge-api.onrender.com/api/health
   ```
   Agar `{"ok":true,"questions":399}` aaya → **backend LIVE hai!** 🎉

> ⚠️ **Free Render sleep karta hai:** 15 minute kuch na kare toh so jata hai. Pehli request 20-30 second leti hai (cold start). Normal hai!
> 💡 **Tip:** [cron-job.org](https://cron-job.org) pe free account banao, aur `/api/health` ko har 10 min ping karwao — server kabhi nahi soyega.

---

## 🌐 Step 3 — Frontend: VERCEL (free website) (10 min)

**Kya hai:** Vercel = free hosting jahan hamari app ki website/PWA chalegi. Duniya bhar ke log `https://examedge.vercel.app` khol sakte hain.

**Steps:**
1. [vercel.com](https://vercel.com) → **Sign up** (GitHub se).
2. **Add New → Project** → apna `examedge` repo import karo.
3. Settings:
   - **Framework Preset:** Vite (auto-detect ho jayega)
   - **Root Directory:** `./` (default, change mat karna)
4. **Environment Variables** mein add karo:
   - `VITE_API_URL` = `https://examedge-api.onrender.com` (Step 2 ki URL, bina `/api` ke)
5. **Deploy** dabao. 1-2 minute mein live.
6. Vercel ek URL dega — e.g. `https://examedge.vercel.app` 🎉

> 🧠 **Samajho:** `VITE_API_URL` batata hai ki app ko pata chale ki backend kahan hai. Local pe ye blank hai (proxy use hota hai), live pe Render ki URL.

---

## 📱 Step 4 — App test karo aur phone mein install karo

1. `https://examedge.vercel.app` kholo.
2. Onboarding complete karo → account **Neon database mein** banega (real!).
3. Koi bhi mock test do → submit → **Leaderboard** page pe dekho → tumhara real server rank dikhega.
4. **Phone mein install:** Chrome menu (⋮) → **"Install app" / "Add to Home Screen"** → EXAMEDGE ek real app ki tarah install ho jayega! 📲

---

## 🔁 Future mein changes kaise live honge

Bas ye 3 commands:

```bash
git add -A
git commit -m "naya feature"
git push
```

Vercel aur Render dono automatically naya code utar ke live kar denge. ⚡

Agar question bank badli toh Neon mein dobara seed:

```bash
cd server && DATABASE_URL="<neon-string>" npm run seed
```

---

## ❓ Common problems (Don't panic)

| Problem | Matlab | Solution |
|---------|--------|----------|
| Render pe "Build failed" | root directory galat hai | Root Directory = `server` set karo |
| API health nahi khulta | server soca ya URL galat | 30 sec wait karo (cold start), URL check karo |
| Database connect error | connection string galat ya missing `?sslmode=require` | Neon se string dobara copy karo |
| Vercel pe app khulti par login fail | `VITE_API_URL` set nahi kiya | Vercel → Project → Settings → Environment Variables → add karo → **Redeploy** |
| "Invalid token" | JWT_SECRET change ho gaya | dono jagah same rakho, ya dobara login karo |

---

## 🎯 Yaad rakhne wali baat

```
GitHub (code ka locker)
   ├──▶ Vercel  →  frontend live:  examedge.vercel.app      (user dekhta hai)
   └──▶ Render  →  backend live:   examedge-api.onrender.com (kaam karta hai)
                          │
                          ▼
                    Neon → database (yaad rakhta hai)
```

**Sab free. Sab auto-deploy. Bas git push.** 💪

Koi bhi step mein stuck ho toh mujhe batao — screenshots ke saath bataoge toh aur fast solve hoga! 😄
