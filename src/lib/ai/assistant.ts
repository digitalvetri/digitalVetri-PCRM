import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateJSON, generateText } from "@/lib/ai/provider";
import { CEO_OS_SYSTEM } from "@/lib/ai/ceo-os";
import { getCommandCenterSnapshot, targetFunnel } from "@/lib/command-center";
import { getLatestDeptReports } from "@/lib/ai/departments";
import { formatINR } from "@/lib/utils";

/**
 * The AI assistant answers questions by first classifying intent + extracting
 * structured filters, then running a safe, parameterised Prisma query, then
 * summarising the rows. This keeps the AI away from raw SQL while still
 * feeling conversational.
 */

interface AssistantPlan {
  intent:
    | "top_crm_potential"
    | "top_automation_potential"
    | "filter_companies"
    | "followups_due"
    | "generate_proposal"
    | "generate_questions"
    | "pipeline_summary"
    | "unknown";
  industry?: string | null;
  city?: string | null;
  minEmployees?: number | null;
  maxEmployees?: number | null;
  grade?: string | null;
  companyName?: string | null;
  limit?: number | null;
}

const PLAN_SCHEMA = `{
  "intent": "top_crm_potential"|"top_automation_potential"|"filter_companies"|"followups_due"|"generate_proposal"|"generate_questions"|"pipeline_summary"|"unknown",
  "industry": string|null,
  "city": string|null,
  "minEmployees": number|null,
  "maxEmployees": number|null,
  "grade": "A_PLUS"|"A"|"B"|"C"|null,
  "companyName": string|null,
  "limit": number|null
}`;

// Validate/normalize the classifier output: an unrecognized intent falls back
// to "unknown" (the safe open-ended branch) instead of mis-routing.
const planSchema = z.object({
  intent: z
    .enum([
      "top_crm_potential",
      "top_automation_potential",
      "filter_companies",
      "followups_due",
      "generate_proposal",
      "generate_questions",
      "pipeline_summary",
      "unknown",
    ])
    .catch("unknown"),
  industry: z.string().nullable().catch(null),
  city: z.string().nullable().catch(null),
  minEmployees: z.coerce.number().nullable().catch(null),
  maxEmployees: z.coerce.number().nullable().catch(null),
  grade: z.enum(["A_PLUS", "A", "B", "C"]).nullable().catch(null),
  companyName: z.string().nullable().catch(null),
  limit: z.coerce.number().nullable().catch(null),
});

export interface AssistantResult {
  answer: string;
  data?: unknown;
  action?: { type: "navigate"; href: string; label: string };
}

export type AssistantLang = "en" | "ta";

/**
 * The fast, single-call CEO answer used by the voice path (no intent
 * classification round-trip — straight to a grounded answer). Answers in the
 * requested language.
 */
export async function answerAsCeo(question: string, lang: AssistantLang = "en"): Promise<string> {
  const [snapshot, deptReports] = await Promise.all([
    getCommandCenterSnapshot(),
    getLatestDeptReports(),
  ]);
  const funnel = targetFunnel(snapshot.monthlyTarget, snapshot.revenueClosedThisMonth);
  const teamReports = deptReports.map((r) => ({
    department: r.deptTitle,
    headline: r.report.headline,
    risks: r.report.risks,
  }));
  const languageLine =
    lang === "ta"
      ? "REPLY ENTIRELY IN TAMIL (தமிழ்) using Tamil script. Keep money like ₹5,00,000 and company names as-is. Sound natural and spoken, like talking to the boss."
      : "Reply in clear, confident English.";
  return generateText(
    `Live business snapshot (real data):\n${JSON.stringify(snapshot)}\n\nTarget → activity math (what it takes to hit the monthly target, if set):\n${JSON.stringify(funnel ?? "no target set")}\n\nYour department heads' latest reports:\n${JSON.stringify(teamReports)}\n\nThe boss asks: "${question}"\n\nAnswer as Vetri — the founder's AI CEO. Direct, specific, revenue-first, grounded in the real data above. If they ask HOW TO REACH a revenue number, give the concrete leads→meetings→proposals→deals math and name specific prospects. End with a short numbered action plan (2-4 steps). ${languageLine} Keep it under 180 words.`,
    { system: CEO_OS_SYSTEM, temperature: 0.5 }
  );
}

export async function askAssistant(question: string, lang: AssistantLang = "en"): Promise<AssistantResult> {
  const plan = await generateJSON<AssistantPlan>(
    `Classify this sales-assistant question into an intent and extract filters. Question: "${question}"`,
    PLAN_SCHEMA,
    { temperature: 0.1 },
    planSchema
  );

  switch (plan.intent) {
    case "top_crm_potential":
      return topByScore("crmOpportunityScore", "CRM", plan.limit ?? 5);
    case "top_automation_potential":
      return topByScore("automationScore", "automation", plan.limit ?? 5);
    case "filter_companies":
      return filterCompanies(plan);
    case "followups_due":
      return followUpsDue();
    case "pipeline_summary":
      return pipelineSummary();
    case "generate_proposal":
      return findCompanyForAction(plan.companyName, "proposals", "Open Proposal Generator");
    case "generate_questions":
      return findCompanyForAction(plan.companyName, "meetings", "Open Discovery Meetings");
    default: {
      // Open-ended questions get the full CEO OS persona, grounded in the live
      // snapshot + department reports + target→activity math (see answerAsCeo).
      const answer = await answerAsCeo(question, lang);
      return {
        answer,
        action: { type: "navigate", href: "/command-center", label: "Open Command Center" },
      };
    }
  }
}

