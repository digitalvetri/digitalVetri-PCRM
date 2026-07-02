import { prisma } from "@/lib/prisma";

/** Dashboard KPI aggregation. */
export async function getDashboardStats() {
  const [
    totalCompanies,
    qualifiedCompanies,
    aPlusLeads,
    aLeads,
    meetings,
    proposals,
    wonProspects,
    activeProspects,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.prospect.count({ where: { status: { in: ["QUALIFIED", "CONTACTED", "MEETING_SCHEDULED", "MEETING_DONE", "PROPOSAL_SENT", "NEGOTIATION", "WON"] } } }),
    prisma.companyAnalysis.count({ where: { leadGrade: "A_PLUS" } }),
    prisma.companyAnalysis.count({ where: { leadGrade: "A" } }),
    prisma.meeting.count(),
    prisma.proposal.count(),
    prisma.prospect.findMany({ where: { status: "WON" } }),
    prisma.prospect.findMany({ where: { status: { notIn: ["LOST", "DISQUALIFIED", "WON"] } } }),
  ]);

  const closedDeals = wonProspects.length;
  const monthlyRevenue = wonProspects
    .filter((p) => {
      const d = p.expectedCloseDate ?? p.updatedAt;
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, p) => s + (p.proposalValue ?? 0), 0);

  const pipelineValue = activeProspects.reduce((s, p) => s + (p.proposalValue ?? 0), 0);
  const expectedRevenue = activeProspects.reduce(
    (s, p) => s + (p.proposalValue ?? 0) * ((p.probability ?? 0) / 100),
    0
  );

  return {
    totalCompanies,
    qualifiedCompanies,
    aPlusLeads,
    aLeads,
    meetings,
    proposals,
    closedDeals,
    pipelineValue,
    expectedRevenue,
    monthlyRevenue,
    wonValue: wonProspects.reduce((s, p) => s + (p.proposalValue ?? 0), 0),
  };
}

export async function getIndustryDistribution() {
  const rows = await prisma.company.groupBy({
    by: ["industry"],
    _count: { _all: true },
    orderBy: { _count: { industry: "desc" } },
    take: 8,
  });
  return rows
    .filter((r) => r.industry)
    .map((r) => ({ name: r.industry as string, value: r._count._all }));
}

export async function getCityDistribution() {
  const rows = await prisma.company.groupBy({
    by: ["city"],
    _count: { _all: true },
    orderBy: { _count: { city: "desc" } },
    take: 8,
  });
  return rows.filter((r) => r.city).map((r) => ({ name: r.city as string, value: r._count._all }));
}

export async function getLeadScoreDistribution() {
  const analyses = await prisma.companyAnalysis.findMany({ select: { leadScore: true } });
  const buckets = [
    { name: "0-49 (C)", min: 0, max: 49, value: 0 },
    { name: "50-69 (B)", min: 50, max: 69, value: 0 },
    { name: "70-84 (A)", min: 70, max: 84, value: 0 },
    { name: "85-100 (A+)", min: 85, max: 100, value: 0 },
  ];
  for (const a of analyses) {
    const b = buckets.find((x) => a.leadScore >= x.min && a.leadScore <= x.max);
    if (b) b.value++;
  }
  return buckets.map(({ name, value }) => ({ name, value }));
}

export async function getSalesFunnel() {
  const [total, qualified, contacted, meeting, proposal, negotiation, won] = await Promise.all([
    prisma.company.count(),
    prisma.prospect.count({ where: { status: { in: ["QUALIFIED", "CONTACTED", "MEETING_SCHEDULED", "MEETING_DONE", "PROPOSAL_SENT", "NEGOTIATION", "WON"] } } }),
    prisma.prospect.count({ where: { status: { in: ["CONTACTED", "MEETING_SCHEDULED", "MEETING_DONE", "PROPOSAL_SENT", "NEGOTIATION", "WON"] } } }),
    prisma.prospect.count({ where: { status: { in: ["MEETING_SCHEDULED", "MEETING_DONE", "PROPOSAL_SENT", "NEGOTIATION", "WON"] } } }),
    prisma.prospect.count({ where: { status: { in: ["PROPOSAL_SENT", "NEGOTIATION", "WON"] } } }),
    prisma.prospect.count({ where: { status: { in: ["NEGOTIATION", "WON"] } } }),
    prisma.prospect.count({ where: { status: "WON" } }),
  ]);
  return [
    { name: "Total Companies", value: total },
    { name: "Qualified", value: qualified },
    { name: "Contacted", value: contacted },
    { name: "Meeting", value: meeting },
    { name: "Proposal", value: proposal },
    { name: "Negotiation", value: negotiation },
    { name: "Won", value: won },
  ].filter((s) => s.value > 0 || s.name === "Total Companies");
}

export async function getOpportunityAverages() {
  const agg = await prisma.companyAnalysis.aggregate({
    _avg: {
      crmOpportunityScore: true,
      automationScore: true,
      erpOpportunityScore: true,
      aiOpportunityScore: true,
      digitalMaturityScore: true,
    },
  });
  return {
    crm: Math.round(agg._avg.crmOpportunityScore ?? 0),
    automation: Math.round(agg._avg.automationScore ?? 0),
    erp: Math.round(agg._avg.erpOpportunityScore ?? 0),
    ai: Math.round(agg._avg.aiOpportunityScore ?? 0),
    digital: Math.round(agg._avg.digitalMaturityScore ?? 0),
  };
}

export async function getRecentActivities(limit = 12) {
  return prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: true, company: true },
  });
}

/** Monthly revenue forecast for the reports/analytics pages (last 6 + next 3 months). */
export async function getRevenueForecast() {
  const prospects = await prisma.prospect.findMany({
    where: { status: { notIn: ["LOST", "DISQUALIFIED"] }, expectedCloseDate: { not: null } },
  });
  const months: { name: string; won: number; forecast: number }[] = [];
  const now = new Date();
  for (let i = -5; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    let won = 0;
    let forecast = 0;
    for (const p of prospects) {
      const cd = p.expectedCloseDate!;
      if (cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()) {
        if (p.status === "WON") won += p.proposalValue ?? 0;
        else forecast += (p.proposalValue ?? 0) * ((p.probability ?? 0) / 100);
      }
    }
    months.push({ name: label, won: Math.round(won), forecast: Math.round(forecast) });
  }
  return months;
}

export async function getLeadSourceAnalysis() {
  const rows = await prisma.company.groupBy({
    by: ["importSource"],
    _count: { _all: true },
  });
  return rows.map((r) => ({ name: labelSource(r.importSource), value: r._count._all }));
}

function labelSource(s: string): string {
  const map: Record<string, string> = {
    MANUAL: "Manual Entry",
    EXCEL: "Excel",
    CSV: "CSV",
    GOOGLE_MAPS: "Google Maps",
    LINKEDIN: "LinkedIn",
    WEBSITE: "Website",
  };
  return map[s] ?? s;
}
