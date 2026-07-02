# Command Center → "DigitalVetri Growth Engine" — Advancement Roadmap

_A plan to turn the Command Center from a daily planner into an autonomous, target-driven revenue engine that finds businesses who need a website / CRM / automation, qualifies them, and hands the good ones to Companies & Prospects — working for you around the clock._

---

## 1. The vision in one line
**You set a revenue target → the engine reverse-engineers the funnel, goes and finds the exact businesses who need your services, scores them, drafts the outreach, and tells you (or does) the specific actions to hit the number — continuously.**

## 2. What you already have (the foundation — good news)
- **Target + pipeline math**: `monthlyRevenueTarget`, `revenueClosedThisMonth`, `pipelineValue`, `achievementPct`, missed follow-ups, high-priority leads (`command-center.ts`).
- **AI with cost control**: Gemini primary + **Groq fallback** (cheap & fast — perfect for high-volume lead classification).
- **Ethical scraping**: `fetch-public.ts` (SSRF-guarded, robots.txt-aware) — the legal way to read public company sites.
- **Lead scoring + analysis**: `scoring.ts`, `analyze.ts`, the full company-intelligence pipeline.
- **Broadened services**: analysis already recommends Website / Digital Marketing / CRM / Automation.
- **Outreach**: email (SMTP) + WhatsApp (click-to-chat / Cloud API) sending.

## 3. What's missing (what we build)
1. A **Lead Discovery engine** ("analyze the internet" for who needs what).
2. A **Discovered-Leads pool + "Lead Radar"** section in the Command Center.
3. A **promote-to-Company/Prospect** flow (only quality leads graduate).
4. A **Target → Funnel → Daily-Actions** engine.
5. **Autonomous 24/7 agents** (background workers on a schedule).

---

## 4. The five engines (detailed)

### Engine 1 — Lead Discovery ("who needs a website / CRM / automation")
**How you legally & reliably find them:**
- **Google Places API** (you already have a Maps key): pull local businesses by *industry + city* (e.g. "manufacturers in Coimbatore", "clinics in Chennai") → name, phone, website, rating, review count. This is the volume source.
- **Website need-detection** (your `fetch-public` + enrichment — the *most reliable, most legal* signal): for each business, auto-detect concrete needs:
  - **No website** or only a Facebook/JustDial page → _needs Website Development_
  - Non-HTTPS / not mobile-friendly / slow / outdated → _needs Website revamp_
  - No online booking / enquiry form / payment → _needs Web app / automation_
  - No WhatsApp click-to-chat, no chatbot → _needs WhatsApp/AI automation_
  - Many products, no e-commerce / catalogue → _needs SaaS/e-commerce_
  - Weak SEO / no Google Business optimisation / few reviews → _needs Digital Marketing_
  - Hiring / expansion / new locations (from their site/news) → _growth signal → needs CRM/ERP_
- **Directories** (IndiaMART / JustDial) and **Google search intent** — only via allowed access.
- Each becomes a **DiscoveredLead** with: source, the detected signals, a **recommended service**, and a **need + fit + reachability score**.

### Engine 2 — Qualification & Scoring
- Reuse `scoring.ts`/`analyze.ts`, add three axes: **Need** (how badly they need a service), **Fit** (ICP match — size/industry/region), **Reachability** (phone/email present, decision-maker found).
- Auto-tier A / B / C. Only **A/B** surface as "worth your time"; C is parked. Cheap Groq model does the first-pass classification at volume; Gemini/Claude does the deep dive only on A/B.

### Engine 3 — "Lead Radar" (new Command Center tab)
- A live board of discovered leads: **Company · City · Industry · Detected need ("No website", "Poor mobile site", "No CRM") · Recommended service · Score · Actions.**
- Actions: **Promote to Company** (creates a Company + optional Prospect, carrying the analysis) · **Draft outreach** (jumps to email/WhatsApp generator pre-filled) · **Dismiss**.
- Kept in a **separate `DiscoveredLead` table** so your Companies/Prospects stay clean until a lead earns its place — exactly your "if the lead becomes a quality lead I move it to Company/Prospects."

### Engine 4 — Target → Funnel → Daily Actions ("earn from the target")
You enter a monthly target; the engine works backward with your real conversion rates:
```
target ÷ avg deal value          = deals to win
deals ÷ win-rate                 = proposals to send
proposals ÷ meeting→proposal %   = meetings to hold
meetings ÷ outreach→meeting %    = outreach to do
outreach ÷ leads-per-outreach    = NEW LEADS to discover
```
Then every morning it tells you (and can act): _"To hit ₹X this month you need **N new leads, M outreach, K follow-ups today**"_ — and hands you the **specific leads, prospects and actions** to do it. It also flags when you're **behind pace** and auto-increases discovery volume to catch up. This is the "give me all the possible things to achieve the target."

