import Link from "next/link";
import {
  Building2,
  BadgeCheck,
  Crown,
  Star,
  CalendarClock,
  FileText,
  Trophy,
  Wallet,
  TrendingUp,
  IndianRupee,
  Repeat,
  BellRing,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstimateNote } from "@/components/shared/confidence-badge";
import {
  DonutChart,
  ColumnChart,
  VerticalBarChart,
  SalesFunnelChart,
} from "@/components/charts/charts";
import { ScoreBar } from "@/components/shared/score";
import { formatINR, relativeTime, formatDate } from "@/lib/utils";
import {
  getDashboardStats,
  getIndustryDistribution,
  getCityDistribution,
  getLeadScoreDistribution,
  getSalesFunnel,
  getOpportunityAverages,
  getRecentActivities,
} from "@/lib/queries";
import { getRecurringSnapshot, getRenewalsDue } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [stats, industry, city, leadScores, funnel, opps, activities, recurring, renewals] =
    await Promise.all([
      getDashboardStats(),
      getIndustryDistribution(),
      getCityDistribution(),
      getLeadScoreDistribution(),
      getSalesFunnel(),
      getOpportunityAverages(),
      getRecentActivities(10),
      getRecurringSnapshot(),
      getRenewalsDue(45),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your AI-powered prospect intelligence at a glance.">
        <Button asChild>
          <Link href="/companies">Import Companies</Link>
        </Button>
      </PageHeader>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard index={0} label="Total Companies" value={stats.totalCompanies} icon={Building2} accent="primary" />
        <StatCard index={1} label="Qualified" value={stats.qualifiedCompanies} icon={BadgeCheck} accent="cyan" />
        <StatCard index={2} label="A+ Leads" value={stats.aPlusLeads} icon={Crown} accent="success" />
        <StatCard index={3} label="A Leads" value={stats.aLeads} icon={Star} accent="primary" />
        <StatCard index={4} label="Meetings" value={stats.meetings} icon={CalendarClock} accent="violet" />
        <StatCard index={5} label="Proposals" value={stats.proposals} icon={FileText} accent="warning" />
        <StatCard index={6} label="Closed Deals" value={stats.closedDeals} icon={Trophy} accent="success" />
        <StatCard
          index={7}
          label="Pipeline Value"
          value={formatINR(stats.pipelineValue, true)}
          icon={Wallet}
          accent="primary"
        />
        <StatCard
          index={8}
          label="Expected Revenue"
          value={formatINR(stats.expectedRevenue, true)}
          icon={TrendingUp}
          hint="Probability-weighted"
          accent="cyan"
        />
        <StatCard
          index={9}
          label="Monthly Revenue"
          value={formatINR(stats.monthlyRevenue, true)}
          icon={IndianRupee}
          accent="success"
        />
        <StatCard
          index={10}
          label="Recurring / month (MRR)"
          value={formatINR(recurring.mrr, true)}
          icon={Repeat}
          hint={`${recurring.activeContracts} active · ${formatINR(recurring.arr, true)}/yr`}
          accent="violet"
        />
      </div>

      {/* Renewals due — AMC/retainer contracts coming up */}
      {renewals.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <BellRing className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Renewals due</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {renewals.map((r) => (
                <li key={r.prospectId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/companies/${r.companyId}`} className="min-w-0 font-medium text-primary hover:underline">
                    {r.companyName}
                  </Link>
                  <div className="flex items-center gap-3 text-sm">
                    {r.recurringAmount != null && (
                      <span className="tabular-nums text-muted-foreground">
                        {formatINR(r.recurringAmount, true)}
                        {r.billingCycle ? `/${r.billingCycle.toLowerCase().replace("ly", "")}` : ""}
                      </span>
                    )}
                    <span
                      className={
                        r.overdue
                          ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                          : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                      }
                    >
                      {r.overdue ? "Overdue" : "Renews"} {formatDate(r.renewalDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <EstimateNote />

      {/* Charts row 1 */}
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
            <CardTitle>Sales Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesFunnelChart data={funnel} />
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
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
            <CardTitle>Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <VerticalBarChart data={city} color="#14b8a6" />
          </CardContent>
        </Card>
      </div>

      {/* Opportunity + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Average Opportunity Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar label="CRM Opportunity" score={opps.crm} />
            <ScoreBar label="AI Automation" score={opps.automation} />
            <ScoreBar label="ERP Opportunity" score={opps.erp} />
            <ScoreBar label="AI Opportunity" score={opps.ai} />
            <ScoreBar label="Digital Maturity" score={opps.digital} />
            <p className="pt-2 text-xs text-muted-foreground">Averaged across all analysed companies (AI estimates).</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No activity yet. Import and analyse companies to get started.
              </p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{a.message}</p>
                      <p className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
