# Deploying to Coolify (alongside your existing project)

Coolify runs many apps on one server, so this sits next to your current project.
The repo ships a `Dockerfile`, so Coolify builds it reliably (Prisma + Next).

## 1. Create the database
Coolify → your Project → **+ New** → **Database → PostgreSQL** → create it.
Open it and copy the **connection string** (internal URL, looks like
`postgres://user:pass@<service>:5432/postgres`). You'll use it as `DATABASE_URL`.

## 2. Create the application
Coolify → **+ New** → **Application** → **Public/Private Git Repository**
- Repository: `https://github.com/digitalvetri/digitalVetri-PCRM.git`, branch `main`
- **Build Pack: Dockerfile** (the repo has one)
- Port: **3000**

## 3. Set environment variables
App → **Environment Variables** — add these (⚠️ `NEXT_PUBLIC_*` must be set *before* the first build, since they're compiled in):
```
DATABASE_URL                      = <the Coolify Postgres URL from step 1>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...        # a PROD Clerk instance
CLERK_SECRET_KEY                  = sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL     = /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL     = /sign-up
NEXT_PUBLIC_APP_URL               = https://<your-domain>
AI_PROVIDER                       = gemini
GEMINI_API_KEY                    = <your key>
GROQ_API_KEY                      = <your key>          # strongly recommended — carries the volume
CRON_SECRET                       = <a long random string>
# Optional but needed for full function:
GOOGLE_PLACES_API_KEY             = <for auto-discovery>
SMTP_HOST / SMTP_USER / SMTP_PASS = <to send emails + email briefing>
WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN = <for WhatsApp API + briefing>
```

## 4. Domain + deploy
- App → **Domains** → set your subdomain (Coolify auto-issues HTTPS via Let's Encrypt).
- **Deploy.** On start the container runs `prisma db push` (creates the schema in the fresh DB) then boots Next.
- Open the domain → **the first person to sign in becomes ADMIN** (that's you).

## 5. The 24/7 agent (Coolify Scheduled Tasks — no Vercel needed)
App → **Scheduled Tasks** → **+ Add**:
- **Frequency:** `30 1 * * *`  (01:30 UTC = 07:00 IST, daily)
- **Command:**
  ```
  curl -fsS -X POST http://localhost:3000/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"
  ```
  (Runs inside the app container, so `localhost` + the `CRON_SECRET` env work directly.)

Then in the app: **Command Center → Agent** → add watchlists, pick the briefing
channel, toggle **Daily auto-discovery** (and optionally **Auto-draft**) → **Save**.

## Notes
- **The database starts empty** — your local companies/leads do not migrate. Add real data (or import).
- Set **`GOOGLE_PLACES_API_KEY`** for the agent to actually discover new businesses; without it, it still sends the morning briefing.
- Watch RAM on the KVM-2 during builds; if `next build` ever OOMs, add `NODE_OPTIONS=--max-old-space-size=1536` as a build env var.
- Redeploy on every `git push` to `main` (enable auto-deploy in Coolify, or click Deploy).
