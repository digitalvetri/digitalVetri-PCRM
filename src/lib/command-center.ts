import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/settings";
import { istStartOfDay, istEndOfDay, istStartOfMonth } from "@/lib/time";

/** Normalise a date to local midnight (DailyPlan is keyed per day). */
export function dayStart(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Live pipeline snapshot used by the CEO dashboard and passed as grounding
 * context to the daily planner / EOD review so the AI references real
 * prospects instead of inventing work.
 */
export async function getCommandCenterSnapshot() {
  const now = new Date();
  const todayStart = istStartOfDay();
  const todayEnd = istEndOfDay();
  const monthStart = istStartOfMonth();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const soon = new Date(now.getTime() + 7 * 86400000);

  const [
    settings,
    wonThisMonth,
    activeProspects,
    meetingsToday,
    followUpsPending,
    missedFollowUps,
    newLeadsThisWeek,
    highPriorityLeads,
    proposalDeadlines,
    openTasks,
  ] = await Promise.all([
    loadSettings(),
    prisma.prospect.findMany({
      where: { status: "WON", wonAt: { gte: monthStart } },
      select: { proposalValue: true },
    }),
    prisma.prospect.findMany({
      where: { status: { notIn: ["WON", "LOST", "DISQUALIFIED"] } },
      include: { company: { select: { name: true, industry: true, city: true } } },
      orderBy: { nextFollowUpDate: "asc" },
    }),
    prisma.meeting.count({
      where: { scheduledAt: { gte: todayStart, lte: todayEnd }, status: "SCHEDULED" },
    }),
    prisma.followUp.count({ where: { status: "PENDING", dueAt: { lte: todayEnd } } }),
    prisma.followUp.count({ where: { status: "PENDING", dueAt: { lt: todayStart } } }),
    prisma.company.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.companyAnalysis.findMany({
      where: { leadGrade: { in: ["A_PLUS", "A"] } },
      include: { company: { select: { name: true, city: true, industry: true, prospect: { select: { status: true } } } } },
      orderBy: { leadScore: "desc" },
      take: 10,
    }),
    prisma.proposal.findMany({
      where: { status: { in: ["SENT", "VIEWED", "UNDER_DISCUSSION"] }, validUntil: { lte: soon } },
      include: { company: { select: { name: true } } },
    }),
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] } } }),
  ]);

  const revenueClosedThisMonth = wonThisMonth.reduce((s, p) => s + (p.proposalValue ?? 0), 0);
  const pipelineValue = activeProspects.reduce((s, p) => s + (p.proposalValue ?? 0), 0);
  const monthlyTarget = settings.monthlyRevenueTarget;

  return {
    monthlyTarget,
    revenueClosedThisMonth,
    achievementPct: monthlyTarget ? Math.round((revenueClosedThisMonth / monthlyTarget) * 100) : null,
    pipelineValue,
    meetingsToday,
    followUpsPending,
    missedFollowUps,
    newLeadsThisWeek,
    openTasks,
    highPriorityLeads: highPriorityLeads.map((a) => ({
      name: a.company.name,
      grade: a.leadGrade,
      score: a.leadScore,
      city: a.company.city,
      industry: a.company.industry,
      status: a.company.prospect?.status ?? "NOT_A_PROSPECT_YET",
    })),
    proposalDeadlines: proposalDeadlines.map((p) => ({
      company: p.company.name,
      proposalNo: p.proposalNo,
      value: p.totalValue,
      validUntil: p.validUntil,
      status: p.status,
    })),
    prospectsNeedingFollowUp: activeProspects
      .filter((p) => p.nextFollowUpDate && p.nextFollowUpDate <= todayEnd)
      .slice(0, 10)
      .map((p) => ({ name: p.company.name, status: p.status, due: p.nextFollowUpDate })),
  };
}

export type CommandCenterSnapshot = Awaited<ReturnType<typeof getCommandCenterSnapshot>>;

// ---------------------------------------------------------------
// Target → funnel math: what it takes to hit the monthly target.
// Uses configurable B2B defaults (the pipeline is too small to derive
// reliable conversion rates yet — these can be tuned in Settings later).
// ---------------------------------------------------------------

export interface FunnelAssumptions {
  avgDealValue: number; // ₹ per closed deal
  winRate: number; // proposals → won
  meetingToProposal: number; // meetings → proposal
  outreachToMeeting: number; // outreach → meeting
}

export const DEFAULT_FUNNEL: FunnelAssumptions = {
  avgDealValue: 150_000,
  winRate: 0.25,
  meetingToProposal: 0.5,
  outreachToMeeting: 0.15,
};

export interface TargetFunnel {
  remaining: number;
  deals: number;
  proposals: number;
  meetings: number;
  outreach: number;
  leads: number;
  assumptions: FunnelAssumptions;
}

/** Reverse-engineer the activity needed to close the remaining target. */
export function targetFunnel(
  target: number | null | undefined,
  closedThisMonth: number,
  a: FunnelAssumptions = DEFAULT_FUNNEL
): TargetFunnel | null {
  if (!target || target <= 0) return null;
  const remaining = Math.max(0, target - closedThisMonth);
  // Guard every rate/divisor: a 0 (or missing) conversion rate must not yield
  // Infinity/NaN required-leads. A non-positive rate means "unknown", so the
  // stage passes its count through unchanged rather than exploding.
  const div = (n: number, rate: number) => (rate > 0 ? Math.ceil(n / rate) : n);
  const deals = div(remaining, a.avgDealValue);
  const proposals = div(deals, a.winRate);
  const meetings = div(proposals, a.meetingToProposal);
  const outreach = div(meetings, a.outreachToMeeting);
  return { remaining, deals, proposals, meetings, outreach, leads: outreach, assumptions: a };
}
