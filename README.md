# DigitalVetri — AI Sales Intelligence Platform

An AI-powered B2B prospect intelligence system for **DigitalVetri**. It replaces manual research with automated company analysis, lead scoring, and pipeline management for selling **Custom CRM, ERP, AI Automation and Business Software**.

Built with Next.js 15, TypeScript, Tailwind, Prisma/PostgreSQL, Clerk, and a pluggable AI layer (OpenAI / Claude / Gemini).

---

## ✨ Features

| Module | What it does |
| --- | --- |
| **Dashboard** | 10 live KPIs + Industry / Lead-Score / Funnel / City / Opportunity charts + activity feed |
| **Company Intelligence** | Import from Excel, CSV, manual entry, Google Maps, LinkedIn URL or Website URL |
| **AI Company Analyzer** | Business summary, Digital/Automation/CRM/ERP/AI opportunity scores, pain points, budget, buying probability, A+/A/B/C grade |
| **Prospect Database** | Full pipeline with TanStack table, filters, bulk update, Excel export |
| **Lead Intelligence Engine** | Industry-based prediction of 10 challenge categories, each with *why* |
| **CRM Recommendation Engine** | Recommended modules, hours, timeline, team size, cost, ROI, annual savings |
| **Discovery Meetings** | Dynamic industry questionnaires (Manufacturing 80+ questions), PDF export |
| **Proposal Generator** | Full structured proposal (cover → pricing → AMC → signature), PDF export |
| **Email Generator** | Cold, follow-up, meeting-request, proposal follow-up, thank-you |
| **WhatsApp Generator** | First contact, follow-up, reminders, festival greetings, review/referral requests |
| **Follow-up Manager** | Overdue / Today / Upcoming board |
| **Tasks & Calendar** | Kanban tasks + unified month calendar (meetings, follow-ups, tasks) |
| **Reports & Analytics** | Revenue forecast, lead source, industry, proposal conversion, sales performance, closures, pipeline |
| **AI Assistant** | Floating assistant on every page — natural-language queries over your data |
| **Settings** | Company profile, AI provider, role management (Admin/Manager/Sales/Viewer) |
| **CRM Integration** | Sync qualified prospects into the DigitalVetri CRM |

### Responsible-data design
- Uses **only publicly available** business information.
- Respects **robots.txt** when fetching public pages (`src/lib/fetch-public.ts`), with a clearly identified user agent.
- **Every estimate** (employees, revenue, scores, budgets) is stored with a confidence flag and rendered with an *AI estimate* badge, visually distinct from verified data.

---

## 🧱 Tech Stack

- **Framework:** Next.js 15 (App Router) · React 19 · TypeScript
- **UI:** Tailwind CSS · shadcn/ui-style components (Radix) · Framer Motion · Lucide icons
- **Data:** PostgreSQL · Prisma ORM
- **Auth:** Clerk (role-based access)
- **AI:** Pluggable provider — OpenAI, Claude, or Gemini (`AI_PROVIDER`)
- **Storage:** Supabase Storage (proposal / export files)
- **Charts:** Recharts · **Tables:** TanStack Table
- **Excel:** ExcelJS · **PDF:** pdf-lib · **Maps:** Google Maps API
- **Deploy:** Vercel

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.18+ (tested on 20/22)
- A PostgreSQL database
- A [Clerk](https://clerk.com) application (publishable + secret keys)
- At least one AI provider key (OpenAI / Anthropic / Gemini)

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Fill in `DATABASE_URL`, Clerk keys, and at least one AI key. Set `AI_PROVIDER` to `openai`, `claude`, or `gemini`. Supabase and Google Maps keys are optional (features degrade gracefully without them).

### 4. Set up the database
```bash
npm run db:generate   # generate Prisma client
npm run db:push       # create tables
npm run db:seed       # (optional) load 8 demo companies + prospects
```

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000. **The first user to sign in becomes ADMIN automatically.**

---

## 📂 Project Structure

```
prisma/
  schema.prisma          # full data model
  seed.ts                # demo data
src/
  app/
    (app)/               # authenticated app (sidebar shell) — all 16 pages
    api/                 # API routes (companies, prospects, meetings, proposals, content, ...)
    sign-in, sign-up     # Clerk auth pages
    layout.tsx, globals.css
  components/
    ui/                  # shadcn-style primitives
    shared/              # StatCard, ScoreBar, GradeBadge, ConfidenceBadge, ...
    charts/              # Recharts wrappers
    layout/              # Sidebar, Topbar, AppShell, GlobalSearch
    ai/                  # floating AI Assistant
    companies/ prospects/ meetings/ proposals/ content/ ...
  lib/
    ai/                  # provider.ts (pluggable), analyze.ts, prompts.ts, content.ts,
                         # proposal.ts, questionnaire.ts, assistant.ts
    prisma.ts rbac.ts api.ts scoring.ts queries.ts reports.ts
    excel.ts pdf.ts fetch-public.ts import.ts supabase.ts settings.ts
CONVENTIONS.md           # contributor/agent conventions
```

---

## 🔌 Pluggable AI

All AI features route through `src/lib/ai/provider.ts`. Switch providers with a single env var:

```env
AI_PROVIDER="claude"   # openai | claude | gemini
```

`generateText()` and `generateJSON()` handle provider selection, JSON coercion and retries. No feature code imports a provider SDK directly, so adding a new provider means editing one file.

---

## 🔐 Roles & Permissions

| Role | Capabilities |
| --- | --- |
| **Admin** | Everything, incl. settings & user management |
| **Manager** | Assign/bulk-update prospects, CRM sync, all content & reports |
| **Sales** | Import/analyse companies, manage prospects/meetings/proposals, generate content |
| **Viewer** | Read-only across companies, prospects, reports |

Permissions are declared in `src/lib/rbac.ts` and enforced on every API route via `requireUser("<permission>")`.

---

## 📦 Key Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # start production server
npm run typecheck    # tsc --noEmit
npm run db:push      # sync schema to DB
npm run db:seed      # seed demo data
npm run db:studio    # Prisma Studio
```

---

## 🚢 Deploy to Vercel

1. Push to a Git repo and import into Vercel.
2. Add all environment variables from `.env.example`.
3. Set the build command to `prisma generate && next build` (or add `postinstall: prisma generate`).
4. Point `DATABASE_URL` at a managed Postgres (Supabase, Neon, RDS…).
5. Run `prisma db push` (or migrations) against the production database once.

---

## ⚖️ Data & Ethics

This platform is designed for **legitimate B2B research using public information only**. It does not scrape private or restricted data, honours `robots.txt`, and clearly labels every AI-generated estimate. Decision-maker details are stored only when publicly available (company website, public LinkedIn, published directories).

© DigitalVetri — internal use.
