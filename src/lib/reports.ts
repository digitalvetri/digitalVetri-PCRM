import type { ProspectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Prospect statuses that count as "active pipeline" (mirrors getDashboardStats). */
const ACTIVE_STATUSES: ProspectStatus[] = [
  "QUALIFIED",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "MEETING_DONE",
  "PROPOSAL_SENT",
  "NEGOTIATION",
];

/** Statuses that represent a genuine, still-open pipeline stage (excludes terminal/lost states). */
const OPEN_PIPELINE_STATUSES: ProspectStatus[] = [
  "NEW",
  "RESEARCHING",
  "QUALIFIED",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "MEETING_DONE",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "ON_HOLD",
];

/** Proposal status counts + conversion rate (ACCEPTED / total sent). */
export async function getProposalConversion() {
  const grouped = await prisma.proposal.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const byStatus = grouped.map((g) => ({ name: g.status, value: g._count._all }));
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));

  // "Sent" = anything that has left DRAFT and reached a prospect.
  const sent =
    (counts.SENT ?? 0) +
    (counts.VIEWED ?? 0) +
    (counts.UNDER_DISCUSSION ?? 0) +
    (counts.ACCEPTED ?? 0) +
    (counts.REJECTED ?? 0) +
    (counts.EXPIRED ?? 0);
  const accepted = counts.ACCEPTED ?? 0;
  const conversionRate = sent > 0 ? Math.round((accepted / sent) * 1000) / 10 : 0;

  return {
    byStatus,
    total: grouped.reduce((s, g) => s + g._count._all, 0),
    sent,
    accepted,
    conversionRate, // percent, one decimal
  };
}

/** Per-user (SALES/MANAGER/ADMIN) won count + won value + active pipeline value. */
export async function getSalesPerformance() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["SALES", "MANAGER", "ADMIN"] } },
    orderBy: { name: "asc" },
    include: {
      assignedProspects: {
        select: { status: true, proposalValue: true },
      },
    },
  });

  return users
    .map((u) => {
      let wonCount = 0;
      let wonValue = 0;
      let pipelineValue = 0;
      for (const p of u.assignedProspects) {
        if (p.status === "WON") {
          wonCount++;
          wonValue += p.proposalValue ?? 0;
        } else if (ACTIVE_STATUSES.includes(p.status)) {
          pipelineValue += p.proposalValue ?? 0;
        }
      }
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        wonCount,
        wonValue,
        pipelineValue,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue || b.pipelineValue - a.pipelineValue);
}

/** Last 6 months: count + value of WON prospects by the month they were won (wonAt). */
export async function getMonthlyClosures() {
  const won = await prisma.prospect.findMany({
    where: { status: "WON" },
    select: { proposalValue: true, wonAt: true, updatedAt: true },
  });

  const now = new Date();
  const months: { name: string; count: number; value: number }[] = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    let count = 0;
    let value = 0;
    for (const p of won) {
      // Actual won date; legacy rows without wonAt fall back to updatedAt.
      const cd = p.wonAt ?? p.updatedAt;
      if (cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()) {
        count++;
        value += p.proposalValue ?? 0;
      }
    }
    months.push({ name: label, count, value });
  }
  return months;
}

/** Prospect count + total value grouped by status (excludes LOST/DISQUALIFIED). */
export async function getPipelineByStage() {
  const prospects = await prisma.prospect.findMany({
    where: { status: { in: OPEN_PIPELINE_STATUSES } },
    select: { status: true, proposalValue: true },
  });

  const map = new Map<ProspectStatus, { count: number; value: number }>();
  for (const p of prospects) {
    const entry = map.get(p.status) ?? { count: 0, value: 0 };
    entry.count++;
    entry.value += p.proposalValue ?? 0;
    map.set(p.status, entry);
  }

  const stages = OPEN_PIPELINE_STATUSES.filter((s) => map.has(s)).map((s) => {
    const e = map.get(s)!;
    return { status: s, count: e.count, value: e.value };
  });

  return {
    stages,
    totalValue: stages.reduce((sum, s) => sum + s.value, 0),
    totalCount: stages.reduce((sum, s) => sum + s.count, 0),
  };
}

/** Per-industry company count, avg lead score, total pipeline value. */
export async function getIndustryAnalysis() {
  const companies = await prisma.company.findMany({
    where: { industry: { not: null } },
    select: {
      industry: true,
      analysis: { select: { leadScore: true } },
      prospect: { select: { status: true, proposalValue: true } },
    },
  });

  const map = new Map<
    string,
    { count: number; scoreSum: number; scoreCount: number; pipelineValue: number }
  >();
  for (const c of companies) {
    const key = c.industry as string;
    const entry = map.get(key) ?? { count: 0, scoreSum: 0, scoreCount: 0, pipelineValue: 0 };
    entry.count++;
    if (c.analysis) {
      entry.scoreSum += c.analysis.leadScore;
      entry.scoreCount++;
    }
    if (c.prospect && ACTIVE_STATUSES.includes(c.prospect.status)) {
      entry.pipelineValue += c.prospect.proposalValue ?? 0;
    }
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([industry, e]) => ({
      industry,
      count: e.count,
      avgLeadScore: e.scoreCount > 0 ? Math.round(e.scoreSum / e.scoreCount) : 0,
      pipelineValue: e.pipelineValue,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
