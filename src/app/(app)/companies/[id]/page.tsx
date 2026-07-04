import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Sparkles,
  Globe,
  Phone,
  Mail,
  MapPin,
  Building2,
  Linkedin,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradeBadge } from "@/components/shared/grade-badge";
import { ScoreBar, ScoreRing } from "@/components/shared/score";
import { ConfidenceBadge, EstimateNote } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AnalyzeButton, AddToProspectsButton } from "@/components/companies/analyze-button";
import { ServicePicker } from "@/components/companies/service-picker";
import { RelationshipBadge } from "@/components/shared/relationship-badge";
import { RevenuePanel } from "@/components/companies/revenue-panel";
import { getCompanyRevenue } from "@/lib/revenue";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, roleCan } from "@/lib/rbac";
import { NotesPanel } from "@/components/shared/notes-panel";
import { QuickContact } from "@/components/shared/quick-contact";
import { enumLabel, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PainPoint = { area: string; prediction: string; reasoning: string };
type IntelEntry = { likelihood: number; details: string; reasoning: string };
type RecModule = { module: string; reason: string; priority: string };
type SavingsRow = { area: string; amount: number; explanation: string };
type SocialMedia = { linkedin?: string; facebook?: string; instagram?: string; twitter?: string; youtube?: string };

const INTEL_CATEGORIES: { key: string; label: string }[] = [
  { key: "businessChallenges", label: "Business Challenges" },
  { key: "manualProcesses", label: "Manual Processes" },
  { key: "excelUsage", label: "Excel Usage" },
  { key: "approvalBottlenecks", label: "Approval Bottlenecks" },
  { key: "inventoryProblems", label: "Inventory Problems" },
  { key: "salesProblems", label: "Sales Problems" },
  { key: "productionDelays", label: "Production Delays" },
  { key: "communicationProblems", label: "Communication Problems" },
  { key: "reportingProblems", label: "Reporting Problems" },
  { key: "customerManagementIssues", label: "Customer Management Issues" },
];

const SOCIAL_ICONS = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
} as const;

