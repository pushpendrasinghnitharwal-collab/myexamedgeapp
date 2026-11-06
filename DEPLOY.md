# 🚀 EXAMEDGE — Free Deployment Guide

Deploy the full stack **100% free**: PWA frontend + Express API + PostgreSQL.

## Stack

| Layer | Service | Free tier |
|-------|---------|-----------|
| Frontend (React PWA) | **Vercel** (or Cloudflare Pages) | Unlimited bandwidth, auto HTTPS + CDN |
| Backend (Express API) | **Render** | 750 hrs/mo free web service (sleeps after 15 min idle) |
| Database | **Neon** (serverless Postgres) | 0.5 GB storage, pauses when idle, wakes instantly |

---

## Step 0 — Push to GitHub

```bash
git init && git add -A && git commit -m "EXAMEDGE v1"
# create a repo on github.com, then:
git remote add origin https://github.com/YOU/examedge.git
git push -u origin main
```

## Step 1 — Database: Neon (free Postgres)

1. Go to [neon.tech](https://neon.tech) → Sign up → **New Project** (name: `examedge`).
2. Copy the **connection string** (looks like `postgres://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. Load schema + seed data (from your local machine):

```bash
# schema is created automatically by the API on boot (initSchema),
# so you only need to seed questions/exams:
cd server
DATABASE_URL="<your-neon-connection-string>" npm run seed
```

## Step 2 — Backend: Render (free API)

1. [render.com](https://render.com) → Sign up → **New + → Web Service** → connect your GitHub repo.
2. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
3. Environment variables:
   - `DATABASE_URL` = your Neon connection string
   - `JWT_SECRET` = any long random string
   - `PORT` = `4000` (Render also sets PORT automatically — our code respects it)
4. Deploy → your API lives at `https://examedge-api.onrender.com`
5. Verify: `curl https://examedge-api.onrender.com/api/health` → `{"ok":true,"questions":399,...}`

**Keep it warm (optional):** free cron at [cron-job.org](https://cron-job.org) pinging
`https://examedge-api.onrender.com/api/health` every 10 minutes.

## Step 3 — Frontend: Vercel (free PWA)

1. [vercel.com](https://vercel.com) → Sign up → **Add New → Project** → import your GitHub repo.
2. Framework preset: **Vite** (auto-detected). Root directory: `/` (default).
3. **Environment variable:**
   - `VITE_API_URL` = `https://examedge-api.onrender.com`
4. Deploy → your app lives at `https://examedge.vercel.app`

The app automatically calls `${VITE_API_URL}/api/...` in production and `/api` (dev proxy) locally.

## Step 4 — Test the deployed app

1. Open `https://examedge.vercel.app` → complete onboarding (creates a real account in Neon).
2. Take a mock test → it submits to the API → check the **Leaderboard** page → your real server rank appears.
3. Install as PWA: browser menu → "Install EXAMEDGE" (works on Android/desktop Chrome).

---

## 🔁 Updating

Just `git push` — Vercel and Render auto-redeploy. Re-seed the DB only when the question bank changes:

```bash
cd server && DATABASE_URL="<neon-string>" npm run seed
```

## ⚠️ Free-tier gotchas

- **Render sleeps after 15 min idle** → first API call takes ~20–30s. The app already falls back to local mode if the API is unreachable, and shows real data once it wakes.
- **Neon pauses when idle** → wakes automatically on first query (adds ~1s).
- **CORS** is already open (`cors()` in the API), so the Vercel domain can call the Render API.
- Never commit `.env` — secrets live only in Render/Vercel dashboards. (`.env` is in `.gitignore` below.)

## 💰 Later, when earning

Move API+DB to a single **$5/mo VPS** (Hetzner/Contabo) or Railway paid plan — no sleep, full control, real domain.
