# DigitalVetri CRM — Application Review

_Reviewed 2026-07-02. Scope: full codebase (~15.7k LOC, 33 API routes, 21 pages, 25 lib files). Dimensions: security/authorization, data layer, architecture/quality, frontend/UX/accessibility, AI integration._

## Overall assessment

The codebase is **healthy and unusually disciplined for its stage**. Conventions are followed rigorously — verified by sweep, not spot-check:

- All 33 API routes wrap in `withApi` + `requireUser(...)`; no route exports non-handlers.
- No AI SDK calls leak outside `src/lib/ai/provider.ts` (clean provider abstraction with lazy imports).
- `middleware.ts` runs `auth.protect()` on all non-public routes incl. `/api` — **no unauthenticated access path**.
- TypeScript `strict: true`; `next.config.ts` has no `ignoreBuildErrors`/`ignoreDuringBuilds` escape hatches.
- Ethical, bounded public scraping (size/timeout caps, robots.txt respect).

The real gaps are **not architectural rot** — they cluster in four themes: (1) a handful of authorization holes, (2) untrusted input reaching network fetches and AI prompts, (3) scale/robustness (pagination, money precision, error boundaries), and (4) process maturity (no tests, no CI, dead lint).

**Context that shapes severity:** the app is **single-org / not multi-tenant** by design (no `Org`/`orgId` in the schema). So there are no cross-tenant leaks — all authz findings are within-org role gaps. AI JSON output is **never runtime-validated**, which is the single most impactful correctness risk.

---

## Fix first (top priorities)

1. **SSRF via user-supplied company website URL** — network fetch of arbitrary internal addresses. _(Security/High)_
2. **AI JSON output never schema-validated before persist/render** — hallucinated/missing fields crash or poison the DB. _(AI/High)_
3. **No `error.tsx` / `loading.tsx` anywhere** — any query failure = broken screen; every navigation blocks with no skeleton. _(Frontend/Critical)_
4. **Authorization holes** — dead `prospects.assign` gate, no record-level ownership, VIEWER can drive AI writes. _(Security/High)_
5. **Unbounded `findMany` on every list page** — linear memory/latency growth as data grows. _(Data/High)_
6. **No timeouts on AI calls + no `maxDuration`** — long calls 504 on serverless mid-generation, leaving partial writes. _(AI/High)_
7. **`withApi` leaks raw internal error text to clients on 500** — info disclosure + poor UX. _(Cross-cutting/High)_

---

## 1. Security & Authorization

**[HIGH] SSRF via company website URL** — `src/lib/fetch-public.ts:59-78`, reached from `src/app/api/companies/import/route.ts:76`. `fetchPublicPageText` fetches a user-controlled URL, only checks protocol is http(s), with `redirect: "follow"` and **no block on private/loopback/link-local hosts**. A `companies.import` user (SALES+) can point it at `http://169.254.169.254/latest/meta-data/...` (cloud metadata) or internal services; the response flows into enrichment and is rendered/stored. The robots.txt check makes a _second_ attacker-directed fetch. **Fix:** resolve host and reject private ranges before fetch; re-validate each redirect hop (or `redirect: "manual"`); apply the same check to the robots.txt fetch.

**[HIGH] `prospects.assign` permission is dead code** — `rbac.ts:18` defines it MANAGER/ADMIN-only, but no route references it (verified by grep). `assignedToId` is accepted in the PATCH/create schemas gated only by `prospects.edit` (SALES) — `src/app/api/prospects/[id]/route.ts:38,59`, `route.ts:77`. Any SALES user reassigns any prospect, bypassing the manager-only control. **Fix:** enforce `prospects.assign` whenever `assignedToId` is present, or drop it from the SALES schema.

**[HIGH] No record-level ownership** — any SALES user can edit/delete any record org-wide. Notably `DELETE /api/prospects/[id]` (`prospects/[id]/route.ts:94-100`) needs only `prospects.edit` (SALES) while `companies.delete` correctly needs MANAGER. Same for tasks/meetings/proposals/follow-ups (single `*.manage` gate, no owner check). **Fix:** scope edit/delete to `createdById`/`assignedToId` match or role ≥ MANAGER; add a dedicated `prospects.delete` gate.