function Chips({ items, label }: { items: string[]; label: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <Badge key={it} variant="secondary" className="font-normal">
            {it}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const metadata = { title: "Company Profile" };

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      analysis: true,
      leadIntelligence: true,
      recommendation: true,
      decisionMakers: true,
      prospect: true,
      notes: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { scheduledAt: "desc" } },
      proposals: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!company) notFound();

  const currentUser = await getCurrentUser();
  const canWriteNotes = currentUser ? roleCan(currentUser.role, "companies.edit") : false;
  const canDeleteNotes = currentUser ? roleCan(currentUser.role, "companies.delete") : false;
  const revenue = await getCompanyRevenue(company.id);
  const notes = company.notes.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt.toISOString(), author: n.author }));

  const a = company.analysis;
  const li = company.leadIntelligence;
  const rec = company.recommendation;
  const social = (company.socialMedia ?? {}) as SocialMedia;
  const painPoints = (a?.painPoints ?? []) as PainPoint[];
  const recModules = (rec?.recommendedModules ?? []) as RecModule[];
  const savings = (rec?.savingsBreakdown ?? []) as SavingsRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description={[company.industry, company.city].filter(Boolean).join(" · ") || "Company profile"}
      >
        <RelationshipBadge status={company.relationship} showProspect className="self-center" />
        <AnalyzeButton
          companyId={company.id}
          companyName={company.name}
          label={a ? "Re-run AI Analysis" : "Run AI Analysis"}
        />
        <AddToProspectsButton
          companyId={company.id}
          companyName={company.name}
          isProspect={Boolean(company.prospect)}
        />
      </PageHeader>

      <QuickContact
        companyId={company.id}
        companyName={company.name}
        email={company.publicEmail}
        phone={company.phone}
        contactName={company.decisionMakers.find((d) => d.isPrimary)?.name ?? company.decisionMakers[0]?.name}
      />

      {/* Contact / meta strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 max-w-full items-center gap-1.5 text-primary hover:underline"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="truncate">{company.website.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
          {company.phone && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-4 w-4" />
              {company.phone}
            </span>
          )}
          {company.publicEmail && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-4 w-4" />
              {company.publicEmail}
            </span>
          )}
          {(company.city || company.state) && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[company.city, company.state].filter(Boolean).join(", ")}
            </span>
          )}
          {a && (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Lead grade</span>
              <GradeBadge grade={a.leadGrade} />
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Target services</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Which DigitalVetri service(s) are you pursuing this client for?
          </p>
          <ServicePicker companyId={company.id} initial={company.targetServices} editable={canWriteNotes} />
        </CardContent>
      </Card>

      <RevenuePanel
        companyId={company.id}
        entries={revenue.entries}
        totals={revenue.totals}
        canWrite={canWriteNotes}
      />

      {!a ? (
        <EmptyState
          icon={Sparkles}
          title="Not analysed yet"
          description="Run AI analysis to generate lead scores, opportunity insights and a CRM recommendation for this company."
          action={
            <AnalyzeButton companyId={company.id} companyName={company.name} />
          }
        />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scores">AI Scores</TabsTrigger>
            {li && <TabsTrigger value="intelligence">Lead Intelligence</TabsTrigger>}
            {rec && <TabsTrigger value="recommendation">CRM Recommendation</TabsTrigger>}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Business Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">{a.businessSummary}</p>
                  <Chips items={company.products} label="Products" />
                  <Chips items={company.services} label="Services" />
                  <Chips items={company.technologyStack} label="Technology Stack" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Facts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Employees</span>
                    <span className="flex items-center gap-1.5">
                      {company.employeeEstimate ?? "—"}
                      <ConfidenceBadge confidence={company.employeeConfidence} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="flex items-center gap-1.5">
                      {company.revenueEstimate ?? "—"}
                      <ConfidenceBadge confidence={company.revenueConfidence} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span>{company.industry ?? "—"}</span>
                  </div>
                  {company.subIndustry && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sub-industry</span>
                      <span>{company.subIndustry}</span>
                    </div>
                  )}
                  {company.manufacturingType && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Manufacturing</span>
                      <span>{company.manufacturingType}</span>
                    </div>
                  )}
                  {company.googleRating != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Google Rating</span>
                      <span>
                        {company.googleRating} {company.googleReviews ? `(${company.googleReviews})` : ""}
                      </span>
                    </div>
                  )}

                  {/* Social links */}
                  {Object.keys(SOCIAL_ICONS).some((k) => social[k as keyof SocialMedia]) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(Object.keys(SOCIAL_ICONS) as (keyof SocialMedia)[]).map((k) => {
                        const url = social[k];
                        if (!url) return null;
                        const Icon = SOCIAL_ICONS[k];
                        return (
                          <a
                            key={k}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${company.name} on ${k}`}
                            className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <Icon className="h-4 w-4" />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Decision makers */}
            <Card>
              <CardHeader>
                <CardTitle>Decision Makers</CardTitle>
              </CardHeader>
              <CardContent>
                {company.decisionMakers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No publicly available decision-maker information found.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {company.decisionMakers.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {d.name}
                              {d.isPrimary && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  Primary
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{d.designation ?? "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {d.email && (
                            <a
                              href={`mailto:${d.email}`}
                              aria-label={`Email ${d.name}`}
                              className="rounded-md p-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                          )}
                          {d.linkedinUrl && (
                            <a
                              href={d.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${d.name} on LinkedIn`}
                              className="rounded-md p-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <Linkedin className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Scores */}
          <TabsContent value="scores" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="flex flex-col items-center justify-center py-6">
                <ScoreRing score={a.leadScore} size={120} label="Lead Score" />
                <div className="mt-3">
                  <GradeBadge grade={a.leadGrade} />
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Opportunity Scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScoreBar label="CRM Opportunity" score={a.crmOpportunityScore} />
                  <ScoreBar label="ERP Opportunity" score={a.erpOpportunityScore} />
                  <ScoreBar label="AI Opportunity" score={a.aiOpportunityScore} />
                  <ScoreBar label="Automation" score={a.automationScore} />
                  <ScoreBar label="Digital Maturity" score={a.digitalMaturityScore} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Buying Probability</p>
                  <div className="mt-2">
                    <ScoreBar score={a.buyingProbability} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Expected Budget</p>
                  <p className="mt-2 text-lg font-semibold">{a.expectedBudget ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <p className="mt-2 text-lg font-semibold">{enumLabel(a.priority)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Predicted Pain Points</CardTitle>
              </CardHeader>
              <CardContent>
                {painPoints.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No pain points identified.</p>
                ) : (
                  <ul className="space-y-3">
                    {painPoints.map((p, i) => (
                      <li key={i} className="rounded-lg border p-3">
                        <p className="text-sm font-medium">{p.area}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{p.prediction}</p>
                        {p.reasoning && <p className="mt-1 text-xs italic text-muted-foreground">{p.reasoning}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <EstimateNote />
          </TabsContent>

          {/* Lead Intelligence */}
          {li && (
            <TabsContent value="intelligence" className="space-y-4">
              {li.overallInsight && (
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Insight</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{li.overallInsight}</p>
                  </CardContent>
                </Card>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {INTEL_CATEGORIES.map(({ key, label }) => {
                  const entry = (li as unknown as Record<string, unknown>)[key] as IntelEntry | null;
                  if (!entry || typeof entry.likelihood !== "number") return null;
                  return (
                    <Card key={key}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{label}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <ScoreBar label="Likelihood" score={entry.likelihood} />
                        {entry.details && <p className="text-sm text-muted-foreground">{entry.details}</p>}
                        {entry.reasoning && (
                          <p className="text-xs italic text-muted-foreground">{entry.reasoning}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <EstimateNote />
            </TabsContent>
          )}

          {/* CRM Recommendation */}
          {rec && (
            <TabsContent value="recommendation" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Est. Hours</p>
                    <p className="mt-1 text-lg font-semibold">{rec.estimatedHours}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Timeline</p>
                    <p className="mt-1 text-lg font-semibold">{rec.estimatedTimeline}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Team Size</p>
                    <p className="mt-1 text-lg font-semibold">{rec.estimatedTeamSize}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Est. Cost</p>
                    <p className="mt-1 text-lg font-semibold">{rec.costRange ?? formatINR(rec.estimatedCost, true)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Expected ROI</p>
                    <p className="mt-1 text-lg font-semibold">{rec.expectedRoi}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Annual Savings</p>
                    <p className="mt-1 text-lg font-semibold">{formatINR(rec.annualSavings, true)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recommended Modules</CardTitle>
                </CardHeader>
                <CardContent>
                  {recModules.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No modules recommended.</p>
                  ) : (
                    <ul className="space-y-3">
                      {recModules.map((m, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">{m.module}</p>
                            {m.reason && <p className="mt-1 text-sm text-muted-foreground">{m.reason}</p>}
                          </div>
                          {m.priority && (
                            <Badge variant="outline" className="shrink-0">
                              {enumLabel(m.priority)}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {savings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Savings Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {savings.map((s, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">{s.area}</p>
                            {s.explanation && (
                              <p className="mt-1 text-sm text-muted-foreground">{s.explanation}</p>
                            )}
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatINR(s.amount, true)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <EstimateNote />
            </TabsContent>
          )}
        </Tabs>
      )}

      <NotesPanel
        companyId={company.id}
        initialNotes={notes}
        currentUserId={currentUser?.id ?? ""}
        canWrite={canWriteNotes}
        canDeleteAny={canDeleteNotes}
      />
    </div>
  );
}
