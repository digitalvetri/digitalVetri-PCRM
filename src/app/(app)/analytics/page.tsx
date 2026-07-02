import { Target, IndianRupee, Gauge, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { ScoreBar } from "@/components/shared/score";
import {
  ColumnChart,
  DonutChart,
  VerticalBarChart,
  SalesFunnelChart,
  TrendAreaChart,
} from "@/components/charts/charts";
import { formatINR } from "@/lib/utils";
import { LEAD_GRADES, LEAD_GRADE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  getLeadScoreDistribution,
  getOpportunityAverages,
  getIndustryDistribution,
  getCityDistribution,
  getSalesFunnel,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Grade distribution (A+/A/B/C) as chart data. */
async function getGradeDistribution() {
  const grouped = await prisma.companyAnalysis.groupBy({
    by: ["leadGrade"],
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.leadGrade, g._count._all]));
  return LEAD_GRADES.map((g) => ({ name: LEAD_GRADE_LABELS[g], value: counts[g] ?? 0 }));
}

/** Prospects created per month over the last 6 months. */
async function getProspectsCreatedTrend() {
  const prospects = await prisma.prospect.findMany({ select: { createdAt: true } });
  const now = new Date();
  const months: { name: string; created: number }[] = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const created = prospects.filter(
      (p) => p.createdAt.getMonth() === d.getMonth() && p.createdAt.getFullYear() === d.getFullYear()
    ).length;
    months.push({ name: label, created });
  }
  return months;
}

/** Headline KPIs: conversion rate, avg deal size, avg lead score, win rate. */
async function getAnalyticsKpis() {
  const [total, won, lost, wonAgg, scoreAgg] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: "WON" } }),
    prisma.prospect.count({ where: { status: "LOST" } }),
    prisma.prospect.aggregate({ where: { status: "WON" }, _sum: { proposalValue: true } }),
    prisma.companyAnalysis.aggregate({ _avg: { leadScore: true } }),
  ]);

  const wonValue = wonAgg._sum.proposalValue ?? 0;
  return {
    conversionRate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
    avgDealSize: won > 0 ? wonValue / won : 0,
    avgLeadScore: Math.round(scoreAgg._avg.leadScore ?? 0),
    winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0,
  };
}

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const [kpis, leadScores, opps, industry, city, funnel, grades, trend] = await Promise.all([
    getAnalyticsKpis(),
    getLeadScoreDistribution(),
    getOpportunityAverages(),
    getIndustryDistribution(),
    getCityDistribution(),
    getSalesFunnel(),
    getGradeDistribution(),
    getProspectsCreatedTrend(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Explore your prospect intelligence across scores, stages and geography."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Conversion Rate"
          value={`${kpis.conversionRate}%`}
          icon={Target}
          hint="Won / all prospects"
          accent="primary"
        />
        <StatCard
          index={1}
          label="Avg Deal Size"
          value={formatINR(kpis.avgDealSize, true)}
          icon={IndianRupee}
          hint="Won value / won count"
          accent="success"
        />
        <StatCard
          index={2}
          label="Avg Lead Score"
          value={kpis.avgLeadScore}
          icon={Gauge}
          hint="AI estimate"
          accent="violet"
        />
        <StatCard
          index={3}
          label="Win Rate"
          value={`${kpis.winRate}%`}
          icon={Trophy}
          hint="Won / (won + lost)"
          accent="cyan"
        />
      </div>

      <EstimateNote />

      {/* Prospects trend */}
      <Card>
        <CardHeader>
          <CardTitle>Prospects Created Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendAreaChart
            data={trend}
            dataKeys={[{ key: "created", label: "New Prospects", color: "#4557d6" }]}
          />
        </CardContent>
      </Card>

      {/* Score distribution + opportunity averages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart data={leadScores} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Opportunity Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <ScoreBar label="CRM Opportunity" score={opps.crm} />
            <ScoreBar label="AI Automation" score={opps.automation} />
            <ScoreBar label="ERP Opportunity" score={opps.erp} />
            <ScoreBar label="AI Opportunity" score={opps.ai} />
            <ScoreBar label="Digital Maturity" score={opps.digital} />
            <p className="pt-2 text-xs text-muted-foreground">
              Averaged across all analysed companies (AI estimates).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Industry + city */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Industry Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={industry} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <VerticalBarChart data={city} color="#14b8a6" />
          </CardContent>
        </Card>
      </div>

      {/* Funnel + grades */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesFunnelChart data={funnel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart data={grades} color="#8b5cf6" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