**[MEDIUM, HIGH-if-seeded] Account-claim by email inherits role & isActive** — `rbac.ts:61-67`. First Clerk sign-in claims any existing DB row with a matching email, **copying its `role`/`isActive`**. If an elevated row exists with a known/guessable email (e.g. seeded admin `info@digitalvetri.com`) and Clerk email-verification isn't enforced, that signer inherits admin. **Fix:** don't inherit role/isActive on claim; only link to pre-provisioned rows; require verified email; never auto-grant ADMIN via claim.

**[MEDIUM → ✅ FIXED] VIEWER can trigger expensive AI writes via `reports.view`** — added a `commandCenter.manage` permission (ADMIN/MANAGER/SALES, excludes VIEWER) and moved `command-center/plan`, `review`, and `coach` POSTs onto it. The CommandTabs workspace now renders a read-only notice for VIEWERs (the read dashboard above stays visible). Covered by `rbac.test.ts`.

**[MEDIUM] No rate limiting on any AI/scrape endpoint** — every AI route calls a paid provider with no throttle; a session can loop them for unbounded cost/DoS. **Fix:** per-user rate limit + concurrency cap.

**[MEDIUM] Prompt injection via scraped content** — attacker-owned imported-site text feeds the enrichment LLM and is persisted. **Fix (still open):** delimit untrusted content, instruct model to treat as data, sanitize stored output. _(The related auth gap — `assistant` was on bare `requireUser()`, exposing the business snapshot + AI spend to any active user incl. VIEWER — is now ✅ FIXED: gated on `content.generate` and the floating launcher is hidden for VIEWERs. Prompt-injection hardening itself remains.)_

**[MEDIUM-LOW] No file-size limit on import upload** — `companies/import/route.ts:27-33` buffers the whole upload into memory before parse; a crafted `.xlsx` (zip bomb) can exhaust memory. **Fix:** cap upload size + row count, reject early.

**[LOW] `uploadFile` targets a public Supabase bucket** — `supabase.ts:33-36` (currently no callers). Uses `getPublicUrl` for proposals/exports/imports — sensitive PDFs at guessable public URLs bypass RBAC if wired up. **Fix:** private bucket + signed expiring URLs before adopting.

**Secrets check: clean.** No server secrets exposed to client; `NEXT_PUBLIC_*` are client-safe by design; service-role/AI/CRM keys are server-only. CRM sync targets an env URL (not user input) — not SSRF.

---

## 2. AI Integration

**[HIGH] AI JSON output is never schema-validated** — `provider.ts:43-68`. `generateJSON<T>` casts `JSON.parse(...) as T` with no runtime check — the `<T>` is fiction. Missing/wrong fields flow into Prisma and the UI. Concrete crash: `analyze.ts:87` reads `result.scoringFactors.employeeScale` → `TypeError` if omitted; `analyze.ts:226` `Math.round(r.estimatedHours)` persists `NaN` if absent. **Fix:** validate every `generateJSON` result with zod; reject/repair on failure.

**[HIGH] No timeout on model calls + no route `maxDuration`** — `provider.ts:87-132`. SDK clients get no `timeout` (inherit ~10min default + auto-retry); `companies/[id]/analyze/route.ts:18-21` chains three sequential calls. No route exports `maxDuration`/`runtime` (verified by grep), so on serverless these 504 mid-generation, leaving partial DB writes. **Fix:** explicit per-call timeouts; `export const maxDuration` on long AI routes; consider backgrounding `analyze`.

**[MEDIUM] `parseJsonLoose` is brittle** — `provider.ts:71-80`. Strips code fences (good) then slices first `{` to last `}` — any prose brace or brace inside a string yields a wrong/invalid slice. Retry (`provider.ts:54`) reuses identical params, often reproducing the same bad output. **Fix:** use provider-native JSON/structured-output modes; nudge temperature on retry.

**[MEDIUM] AI money fields not marked as estimates (convention gap)** — the app flags `employeeConfidence`/`revenueConfidence = "ESTIMATED"` (`analyze.ts:262-264`), but AI-fabricated commercial figures — `crmRecommendation.estimatedCost`/`annualSavings` (`analyze.ts:221-247`), proposal `totalValue`/`pricing[].amount`/`amc.annualValue` (`proposal.ts:58-62`) — persist as plain numbers and render as authoritative pricing. **Fix:** carry an `ESTIMATED` marker consistent with the existing convention.

_(SSRF and prompt injection also surfaced here — see Security.)_

---

## 3. Data Layer

