import Link from "next/link";
import { Workflow, Bot, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBar } from "@/components/shared/score";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ColumnChart } from "@/components/charts/charts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PainPoint {
  area: string;
  prediction: string;
  reasoning: string;
}

// Match "Automation"/"Chatbot"/"Workflow" as substrings, and "AI" only as a
// whole word (so "Complaint Management" is not flagged).
const AUTOMATION_RE = /\bAI\b|Automation|Chatbot|Workflow/i;

function isAutomationModule(m: string): boolean {
  return AUTOMATION_RE.test(m);
}

function scoreBucket(score: number): string {
  if (score >= 80) return "80-100";
  if (score >= 60) return "60-79";
  if (score >= 40) return "40-59";
  if (score >= 20) return "20-39";
  return "0-19";
}

const BUCKETS = ["0-19", "20-39", "40-59", "60-79", "80-100"];

export const metadata = { title: "Automation Opportunities" };

export default async function AutomationOpportunitiesPage() {
  const analyses = await prisma.companyAnalysis.findMany({
    include: { company: true },
    orderBy: { automationScore: "desc" },
  });

  const count = analyses.length;
  const avgAutomation = count
    ? Math.round(analyses.reduce((s, a) => s + a.automationScore, 0) / count)
    : 0;
  const avgAi = count
    ? Math.round(analyses.reduce((s, a) => s + a.aiOpportunityScore, 0) / count)
    : 0;
  const highCount = analyses.filter((a) => a.automationScore >= 70).length;

  const distribution = BUCKETS.map((b) => ({
    name: b,
    value: analyses.filter((a) => scoreBucket(a.automationScore) === b).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Automation Opportunities"
        description="Companies ranked by their AI-estimated automation and AI opportunity."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Companies Analysed" value={count} icon={Workflow} accent="primary" />
        <StatCard index={1} label="Avg Automation Score" value={avgAutomation} icon={Workflow} accent="cyan" />
        <StatCard index={2} label="Avg AI Score" value={avgAi} icon={Bot} accent="violet" />
        <StatCard
          index={3}
          label="High Automation"
          value={highCount}
          hint="Automation score ≥ 70"
          icon={Sparkles}
          accent="success"
        />
      </div>

      <EstimateNote />

      <Card>
        <CardHeader>
          <CardTitle>Automation Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnChart data={distribution} color="#8b5cf6" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranked Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {analyses.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No analysed companies yet"
              description="Analyse companies to surface automation opportunities here."
            />
          ) : (
            <div className="space-y-3">
              {analyses.map((a) => {
                const autoModules = a.suggestedModules.filter(isAutomationModule).slice(0, 6);
                const painPoints = (a.painPoints as unknown as PainPoint[] | null) ?? [];
                const autoPains = painPoints
                  .filter((p) =>
                    isAutomationModule(`${p.area} ${p.prediction}`) ||
                    /manual|repetit|approval|workflow|data entry|excel/i.test(
                      `${p.area} ${p.prediction}`
                    )
                  )
                  .slice(0, 3);
                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between"
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
                      {autoModules.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {autoModules.map((m) => (
                            <Badge key={m} variant="secondary" className="text-[11px]">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {autoPains.length > 0 && (
                        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                          {autoPains.map((p, i) => (
                            <li key={i}>
                              <span className="font-medium text-foreground">{p.area}:</span>{" "}
                              {p.prediction}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="w-full shrink-0 space-y-2 lg:w-64">
                      <ScoreBar label="Automation" score={a.automationScore} />
                      <ScoreBar label="AI Opportunity" score={a.aiOpportunityScore} />
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/companies/${a.companyId}`}>View Company</Link>
                      </Button>
                    </div>
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
