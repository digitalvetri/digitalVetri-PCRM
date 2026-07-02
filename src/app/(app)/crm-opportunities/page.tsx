import Link from "next/link";
import { Building2, Target, Wallet, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBar } from "@/components/shared/score";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ColumnChart } from "@/components/charts/charts";
import { formatINR } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function scoreBucket(score: number): string {
  if (score >= 80) return "80-100";
  if (score >= 60) return "60-79";
  if (score >= 40) return "40-59";
  if (score >= 20) return "20-39";
  return "0-19";
}

const BUCKETS = ["0-19", "20-39", "40-59", "60-79", "80-100"];

export const metadata = { title: "CRM Opportunities" };

export default async function CrmOpportunitiesPage() {
  const analyses = await prisma.companyAnalysis.findMany({
    include: { company: { include: { recommendation: true } } },
    orderBy: { crmOpportunityScore: "desc" },
  });

  const count = analyses.length;
  const avgScore = count
    ? Math.round(analyses.reduce((s, a) => s + a.crmOpportunityScore, 0) / count)
    : 0;
  const totalPipeline = analyses.reduce(
    (s, a) => s + (a.company.recommendation?.estimatedCost ?? 0),
    0
  );
  const highCount = analyses.filter((a) => a.crmOpportunityScore >= 70).length;

  const distribution = BUCKETS.map((b) => ({
    name: b,
    value: analyses.filter((a) => scoreBucket(a.crmOpportunityScore) === b).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Opportunities"
        description="Companies ranked by their AI-estimated CRM implementation opportunity."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Companies Analysed" value={count} icon={Building2} accent="primary" />
        <StatCard index={1} label="Avg CRM Score" value={avgScore} icon={Target} accent="cyan" />
        <StatCard
          index={2}
          label="Estimated Pipeline"
          value={formatINR(totalPipeline, true)}
          icon={Wallet}
          accent="success"
        />
        <StatCard
          index={3}
          label="High Opportunity"
          value={highCount}
          hint="CRM score ≥ 70"
          icon={TrendingUp}
          accent="violet"
        />
      </div>

      <EstimateNote />

      <Card>
        <CardHeader>
          <CardTitle>CRM Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnChart data={distribution} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranked Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {analyses.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No analysed companies yet"
              description="Analyse companies to surface CRM opportunities here."
            />
          ) : (
            <div className="space-y-3">
              {analyses.map((a) => {
                const rec = a.company.recommendation;
                const modules = a.suggestedModules.slice(0, 6);
                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/companies/${a.companyId}`}
                          className="font-semibold hover:text-primary hover:underline"
                        >
                          {a.company.name}
                        </Link>
                        {a.company.industry && (
                          <span className="text-xs text-muted-foreground">{a.company.industry}</span>
                        )}
                      </div>
                      <ScoreBar label="CRM Score" score={a.crmOpportunityScore} className="max-w-md" />
                      {modules.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {modules.map((m) => (
                            <Badge key={m} variant="secondary" className="text-[11px]">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-sm lg:w-72">
                      <span className="text-muted-foreground">Est. Cost</span>
                      <span className="text-right font-medium">
                        {formatINR(rec?.estimatedCost, true)}
                      </span>
                      <span className="text-muted-foreground">Timeline</span>
                      <span className="text-right font-medium">{rec?.estimatedTimeline ?? "—"}</span>
                      <span className="text-muted-foreground">Expected ROI</span>
                      <span className="text-right font-medium">{rec?.expectedRoi ?? "—"}</span>
                      <span className="text-muted-foreground">Annual Savings</span>
                      <span className="text-right font-medium">
                        {formatINR(rec?.annualSavings, true)}
                      </span>
                    </div>

                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href={`/companies/${a.companyId}`}>View</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