### Engine 5 — Autonomous 24/7 Agents (the "real-time agents that work for me")
Scheduled background jobs that run **without you opening the app**:
- **06:30 — Prospecting agent**: discover new leads (Places + website-need scan), enrich, score, queue the day's outreach, build the target-aware plan.
- **Hourly — Watchdog agent**: due/overdue follow-ups, stale deals, proposals expiring, prospects going cold → alerts.
- **19:00 — Accountability agent**: EOD review vs target, adjust tomorrow's volume.
- **Delivery**: a morning **WhatsApp/email digest** ("3 hot leads found overnight, 5 follow-ups due, you're ₹X behind — here's the plan").

---

## 5. Architecture additions
- **New Prisma models**: `DiscoveredLead` (source, rawData, signals JSON, needScore/fitScore, recommendedService, status: NEW/QUALIFIED/PROMOTED/DISMISSED, promotedCompanyId), `AgentRun` (log of each autonomous run + results), `TargetPlan` (funnel snapshot per period), optional `LeadSource`.
- **New AI/service helpers**: `discoverLeads(industry, city)`, `assessWebsiteNeed(url)`, `scoreDiscoveredLead()`, `funnelPlan(target, conversionRates)`, `promoteLead()`.
- **New routes**: `/api/leads/discover`, `/api/leads/[id]/promote`, `/api/command-center/target-plan`, and **secured cron endpoints** (`/api/cron/*` protected by a secret header).
- **Cost control** (critical): route high-volume classification to **Groq** (cheap), deep analysis to Gemini/Claude; hard per-run **budget caps**; **cache** website scans; dedupe.

## 6. The 24/7 reality (honest — this is the one that needs infrastructure)
True around-the-clock agents **cannot run on your laptop dev server**. You need the app **deployed** plus a scheduler:
- **Simplest**: deploy to **Vercel** + **Vercel Cron** hitting your secured `/api/cron/*` routes on a schedule.
- **More control**: a small always-on **Node worker** (VPS) with `node-cron`, or a **queue** (BullMQ + Redis) for parallel, retryable discovery jobs.
- Notifications via your existing WhatsApp/email.
Until deployed, we run the agents as **on-demand buttons** ("Discover leads now", "Build today's plan") — same brains, you just press the button. That's Phase 1 and it's already a massive leap.

## 7. Honest constraints (decisions you'll need to make)
- **Data access & legality**: Google Places = paid beyond the free tier; **no LinkedIn scraping** (against their ToS); directory access varies; **India DPDP Act** governs storing personal contact data; anti-spam rules for outreach (you already hit WhatsApp's 24h/template rule). **Website-need detection on public sites is the most reliable and legal signal** — lead with it.
- **Cost at scale**: discovering + analysing hundreds of businesses/day is real API + token spend. Groq + caching + budget caps keep it sane, but volume = money.
- **Quality vs. quantity**: "analyse the entire internet" isn't realistic or legal; **"analyse the right sources deeply" is** — and converts far better.
- **Infra for autonomy**: deployment + scheduler + (ideally) a queue.

## 8. How this earns you money
1. **Fills your own pipeline** (primary): a continuous stream of qualified, service-matched leads → more DigitalVetri clients, faster.
2. **Productize it as SaaS**: this "AI SDR / Lead Radar" is itself a **sellable product** to other Indian agencies & SMBs — recurring revenue. The Command Center becomes your flagship demo.
3. **Lead-gen / growth-audit as a service**: sell the qualified leads or "free website/growth audit" reports (the need-detection output) as a paid offering.

## 9. Phased roadmap
**Phase 1 — MVP (buildable now, no new infra, runs locally):**
`DiscoveredLead` model → a **"Discover Leads"** action in the Command Center (input industry + city) → Google Places pull → website-need detection on each → score → **Lead Radar** board → **Promote to Company/Prospect** → **Target→funnel math** in the daily plan.
→ _This alone transforms the Command Center and is fully usable on your machine._

**Phase 2 — Autonomy-lite (needs deployment):**
Secured cron endpoints + Vercel Cron → daily auto-discovery + morning WhatsApp/email digest + watchdog alerts.

**Phase 3 — Full 24/7 agent:**
Queue-based parallel workers, continuous multi-source discovery, auto-drafted outreach queue, and a **feedback loop** that learns which leads you win and tunes discovery/scoring to your money.

## 10. Recommended first build
**Phase 1 MVP**, in this order:
1. `DiscoveredLead` data model + migration.
2. `assessWebsiteNeed()` (reuses `fetch-public`) + `scoreDiscoveredLead()` — the reliable, free, legal core.
3. Google Places discovery (`discoverLeads(industry, city)`) — needs your Places API enabled/billing.
4. **Lead Radar** tab in the Command Center + **Promote to Company/Prospect** flow.
5. Target → funnel math surfaced in the daily plan.

_You could even start without Google Places: seed discovery from a list of business names/areas and let the website-need engine do the qualifying — zero external cost — then add Places for volume._
