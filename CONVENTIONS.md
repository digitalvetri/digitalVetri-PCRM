# Build Conventions (for contributors & AI agents)

This is a Next.js 15 App Router + TypeScript + Tailwind + Prisma project. Follow these conventions exactly so modules stay consistent.

## Paths & imports
- Alias `@/` → `src/`.
- App pages live in `src/app/(app)/<route>/page.tsx` (inside the `(app)` route group, which applies the sidebar shell + Clerk auth).
- API routes live in `src/app/api/...`.

## Data & auth
- Import the singleton `prisma` from `@/lib/prisma`.
- Every API route wraps its body in `withApi(async () => { ... })` from `@/lib/api` for uniform error handling.
- Guard with `await requireUser("<permission>")` from `@/lib/rbac` (throws `ApiError`). Permissions are keys in `src/lib/rbac.ts` PERMISSIONS (e.g. `companies.view`, `prospects.edit`, `proposals.manage`, `content.generate`, `tasks.manage`, `reports.view`, `settings.manage`).
- Dynamic route params are async: `{ params }: { params: Promise<{ id: string }> }` then `const { id } = await params;`.
- Server Components fetch directly via prisma. Use `getCurrentUser()` from `@/lib/rbac` for the logged-in user.
- Log meaningful actions via `logActivity({ type, message, userId, companyId })` from `@/lib/activity`. Valid `ActivityType` values are in the Prisma schema.
- Human IDs via `nextId(counterName, prefix)` from `@/lib/counters` (e.g. `nextId("prospect", "DV-P")`).

## AI
- Use helpers from `@/lib/ai/*`: `generateText`, `generateJSON` (provider.ts); `analyzeCompany`, `generateLeadIntelligence`, `generateCrmRecommendation`, `enrichCompany`, `applyEnrichment` (analyze.ts); `generateQuestionnaire` (questionnaire.ts); `generateEmail`, `generateWhatsApp` (content.ts); `generateProposal` (proposal.ts); `askAssistant` (assistant.ts).
- Never call provider SDKs directly from routes/pages.
- All employee/revenue/score/budget values are ESTIMATES. Always render them with `<ConfidenceBadge confidence="ESTIMATED" />` or an `<EstimateNote />` from `@/components/shared/confidence-badge`.

## UI kit (`@/components/ui`)
- `button`, `card` (Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter), `input`, `textarea`, `label`, `badge`, `select` (Select/SelectTrigger/SelectValue/SelectContent/SelectItem), `dialog`, `table`, `tabs`, `dropdown-menu`.
- `misc` exports: Separator, Skeleton, Progress, Switch, Checkbox, Avatar/AvatarImage/AvatarFallback, ScrollArea, Tooltip/TooltipProvider/TooltipTrigger/TooltipContent, Popover/PopoverTrigger/PopoverContent.

## Shared components (`@/components/shared`)
- `PageHeader` (title, description, children=actions).
- `StatCard` (label, value, icon, hint, accent, index).
- `ScoreBar`, `ScoreRing` from `score.tsx`.
- `GradeBadge`, `StatusBadge` from `grade-badge.tsx`.
- `ConfidenceBadge`, `EstimateNote`.
- `EmptyState` (icon, title, description, action).

## Charts (`@/components/charts/charts`)
- `DonutChart`, `VerticalBarChart`, `ColumnChart`, `TrendAreaChart`, `MultiLineChart`, `SalesFunnelChart`. All are client components taking `{ name, value }[]` (or multi-key data).

## Utils (`@/lib/utils`)
- `cn`, `formatINR(n, compact?)`, `formatDate`, `formatDateTime`, `slugify`, `initials`, `enumLabel`, `relativeTime`.
- Constants in `@/lib/constants`: `CRM_MODULES`, `INDUSTRIES`, `LEAD_GRADES`, `LEAD_GRADE_LABELS`, `LEAD_GRADE_COLORS`, `PROSPECT_STATUSES`, `STATUS_COLORS`, `FUNNEL_STAGES`, `EMPLOYEE_RANGES`, `REVENUE_RANGES`, `BRAND`.

## Style
- Primary color `#0F62FE` via `bg-primary`. Cards are `rounded-xl`. Use `animate-fade-in` and Framer Motion for entrance animations.
- Currency is INR (`formatINR`). Dark + light mode via CSS vars already set — never hardcode background/foreground colors, use `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border`, etc.
- Client components that use hooks/interactivity need `"use client"`.

## Money
- All amounts stored as `Float` in INR. Format with `formatINR`.