**[HIGH] Unbounded `findMany` on every list page** — pages query Prisma directly and skip the paginated APIs: `companies/page.tsx:14`, `prospects/page.tsx:14`, `meetings/page.tsx:17`, `proposals/page.tsx:15`, `follow-ups/page.tsx:27,38`, `tasks/page.tsx:16,24`, `lead-intelligence/page.tsx:31`, `automation-opportunities/page.tsx:41`, `crm-opportunities/page.tsx:28`, `calendar/page.tsx:15/20/28`; plus `GET /api/proposals` (`route.ts:14`). The full set (with deep includes) is serialized into the RSC payload; client tables only paginate _rendering_. **Fix:** server-side pagination (the API `page/pageSize` pattern already exists) or a bounded `take`.

**[HIGH → decided WON'T-FIX] `Float` for all money columns** — `Prospect.proposalValue` (schema:281), `Proposal.totalValue`/`amcValue` (395-396), `CrmRecommendation.estimatedCost`/`annualSavings` (239,242). **Decision (2026-07-02): keep Float.** Values are AI *estimates* shown rounded to whole rupees; float drift only crosses the 0.5-rupee threshold at multi-trillion-rupee pipelines — imperceptible here. A `.toNumber()`-at-boundary migration would re-sum in JS float (no benefit); a proper fix (Decimal + Prisma `_sum` aggregates) is ~24 files for no perceptible gain. Revisit only if exact accounting is required.

**[MEDIUM] Over-fetching whole rows for aggregates** — `queries.ts:21-22` (`getDashboardStats` loads all WON + active prospects to do `.length`/`.reduce`); `command-center.ts:41` loads active prospects with `company` include just to sum. **Fix:** `count` + `aggregate({ _sum })`.

**[MEDIUM] List pages drag full JSON blobs** — `include: { analysis: true }` in `companies/page.tsx:15`, `prospects/page.tsx:15-21` pulls large JSON (`painPoints`, `scoreBreakdown`) for tables showing a few scalars. **Fix:** `select` only rendered columns.

**[MEDIUM → ✅ FIXED] Missing indexes on sorted/filtered columns** — added `@@index` on `CompanyAnalysis.automationScore` & `crmOpportunityScore`, and `Company.createdAt`. Pushed to DB.

**[LOW → ✅ FIXED] FKs without indexes** — added `@@index` on `Meeting.userId`, `Proposal.userId` + `Proposal.validUntil`, `Note.authorId`, `Task.createdById` + `Task.prospectId`, `FollowUp.prospectId`, `Activity.userId`. Pushed to DB (12 new indexes verified in Postgres).

**[LOW] Non-transactional related writes** — `analyze.ts:94+133` (analysis upsert then `analyzedAt` stamp); `nextId()`+`create()` not wrapped (harmless sequence gaps only — the counter itself _is_ atomic, verified, so no duplicate IDs). **Fix:** `$transaction` only if strictly needed.

**[LOW] Company dedup by slug only** — `import.ts:29-33`; same domain + different name imports twice. Consider a unique/index on `domain`.

---

## 4. Frontend / UX / Accessibility

**[CRITICAL] No `error.tsx` anywhere** — every `(app)` page is `force-dynamic` running multiple request-time Prisma queries (dashboard runs 7). Any throw bubbles to root with no boundary → default error screen / blank page. **Fix:** `error.tsx` with reset per segment or at `(app)/`.

**[CRITICAL] No `loading.tsx` / Suspense** — pages `await` all DB work before returning; navigation blocks server-side with no skeleton, old page freezes then hard-swaps. A `Skeleton` primitive already exists (`ui/misc.tsx:41`). **Fix:** `loading.tsx` skeletons and/or `<Suspense>`.

**[HIGH → ✅ FIXED] Form labels not associated with inputs** (WCAG 1.3.1/4.1.2) — wired `useId()`-based `htmlFor`/`id` across all **63** flagged fields in 12 files (`id` on `Input`/`Textarea`, on `SelectTrigger` for Radix Selects; per-row `${base}-${i}` ids in `.map()`s). Added `jsx-a11y/label-has-associated-control` to `.eslintrc` (with `Label`/`Input`/`Textarea` component mapping) as a durable regression guard — now 0 warnings.

**[HIGH → ✅ FIXED] GlobalSearch: response race + swallowed errors + no listbox semantics** — `global-search.tsx`: added `AbortController` (aborts superseded requests — fixes the stale-overwrite bug), a `catch` with an error state + `role="alert"` message, and combobox/listbox ARIA (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete`, `role="listbox"`/`option`, `aria-label`). _Arrow-key roving nav deferred (behavioral)._

**[MEDIUM → ✅ FIXED] Assistant panel a11y** — `assistant.tsx`: added `role="dialog"` + `aria-modal` + `aria-label`, focus-into-input on open, Escape-to-close, `role="log"`/`aria-live="polite"` on the message stream, and `aria-label` on the input. _Full hand-rolled focus trap deferred (behavioral, custom `motion.div`)._

**[MEDIUM → ✅ FIXED] Table sorting is dead UI** — deleted the unused `SortingState`/`getSortedRowModel`/`onSortingChange` machinery from `prospects-table.tsx` (the honest fix — it was never wired to headers). No behavior change.

**[MEDIUM → deferred] Charts have no accessible alternative + hardcoded palette** — a valid `role="img"` needs a *meaningful* `aria-label` per chart, which requires threading label context through many call sites; that plus the data-table fallback and `--chart-*` palette swap are a visual pass — deferred.

**[MEDIUM → ✅ FIXED] No `prefers-reduced-motion` support** — added a global `@media (prefers-reduced-motion: reduce)` rule in `globals.css` (neutralizes CSS animations/transitions) **and** `<MotionConfig reducedMotion="user">` in `app-shell.tsx` (covers all Framer Motion).

**[MEDIUM] ProposalGenerator client-fetch waterfall** — `proposal-generator.tsx:51-56` fetches company list in `useEffect` post-mount with no loading state; could be a server prop like `email-generator`.

**[LOW → partly FIXED]** ✅ Skip-to-content link + focusable `<main id="main-content" tabIndex={-1}>` added in `app-shell.tsx`; ✅ `aria-label` added to the icon-only search inputs (global-search, prospects-table, companies-table, assistant). _Deferred (behavioral): mobile drawer focus trap/Escape (`sidebar.tsx`), calendar grid roving tabindex (`calendar-view.tsx`), theme-toggle icon flash._

---

## 5. Architecture, Code Quality & Process

**[HIGH] `withApi` leaks raw internal error text on 500** — `api.ts:33-34` returns `err.message` verbatim (Prisma/driver/AI errors like "OPENAI_API_KEY is not configured" reach the browser). **Fix:** log server-side (already done), return generic `"Internal server error"` for the 500 branch.

**[HIGH] No test coverage anywhere** — zero test files, no runner in `package.json`. Untested critical logic: `parseJsonLoose`/`generateJSON` retry, `roleCan` matrix, `formatINR` tiers, robots.txt parsing. **Fix:** add a runner (vitest), cover pure helpers first.

**[HIGH] `next lint` is a dead script** — `package.json:10` defines it but no ESLint is installed/configured. The "build-green" status is typecheck-only. **Fix:** install/configure ESLint or remove the misleading script.

**[MEDIUM] No CI** — no `.github/`; typecheck/build/lint run only manually. **Fix:** a PR workflow running typecheck + build.

**[MEDIUM] God file** — `command-tabs.tsx` at 1115 lines (~5× the next component), 7+ fetch/catch/toast flows. **Fix:** split per tab.

**[MEDIUM] Unvalidated `as unknown as` casts on Prisma `Json` columns** — AI-generated JSON asserted into typed shapes with no runtime check: `proposals/[id]/pdf/route.ts:24`, `meetings/[id]/pdf/route.ts:19`, `command-center/page.tsx:46-48`, `lead-intelligence/page.tsx:52`, `automation-opportunities/page.tsx:107`, `companies/[id]/page.tsx:398`. A legacy/malformed record can throw at render/export. **Fix:** zod-parse at the read boundary (schemas already exist).

**[MEDIUM] Duplicated fetch/try-catch/toast boilerplate** across ~27 component call sites (e.g. `companies-table.tsx:77-112`). **Fix:** extract a shared `apiFetch<T>()` that does the ok-check + error extraction once.

**[LOW]** Missing return type on `cn` (`utils.ts:4`); minor unsafe casts `grade as never` (`companies/route.ts:34`) and `as never` on prospect status/grade enums (validate with `z.enum`).

**Correctness bug (out of review scope, flagged):** `crm/sync/route.ts:98` — when CRM is unconfigured, prospects are still written `syncedToCrm: true` with a synthetic `DV-CRM-…` id, but the candidate query filters `syncedToCrm: false` (line 24), so once a real CRM is configured these records are permanently excluded and never actually push. **Fix:** gate the `syncedToCrm` write on `crmConfigured`.

---

## Implementation status (updated 2026-07-02)

**✅ Done — Immediate (security + correctness):** SSRF guard (`fetch-public.ts`), `prospects.assign` enforcement (on assignee change) + `prospects.delete` gate + reassign UI gating, AI JSON zod-validation across `analyze.ts`'s 4 persisted paths, generic 500 messages (`api.ts`).

**✅ Done — Robustness (part):** `error.tsx` + `loading.tsx` at `(app)/`, AI-call timeouts (`provider.ts`, 60s + `maxRetries: 1`) and `maxDuration` on the 10 AI routes (300s for `analyze`/`import`, 120s others).

**✅ Done — Process foundation:** ESLint wired up (`.eslintrc.json` + `eslint`/`eslint-config-next` installed; `next lint` now green across the codebase); Vitest added (`vitest.config.ts`, `test`/`test:watch` scripts) with **38 passing tests** covering `formatINR`/`slugify`/`enumLabel`, the scoring math, `parseJsonLoose`, the SSRF guard (all internal/private/encoded targets blocked), and the rate limiter; GitHub Actions CI (`.github/workflows/ci.yml`: install → prisma generate → typecheck → lint → test → build); `crm/sync` bug fixed (no longer marks prospects synced when the CRM is unconfigured).

**✅ Done — Rate limiting:** in-memory per-user fixed-window limiter (`src/lib/rate-limit.ts`, `ApiError` extracted to `src/lib/api-error.ts` so the limiter stays Clerk-free/testable) enforced on all 10 AI/scrape routes (analyze 10/min, import 5/min, content/coach/plan/review/questions/proposal 20/min, assistant 30/min) → 429 when exceeded. Single-process state; note in the file for the multi-instance case.

**✅ Done — AI output validation (remaining callers):** zod `.catch`-defaulted schemas added to the other 8 `generateJSON` calls — `proposal.ts`, `questionnaire.ts`, `ceo-os.ts` (all 6 CEO-OS generators), `assistant.ts` (intent classifier falls back to `unknown` on garbage). Every persisted/rendered AI JSON path in the app is now runtime-validated. (`content.ts` uses `generateText` plain-text, no JSON to validate.)

**✅ Done — DB indexes:** 12 new indexes added + pushed (`CompanyAnalysis.automationScore`/`crmOpportunityScore`, `Company.createdAt`, and FK/filter indexes on `Meeting.userId`, `Proposal.userId`/`validUntil`, `Note.authorId`, `Task.createdById`/`prospectId`, `FollowUp.prospectId`, `Activity.userId`). Verified in Postgres.

**⏭️ Decided WON'T-FIX — Float→Decimal money migration:** keeping Float (see the money finding above) — imperceptible precision benefit at this app's scale, and the naive migration delivers none of it.

**⏳ Deferred — list-page pagination.** Intentionally NOT done: at current data volume (single digits) unbounded `findMany` is not a live problem, and a naive `take` cap would introduce correctness bugs (e.g. `companies/page.tsx` derives its `industries`/`cities` filter dropdowns from the loaded set). Do it properly when volume warrants and it can be browser-tested:
- searchParams-driven `page`/`pageSize` on the heavy pages (companies, prospects, meetings, proposals) and `GET /api/proposals`.
- Move filter-option derivation to separate `distinct` queries (not the paged set).
- Keep the existing `count()`/`aggregate()` stat queries as-is.
- Swap the tables' in-memory pagination for server-driven page controls (needs click-through testing).

## Remaining sequencing

**Near-term:** list-page pagination (spec above); record-level ownership (only role-gating done so far); prompt-injection hardening for scraped content fed to the enrichment LLM.

**Remaining a11y (behavioral / visual — need a browser pass):** chart `role="img"` + meaningful labels + themed `--chart-*` palette + data-table fallback; GlobalSearch arrow-key roving nav; assistant focus trap; mobile-drawer focus trap/Escape; calendar grid roving tabindex.

**Polish:** split `command-tabs.tsx`, shared `apiFetch` helper, estimate-marking of AI money fields.

_(Completed: SSRF, prospects.assign/delete, generic 500s, AI-JSON validation across all callers, error/loading boundaries, AI timeouts + maxDuration, ESLint, Vitest (43 tests), CI, crm/sync fix, rate limiting, DB indexes, VIEWER-can-write gate, assistant route gate, a11y batch — 63 form labels + reduced-motion + skip-link + GlobalSearch race/ARIA + assistant panel ARIA + dead-sort removal + icon-input labels.)_