async function topByScore(
  field: "crmOpportunityScore" | "automationScore",
  label: string,
  limit: number
): Promise<AssistantResult> {
  const rows = await prisma.companyAnalysis.findMany({
    orderBy: { [field]: "desc" },
    take: limit,
    include: { company: true },
  });
  if (rows.length === 0) return { answer: "No analysed companies yet. Import and analyse companies first." };
  const list = rows
    .map((r, i) => `${i + 1}. ${r.company.name} — ${label} score ${r[field]}/100 (${r.company.city ?? "—"}, ${r.company.industry ?? "—"})`)
    .join("\n");
  return {
    answer: `Top ${rows.length} companies by ${label} potential:\n\n${list}`,
    data: rows.map((r) => ({ id: r.companyId, name: r.company.name, score: r[field] })),
    action: { type: "navigate", href: "/companies", label: `View top ${label} companies` },
  };
}

async function filterCompanies(plan: AssistantPlan): Promise<AssistantResult> {
  const companies = await prisma.company.findMany({
    where: {
      industry: plan.industry ? { contains: plan.industry, mode: "insensitive" } : undefined,
      city: plan.city ? { contains: plan.city, mode: "insensitive" } : undefined,
      employeeEstimate: {
        gte: plan.minEmployees ?? undefined,
        lte: plan.maxEmployees ?? undefined,
      },
      analysis: plan.grade ? { leadGrade: plan.grade as never } : undefined,
    },
    include: { analysis: true },
    take: plan.limit ?? 15,
    orderBy: { analysis: { leadScore: "desc" } },
  });
  if (companies.length === 0) return { answer: "No companies match those criteria." };
  const list = companies
    .map(
      (c) =>
        `• ${c.name} — ${c.industry ?? "—"}, ${c.city ?? "—"}, ~${c.employeeEstimate ?? "?"} emp${
          c.analysis ? `, grade ${c.analysis.leadGrade.replace("_PLUS", "+")}` : ""
        }`
    )
    .join("\n");
  return {
    answer: `Found ${companies.length} matching companies:\n\n${list}`,
    data: companies.map((c) => ({ id: c.id, name: c.name })),
    action: { type: "navigate", href: "/companies", label: "View in Companies" },
  };
}

async function followUpsDue(): Promise<AssistantResult> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const followUps = await prisma.followUp.findMany({
    where: { status: "PENDING", dueAt: { lte: end } },
    include: { prospect: { include: { company: true } }, user: true },
    orderBy: { dueAt: "asc" },
    take: 20,
  });
  if (followUps.length === 0) return { answer: "No follow-ups are due today. You're all caught up! 🎉" };
  const list = followUps
    .map((f) => `• ${f.prospect.company.name} — ${f.channel.toLowerCase()} (${f.user.name})`)
    .join("\n");
  return {
    answer: `${followUps.length} follow-up(s) due today or overdue:\n\n${list}`,
    action: { type: "navigate", href: "/follow-ups", label: "Open Follow-up Manager" },
  };
}

async function pipelineSummary(): Promise<AssistantResult> {
  const prospects = await prisma.prospect.findMany({ where: { status: { notIn: ["LOST", "DISQUALIFIED"] } } });
  const value = prospects.reduce((s, p) => s + (p.proposalValue ?? 0), 0);
  const weighted = prospects.reduce((s, p) => s + (p.proposalValue ?? 0) * ((p.probability ?? 0) / 100), 0);
  return {
    answer: `Active pipeline: ${prospects.length} prospects, total value ${formatINR(value, true)}, weighted (expected) ${formatINR(weighted, true)}.`,
    action: { type: "navigate", href: "/reports", label: "Open Reports" },
  };
}

async function findCompanyForAction(
  name: string | null | undefined,
  module: string,
  label: string
): Promise<AssistantResult> {
  if (!name) {
    return { answer: `Which company? Open the ${label} and pick a company.`, action: { type: "navigate", href: `/${module}`, label } };
  }
  const company = await prisma.company.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
  });
  if (!company) {
    return { answer: `I couldn't find a company matching "${name}". Try importing it first.`, action: { type: "navigate", href: "/companies", label: "Go to Companies" } };
  }
  return {
    answer: `Found ${company.name}. Opening the ${module} tool where you can generate it.`,
    action: { type: "navigate", href: `/${module}?companyId=${company.id}`, label },
  };
}
