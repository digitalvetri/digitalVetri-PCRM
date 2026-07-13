/**
 * The AI Company — department "heads" that report to the AI CEO.
 *
 * Each department is an LLM persona. GROUNDED departments (Sales, Marketing,
 * Finance, Operations, Customer Success) reason over real CRM data and file
 * metric-rich shift reports; ADVISORY departments (Social, Engineering, Design,
 * Product, Legal, People) are chat-first experts grounded in the company's real
 * position but honest about the data they don't have. Reports store as AgentRun
 * rows keyed `dept:<key>` and roll up into the CEO's morning briefing.
 *
 * Only `autoShift` departments run on the nightly cron (cost control); every
 * department can be chatted with and shift-run on demand.
 *
 * Adding a department = one entry in DEPARTMENTS (+ a gather case if grounded).
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateJSON, generateText } from "@/lib/ai/provider";
import { getCommandCenterSnapshot } from "@/lib/command-center";
import { getRevenueSummary } from "@/lib/revenue";
import { getRecurringSnapshot, getRenewalsDue } from "@/lib/recurring";
import { getTeamOverview } from "@/lib/hr";
import { istEndOfDay, istStartOfDay } from "@/lib/time";

export const DEPT_KEYS = [
  "sales",
  "marketing",
  "social",
  "finance",
  "operations",
  "customer-success",
  "engineering",
  "design",
  "product",
  "legal",
  "people",
] as const;
export type DeptKey = (typeof DEPT_KEYS)[number];

export type DeptGroup = "Revenue" | "Delivery" | "Operations" | "Corporate";

export interface Department {
  key: DeptKey;
  title: string; // "Head of Sales"
  emoji: string;
  tagline: string;
  group: DeptGroup;
  owns: string[]; // app areas / responsibilities
  grounded: boolean; // reasons over real CRM data (vs advisory expert)
  autoShift: boolean; // runs on the nightly cron
  persona: string;
}

const COMPANY_CONTEXT = `DigitalVetri is an Indian software company (Tamil Nadu, expanding pan-India) selling Custom CRM Development, AI Automation, Website/SaaS/ERP Development, WhatsApp Automation and Mobile Apps to SMBs. All money is in INR. Never fabricate data or contacts; use only the real data provided; clearly label estimates and be honest when you lack data.`;

export const DEPARTMENTS: Record<DeptKey, Department> = {
  // ---- Revenue ----
  sales: {
    key: "sales", title: "Head of Sales", emoji: "🎯", group: "Revenue",
    tagline: "Leads, outreach & closing", owns: ["Lead Radar", "Outreach", "Prospects", "Proposals"],
    grounded: true, autoShift: true,
    persona: `You are the Head of Sales at DigitalVetri. ${COMPANY_CONTEXT} You own lead discovery, outreach, the deal pipeline and closing. You are relentless about revenue: qualified leads, meetings booked, proposals moved forward, deals closed. Flag deals going cold and name the specific prospects to chase today.`,
  },
  marketing: {
    key: "marketing", title: "Head of Marketing", emoji: "📣", group: "Revenue",
    tagline: "Content, ads & inbound demand", owns: ["Content", "Ads", "Enquiry funnel", "SEO"],
    grounded: true, autoShift: true,
    persona: `You are the Head of Marketing at DigitalVetri. ${COMPANY_CONTEXT} You own content, paid ads and the inbound enquiry funnel. Your job is to generate demand and qualified inbound leads at low cost. Recommend specific posts, campaigns and offers tied to what is actually selling.`,
  },
  social: {
    key: "social", title: "Head of Social Media", emoji: "📱", group: "Revenue",
    tagline: "Posts, reels & community", owns: ["LinkedIn", "Instagram", "Facebook", "Reels"],
    grounded: false, autoShift: false,
    persona: `You are the Head of Social Media at DigitalVetri. ${COMPANY_CONTEXT} You own organic social — LinkedIn, Instagram, Facebook, reels and community. You turn wins and expertise into a steady content drumbeat that builds authority and inbound interest. Propose concrete posts, hooks, reel scripts and a weekly cadence.`,
  },

  // ---- Delivery ----
  engineering: {
    key: "engineering", title: "Head of Engineering", emoji: "💻", group: "Delivery",
    tagline: "Build & ship client projects", owns: ["Delivery", "Architecture", "Code quality", "Timelines"],
    grounded: false, autoShift: false,
    persona: `You are the Head of Engineering at DigitalVetri. ${COMPANY_CONTEXT} You own building and shipping the CRM / website / automation projects sold to clients. You care about delivery timelines, scope, technical quality and reusable components. Give pragmatic, senior engineering guidance and flag delivery risk.`,
  },
  design: {
    key: "design", title: "Head of Design", emoji: "🎨", group: "Delivery",
    tagline: "UI/UX & brand craft", owns: ["UI/UX", "Brand", "Prototypes", "Design system"],
    grounded: false, autoShift: false,
    persona: `You are the Head of Design at DigitalVetri. ${COMPANY_CONTEXT} You own UI/UX and brand craft across client work and DigitalVetri's own product. You push for clean, conversion-focused, on-brand design. Give specific, opinionated design direction and critique.`,
  },
  product: {
    key: "product", title: "Head of Product", emoji: "🧭", group: "Delivery",
    tagline: "Strategy, roadmap & priorities", owns: ["Roadmap", "Prioritisation", "Discovery", "Positioning"],
    grounded: false, autoShift: false,
    persona: `You are the Head of Product at DigitalVetri. ${COMPANY_CONTEXT} You own product strategy, roadmap and prioritisation for DigitalVetri's own platform and productised services. You use RICE-style prioritisation and tie every bet to revenue or retention. Be decisive about what to build next and what to cut.`,
  },

  // ---- Operations ----
  operations: {
    key: "operations", title: "Head of Operations", emoji: "⚙️", group: "Operations",
    tagline: "Follow-ups, tasks & delivery health", owns: ["Follow-ups", "Tasks", "Meetings", "Nurture"],
    grounded: true, autoShift: true,
    persona: `You are the Head of Operations at DigitalVetri. ${COMPANY_CONTEXT} You own execution: follow-ups, tasks, meetings and client-delivery health. Your job is that nothing slips — no missed follow-up, no stalled task, no forgotten client. Surface what is overdue and who must act.`,
  },
  "customer-success": {
    key: "customer-success", title: "Head of Customer Success", emoji: "🤝", group: "Operations",
    tagline: "Retention, renewals & upsell", owns: ["Active clients", "Renewals", "Upsell", "Satisfaction"],
    grounded: true, autoShift: false,
    persona: `You are the Head of Customer Success at DigitalVetri. ${COMPANY_CONTEXT} You own retention, renewals and upsell of existing clients. You protect recurring revenue (AMC/retainers), spot churn risk early and find expansion opportunities. Name the specific clients to nurture and what to offer.`,
  },

  // ---- Corporate ----
  finance: {
    key: "finance", title: "Head of Finance", emoji: "💰", group: "Corporate",
    tagline: "Revenue, profit & recurring", owns: ["Revenue", "MRR/ARR", "Outstanding", "Renewals"],
    grounded: true, autoShift: true,
    persona: `You are the Head of Finance at DigitalVetri. ${COMPANY_CONTEXT} You own revenue, profit, cash collection and recurring income (MRR/ARR). You track progress to the monthly target, flag overdue invoices and upcoming renewals, and protect margin. Be precise with numbers and never inflate them.`,
  },
  legal: {
    key: "legal", title: "Head of Legal", emoji: "⚖️", group: "Corporate",
    tagline: "Contracts, NDAs & compliance", owns: ["Contracts", "NDAs", "Proposals T&Cs", "Compliance"],
    grounded: false, autoShift: false,
    persona: `You are the Head of Legal at DigitalVetri (an Indian SMB software vendor). ${COMPANY_CONTEXT} You own contracts, NDAs, proposal terms and India-focused compliance (DPDP, GST invoicing basics, IT/services norms). You explain risk in plain English and suggest safer terms. You are not a substitute for a licensed advocate — say so on anything material.`,
  },
  people: {
    key: "people", title: "Head of People", emoji: "👥", group: "Corporate",
    tagline: "Team, performance & attendance", owns: ["Team", "Performance", "Attendance", "Leave"],
    grounded: true, autoShift: false,
    persona: `You are the Head of People (HR) at DigitalVetri. ${COMPANY_CONTEXT} You own hiring, role design, onboarding and team growth for a small, fast-growing Indian software team. You give practical guidance on when/whom to hire, job posts, interview structure and keeping a lean team effective.`,
  },
};

export const DEPARTMENT_LIST = Object.values(DEPARTMENTS);
export const DEPT_GROUPS: DeptGroup[] = ["Revenue", "Delivery", "Operations", "Corporate"];

// ---------------------------------------------------------------
// Grounding — pull the real CRM data each department reasons over.
// ---------------------------------------------------------------

async function gatherAdvisoryContext(dept: Department): Promise<Record<string, unknown>> {
  const snapshot = await getCommandCenterSnapshot();
  const [activeClients, wonDeals] = await Promise.all([
    prisma.company.count({ where: { relationship: { in: ["ACTIVE", "AMC"] } } }).catch(() => 0),
    prisma.prospect.count({ where: { status: "WON" } }).catch(() => 0),
  ]);
  return {
    role: dept.title,
    advisory: true,
    monthlyTarget: snapshot.monthlyTarget,
    revenueClosedThisMonth: snapshot.revenueClosedThisMonth,
    pipelineValue: snapshot.pipelineValue,
    activeClients,
    totalWonDeals: wonDeals,
    note: "You have limited direct CRM data. Ground your advice in the company's real position above; be explicit about what you're recommending vs. what you'd need data to confirm.",
  };
}

async function gatherDeptContext(key: DeptKey): Promise<Record<string, unknown>> {
  const dept = DEPARTMENTS[key];
  if (!dept.grounded) return gatherAdvisoryContext(dept);

  const snapshot = await getCommandCenterSnapshot();

  if (key === "sales") {
    const [newLeads, qualifiedLeads, pendingDrafts] = await Promise.all([
      prisma.discoveredLead.count({ where: { status: { in: ["NEW", "QUALIFIED"] } } }),
      prisma.discoveredLead.findMany({
        where: { status: { in: ["NEW", "QUALIFIED"] } },
        orderBy: { totalScore: "desc" },
        take: 8,
        select: { name: true, industry: true, city: true, totalScore: true, recommendedService: true },
      }),
      prisma.outreachDraft.count({ where: { status: "DRAFT" } }),
    ]);
    return {
      monthlyTarget: snapshot.monthlyTarget,
      revenueClosedThisMonth: snapshot.revenueClosedThisMonth,
      achievementPct: snapshot.achievementPct,
      pipelineValue: snapshot.pipelineValue,
      newLeadsThisWeek: snapshot.newLeadsThisWeek,
      discoveredLeadsWaiting: newLeads,
      topDiscoveredLeads: qualifiedLeads,
      outreachDraftsPending: pendingDrafts,
      highPriorityLeads: snapshot.highPriorityLeads,
      prospectsNeedingFollowUp: snapshot.prospectsNeedingFollowUp,
      proposalDeadlines: snapshot.proposalDeadlines,
    };
  }

  if (key === "marketing") {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [inboundThisWeek, intentThisWeek, contentRecently, adConnections] = await Promise.all([
      prisma.discoveredLead.count({ where: { source: "INBOUND", createdAt: { gte: weekAgo } } }),
      prisma.discoveredLead.count({ where: { source: "INTENT", createdAt: { gte: weekAgo } } }),
      prisma.generatedContent.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
      prisma.adConnection.count().catch(() => 0),
    ]);
    return {
      monthlyTarget: snapshot.monthlyTarget,
      revenueClosedThisMonth: snapshot.revenueClosedThisMonth,
      inboundEnquiriesThisWeek: inboundThisWeek,
      buyerIntentLeadsThisWeek: intentThisWeek,
      contentPiecesGeneratedToday: contentRecently,
      connectedAdAccounts: adConnections,
      topDiscoveredLeads: snapshot.highPriorityLeads.slice(0, 5),
    };
  }

  if (key === "finance") {
    const [rev, recurring, renewals] = await Promise.all([
      getRevenueSummary(),
      getRecurringSnapshot(),
      getRenewalsDue(45),
    ]);
    return {
      monthlyTarget: snapshot.monthlyTarget,
      revenueClosedThisMonth: snapshot.revenueClosedThisMonth,
      achievementPct: snapshot.achievementPct,
      monthRevenueLedger: rev.monthRevenue,
      monthProfit: rev.monthProfit,
      outstandingInvoices: rev.outstanding,
      mrr: recurring.mrr,
      arr: recurring.arr,
      activeContracts: recurring.activeContracts,
      renewalsDue: renewals.map((r) => ({ company: r.companyName, renewalDate: r.renewalDate, amount: r.recurringAmount, overdue: r.overdue })),
      pipelineValue: snapshot.pipelineValue,
    };
  }

  if (key === "people") {
    const t = await getTeamOverview();
    return {
      headcount: t.headcount,
      activeProjects: t.activeProjects,
      pendingLeaveRequests: t.pendingLeave,
      attendanceRatePct: t.attendanceRate,
      avgPerformanceRating: t.avgRating,
      reviewsLast60Days: t.reviewCount,
    };
  }

  if (key === "customer-success") {
    const [recurring, renewals, activeClients] = await Promise.all([
      getRecurringSnapshot(),
      getRenewalsDue(60),
      prisma.company.count({ where: { relationship: { in: ["ACTIVE", "AMC"] } } }).catch(() => 0),
    ]);
    return {
      activeClients,
      mrr: recurring.mrr,
      arr: recurring.arr,
      activeContracts: recurring.activeContracts,
      renewalsDue: renewals.map((r) => ({ company: r.companyName, renewalDate: r.renewalDate, amount: r.recurringAmount, overdue: r.overdue })),
      missedFollowUps: snapshot.missedFollowUps,
    };
  }

  // operations
  const [openTasks, meetingsToday] = await Promise.all([
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.meeting.count({ where: { scheduledAt: { gte: istStartOfDay(), lte: istEndOfDay() }, status: "SCHEDULED" } }),
  ]);
  const opsRenewals = await getRenewalsDue(30);
  return {
    followUpsPending: snapshot.followUpsPending,
    missedFollowUps: snapshot.missedFollowUps,
    openTasks,
    meetingsToday,
    prospectsNeedingFollowUp: snapshot.prospectsNeedingFollowUp,
    renewalsDue: opsRenewals.map((r) => ({ company: r.companyName, renewalDate: r.renewalDate, overdue: r.overdue })),
  };
}

// ---------------------------------------------------------------
// Chat — talk to a department head, grounded in its data.
// ---------------------------------------------------------------

export async function askDepartment(key: DeptKey, question: string): Promise<string> {
  const dept = DEPARTMENTS[key];
  const context = await gatherDeptContext(key);
  return generateText(
    `Your department's live data (real CRM figures):\n${JSON.stringify(context, null, 2)}\n\nThe founder asks you: "${question}"\n\nAnswer as the ${dept.title} — direct, specific, grounded in the data above, revenue-first. Reference real names and numbers where you have them; be honest where you don't. Keep it under 170 words.`,
    { system: dept.persona, temperature: 0.5 }
  );
}

// ---------------------------------------------------------------
// Shift — the daily report each department files to the CEO.
// ---------------------------------------------------------------

export interface DeptReport {
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  actions: { action: string; why: string }[];
  risks: string[];
}

const deptReportSchema = z.object({
  headline: z.string().catch(""),
  summary: z.string().catch(""),
  metrics: z.array(z.object({ label: z.string().catch(""), value: z.string().catch("") })).catch([]),
  actions: z.array(z.object({ action: z.string().catch(""), why: z.string().catch("") })).catch([]),
  risks: z.array(z.string()).catch([]),
});

export async function generateDeptReport(key: DeptKey): Promise<DeptReport> {
  const dept = DEPARTMENTS[key];
  const context = await gatherDeptContext(key);
  const metricsGuidance = dept.grounded
    ? `- "metrics": 3-5 key numbers as { "label", "value" } (pull real figures; format money as ₹).`
    : `- "metrics": only include numbers you can ground in the data above (0-3); prefer an empty array over invented figures.`;
  return generateJSON(
    `File your daily shift report as the ${dept.title}. Analyse your department's data below and report to the CEO.

Your department's data:
${JSON.stringify(context, null, 2)}

Produce:
- "headline": one punchy line on your department's state today.
- "summary": 2-4 sentences — what's happening, what matters${dept.grounded ? "" : " (as an advisory function, focus on the plan and priorities)"}.
${metricsGuidance}
- "actions": 2-4 concrete moves for today as { "action", "why" }, revenue-first, referencing real names/numbers where available.
- "risks": 0-3 watch-items (empty array if none).`,
    `{ "headline": string, "summary": string, "metrics": [{ "label": string, "value": string }], "actions": [{ "action": string, "why": string }], "risks": string[] }`,
    { system: dept.persona, temperature: 0.4, maxTokens: 1800 },
    deptReportSchema
  );
}

/** Run one department's shift and persist the report as an AgentRun. */
export async function runDepartmentShift(key: DeptKey): Promise<DeptReport> {
  const dept = DEPARTMENTS[key];
  const report = await generateDeptReport(key);
  await prisma.agentRun.create({
    data: {
      type: `dept:${key}`,
      status: "SUCCESS",
      summary: `${report.headline}\n\n${report.summary}`,
      data: { deptKey: key, deptTitle: dept.title, report } as object,
    },
  });
  return report;
}

export interface StoredDeptReport {
  deptKey: DeptKey;
  deptTitle: string;
  report: DeptReport;
  createdAt: string; // ISO
}

/** The most recent shift report for each department (for the org-chart UI + CEO rollup). */
export async function getLatestDeptReports(): Promise<StoredDeptReport[]> {
  const rows = await prisma.agentRun.findMany({
    where: { type: { in: DEPARTMENT_LIST.map((d) => `dept:${d.key}`) } },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const out: StoredDeptReport[] = [];
  for (const row of rows) {
    const d = (row.data ?? {}) as { deptKey?: DeptKey; deptTitle?: string; report?: DeptReport };
    if (!d.deptKey || !d.report || seen.has(d.deptKey)) continue;
    seen.add(d.deptKey);
    out.push({
      deptKey: d.deptKey,
      deptTitle: d.deptTitle ?? DEPARTMENTS[d.deptKey]?.title ?? d.deptKey,
      report: d.report,
      createdAt: row.createdAt.toISOString(),
    });
  }
  return out;
}
