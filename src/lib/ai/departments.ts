/**
 * The AI Company — department "heads" that report to the AI CEO.
 *
 * Each department is an LLM persona grounded in real CRM data. It can be
 * chatted with (askDepartment) and runs a daily "shift" (runDepartmentShift)
 * that files a structured report. Reports are stored as AgentRun rows keyed
 * `dept:<key>` and roll up into the CEO's morning briefing.
 *
 * Adding a new department later = one entry in DEPARTMENTS + a gather() case.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateJSON, generateText } from "@/lib/ai/provider";
import { getCommandCenterSnapshot } from "@/lib/command-center";
import { getRevenueSummary } from "@/lib/revenue";
import { getRecurringSnapshot, getRenewalsDue } from "@/lib/recurring";
import { istEndOfDay, istStartOfDay } from "@/lib/time";

export type DeptKey = "sales" | "marketing" | "finance" | "operations";

export interface Department {
  key: DeptKey;
  title: string; // "Head of Sales"
  emoji: string;
  tagline: string;
  owns: string[]; // app areas this department is responsible for
  persona: string; // system-prompt persona
}

const COMPANY_CONTEXT = `DigitalVetri is an Indian software company (Tamil Nadu, expanding pan-India) selling Custom CRM Development, AI Automation, Website/SaaS/ERP Development, WhatsApp Automation and Mobile Apps to SMBs. All money is in INR. Never fabricate data or contacts; use only the real data provided; clearly label estimates.`;

export const DEPARTMENTS: Record<DeptKey, Department> = {
  sales: {
    key: "sales",
    title: "Head of Sales",
    emoji: "🎯",
    tagline: "Leads, outreach & closing the pipeline",
    owns: ["Lead Radar", "Outreach", "Prospects", "Proposals"],
    persona: `You are the Head of Sales at DigitalVetri. ${COMPANY_CONTEXT} You own lead discovery, outreach, the deal pipeline and closing. You are relentless about revenue: qualified leads, meetings booked, proposals moved forward, deals closed. You flag deals going cold and name the specific prospects to chase today.`,
  },
  marketing: {
    key: "marketing",
    title: "Head of Marketing",
    emoji: "📣",
    tagline: "Content, ads & inbound demand",
    owns: ["Content", "Ads", "Enquiry funnel", "SEO pages"],
    persona: `You are the Head of Marketing at DigitalVetri. ${COMPANY_CONTEXT} You own content, social, paid ads and the inbound enquiry funnel. Your job is to generate demand and qualified inbound leads at low cost. You recommend specific posts, campaigns and offers tied to what is actually selling.`,
  },
  finance: {
    key: "finance",
    title: "Head of Finance",
    emoji: "💰",
    tagline: "Revenue, profit, cash & recurring",
    owns: ["Revenue ledger", "MRR/ARR", "Outstanding invoices", "Renewals"],
    persona: `You are the Head of Finance at DigitalVetri. ${COMPANY_CONTEXT} You own revenue, profit, cash collection and recurring income (MRR/ARR). You track progress to the monthly target, flag overdue invoices and upcoming renewals, and protect margin. You are precise with numbers and never inflate them.`,
  },
  operations: {
    key: "operations",
    title: "Head of Operations",
    emoji: "⚙️",
    tagline: "Follow-ups, tasks & delivery health",
    owns: ["Follow-ups", "Tasks", "Meetings", "Nurture"],
    persona: `You are the Head of Operations at DigitalVetri. ${COMPANY_CONTEXT} You own execution: follow-ups, tasks, meetings and client-delivery health. Your job is that nothing slips — no missed follow-up, no stalled task, no forgotten client. You surface what is overdue and who must act.`,
  },
};

export const DEPARTMENT_LIST = Object.values(DEPARTMENTS);

// ---------------------------------------------------------------
// Grounding — pull the real CRM data each department reasons over.
// ---------------------------------------------------------------

async function gatherDeptContext(key: DeptKey): Promise<Record<string, unknown>> {
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
      renewalsDue: renewals.map((r) => ({
        company: r.companyName,
        renewalDate: r.renewalDate,
        amount: r.recurringAmount,
        overdue: r.overdue,
      })),
      pipelineValue: snapshot.pipelineValue,
    };
  }

  // operations
  const [openTasks, meetingsToday] = await Promise.all([
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.meeting.count({
      where: { scheduledAt: { gte: istStartOfDay(), lte: istEndOfDay() }, status: "SCHEDULED" },
    }),
  ]);
  const renewals = await getRenewalsDue(30);
  return {
    followUpsPending: snapshot.followUpsPending,
    missedFollowUps: snapshot.missedFollowUps,
    openTasks,
    meetingsToday,
    prospectsNeedingFollowUp: snapshot.prospectsNeedingFollowUp,
    renewalsDue: renewals.map((r) => ({ company: r.companyName, renewalDate: r.renewalDate, overdue: r.overdue })),
  };
}

// ---------------------------------------------------------------
// Chat — talk to a department head, grounded in its data.
// ---------------------------------------------------------------

export async function askDepartment(key: DeptKey, question: string): Promise<string> {
  const dept = DEPARTMENTS[key];
  const context = await gatherDeptContext(key);
  return generateText(
    `Your department's live data (real CRM figures):\n${JSON.stringify(context, null, 2)}\n\nThe founder asks you: "${question}"\n\nAnswer as the ${dept.title} — direct, specific, grounded in the data above, revenue-first. Reference real names and numbers. Keep it under 160 words.`,
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
  metrics: z
    .array(z.object({ label: z.string().catch(""), value: z.string().catch("") }))
    .catch([]),
  actions: z
    .array(z.object({ action: z.string().catch(""), why: z.string().catch("") }))
    .catch([]),
  risks: z.array(z.string()).catch([]),
});

export async function generateDeptReport(key: DeptKey): Promise<DeptReport> {
  const dept = DEPARTMENTS[key];
  const context = await gatherDeptContext(key);
  return generateJSON(
    `File your daily shift report as the ${dept.title}. Analyse your department's real data below and report to the CEO.

Your department's live data:
${JSON.stringify(context, null, 2)}

Produce:
- "headline": one punchy line on your department's state today.
- "summary": 2-4 sentences — what's happening, what changed, what matters.
- "metrics": 3-5 key numbers as { "label", "value" } (pull real figures; format money as ₹).
- "actions": 2-4 concrete moves for today as { "action", "why" }, revenue-first, referencing real names/numbers.
- "risks": 0-3 watch-items from the data (empty array if none).`,
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
  const out: StoredDeptReport[] = [];
  for (const dept of DEPARTMENT_LIST) {
    const row = await prisma.agentRun.findFirst({
      where: { type: `dept:${dept.key}` },
      orderBy: { createdAt: "desc" },
    });
    if (!row?.data) continue;
    const d = row.data as { deptKey?: DeptKey; deptTitle?: string; report?: DeptReport };
    if (!d.report) continue;
    out.push({
      deptKey: dept.key,
      deptTitle: d.deptTitle ?? dept.title,
      report: d.report,
      createdAt: row.createdAt.toISOString(),
    });
  }
  return out;
}
