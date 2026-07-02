# Deployment & the 24/7 Agent (Phase 2)

The autonomous agent (daily auto-discovery + morning briefing) is **built and works
on-demand** (Command Center → **Agent** tab → "Run agent now"). To have it run **24/7
without you**, the app must be **deployed** and a **scheduler** must call it daily.

> ⚠️ **Build ≠ deploy.** Everything below is *yours* to do — it needs your own
> accounts and secrets. Nothing runs on a schedule until these steps are complete.
> Your local data (companies, leads) does **not** move to production — a fresh
> deploy starts with an empty database.

---

## Prerequisites (all on your side)
| Need | Why | Options |
|---|---|---|
| **Production Postgres** | Local Homebrew Postgres isn't reachable from a host | Neon, Supabase, Railway (free tiers exist) |
| **Production Clerk** | You're on `pk_test`/`sk_test` dev keys | Create a prod instance at clerk.com + your domain |
| **Google Places key** | Powers auto-discovery (no other data source) | Google Cloud → enable **Places API** + billing → `GOOGLE_PLACES_API_KEY`. *Optional — without it the agent still sends the briefing.* |
| **SMTP or WhatsApp creds** | So the morning briefing actually sends | You added the fields already; fill them for prod |
| **A host + scheduler** | To run the app + trigger the daily job | Vercel (easiest, cron built-in), or a VPS |

---

## Recommended path: Vercel

1. **Postgres** — create a Neon/Supabase DB, copy its connection string.
2. **Push the schema** to it: `DATABASE_URL="<prod-url>" npx prisma db push`
3. **Deploy** — push this repo to GitHub, import it in Vercel (or `vercel` CLI).
4. **Set env vars** in Vercel → Project → Settings → Environment Variables:
   ```
   DATABASE_URL                     = <prod postgres url>
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = <prod pk_live_...>
   CLERK_SECRET_KEY                 = <prod sk_live_...>
   NEXT_PUBLIC_CLERK_SIGN_IN_URL    = /sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL    = /sign-up
   AI_PROVIDER                      = gemini
   GEMINI_API_KEY / GROQ_API_KEY    = <your keys>   (Groq strongly recommended — it carries the volume)
   GOOGLE_PLACES_API_KEY            = <optional, for auto-discovery>
   SMTP_* / WHATSAPP_*              = <for the briefing to send>
   CRON_SECRET                      = <a long random string>
   NEXT_PUBLIC_APP_URL              = https://your-domain
   ```
5. **Cron** — `vercel.json` already schedules `POST /api/cron/daily` at **01:30 UTC (07:00 IST)** daily. Vercel automatically sends `Authorization: Bearer $CRON_SECRET`, which the endpoint verifies. *(Frequent crons / long runs may need Vercel Pro; the daily job is intentionally small.)*
6. **Configure the agent** — open **Command Center → Agent**, add watchlists (e.g. *Textiles / Coimbatore*), pick the briefing channel + recipient, toggle **Daily auto-discovery** on, and **Save**. Press **Run agent now** to confirm it works.

## Alternative: any host + external scheduler (no Vercel)
Deploy anywhere (Render, Railway, a VPS with `npm run build && npm start`), then have **any** scheduler hit the endpoint daily with the secret:
```
curl -X POST "https://your-domain/api/cron/daily" \
     -H "Authorization: Bearer $CRON_SECRET"
```
Use [cron-job.org](https://cron-job.org) (free), a VPS `crontab`, or a GitHub Action on a schedule.

---

## How the daily run behaves (by design)
- **Bounded & idempotent** — discovers a small batch (`Leads per run`, default 5) from **one rotating watchlist** per day, and **skips businesses already** in your leads/companies. Safe to run more than once.
- **Briefing always logged in-app** (Agent tab → "Recent agent runs") even if no send channel is configured.
- **Sends** the briefing via WhatsApp/email only if that channel + its creds are set.
- At 24/7 cadence, all AI runs on **Groq** (fast/cheap) — Gemini's free quota won't keep up.

## What is NOT included
- The app isn't deployed for you, and no scheduler runs until you complete the above.
- "Continuous / hourly" agents, multi-source discovery, and an auto-outreach queue are **Phase 3** (needs a queue/worker) — not built yet.
