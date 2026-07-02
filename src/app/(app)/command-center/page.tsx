import {
  AlertTriangle,
  CalendarClock,
  Clock,
  FileText,
  IndianRupee,
  ListTodo,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dayStart, getCommandCenterSnapshot, targetFunnel } from "@/lib/command-center";
import { isPlacesConfigured } from "@/lib/places";
import { getAutomationConfig } from "@/lib/automation";
import type { DiscoveredLeadItem } from "@/components/command-center/lead-radar";
import type { DailyObjectives, ScheduleBlock } from "@/lib/ai/ceo-os";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { GradeBadge, StatusBadge } from "@/components/shared/grade-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CommandTabs,
  type SerializedPlan,
  type StoredEodReview,
} from "@/components/command-center/command-tabs";
import { TargetForm } from "@/components/command-center/target-form";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Command Center" };

export default async function CommandCenterPage() {
  const [snapshot, plan, companies, rawLeads, automation, agentRunsRaw, outreachRaw] = await Promise.all([
    getCommandCenterSnapshot(),
    prisma.dailyPlan.findUnique({ where: { date: dayStart() } }),
    prisma.company.findMany({
      select: { id: true, name: true, industry: true },
      orderBy: { name: "asc" },
    }),
    prisma.discoveredLead.findMany({
      where: { status: { in: ["NEW", "QUALIFIED"] } },
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    getAutomationConfig(),
    prisma.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.outreachDraft.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const outreachDrafts = outreachRaw.map((d) => ({
    id: d.id,
    leadName: d.leadName,
    channel: d.channel as "EMAIL" | "WHATSAPP",
    toContact: d.toContact,
    subject: d.subject,
    body: d.body,
    createdAt: d.createdAt.toISOString(),
  }));

  const agentRuns = agentRunsRaw.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    leadsFound: r.leadsFound,
    sent: r.sent,
    summary: r.summary,
  }));

  const leads: DiscoveredLeadItem[] = rawLeads.map((l) => ({
    id: l.id,
    name: l.name,
    website: l.website,
    city: l.city,
    industry: l.industry,
    signals: (l.signals ?? []) as string[],
    recommendedService: l.recommendedService,
    summary: l.summary,
    needScore: l.needScore,
    fitScore: l.fitScore,
    totalScore: l.totalScore,
    status: l.status,
  }));

  const funnel = targetFunnel(snapshot.monthlyTarget, snapshot.revenueClosedThisMonth);

  const serializedPlan: SerializedPlan | null = plan
    ? {
        id: plan.id,
        date: plan.date.toISOString(),
        briefing: plan.briefing,
        objectives: (plan.objectives ?? {}) as unknown as DailyObjectives,
        schedule: (plan.schedule ?? []) as unknown as ScheduleBlock[],
        eodReview: plan.eodReview as unknown as StoredEodReview | null,
        performanceScore: plan.performanceScore,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Your CEO Operating System — plan, execute, review. Revenue first."
      >
        <TargetForm current={snapshot.monthlyTarget} />
      </PageHeader>

      {/* CEO dashboard */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          index={0}
          label="Revenue Goal"
          value={snapshot.monthlyTarget != null ? formatINR(snapshot.monthlyTarget, true) : "Set target"}
          icon={Target}
          hint="This month"
          accent="primary"
        />
        <StatCard
          index={1}
          label="Revenue Closed"
          value={formatINR(snapshot.revenueClosedThisMonth, true)}
          icon={IndianRupee}
          hint="This month"
          accent="success"
        />
        <StatCard
          index={2}
          label="Achievement"
          value={snapshot.achievementPct != null ? `${snapshot.achievementPct}%` : "—"}
          icon={TrendingUp}
          hint="Of monthly goal"
          accent="cyan"
        />
        <StatCard
          index={3}
          label="Pipeline Value"
          value={formatINR(snapshot.pipelineValue, true)}
          icon={Wallet}
          accent="primary"
        />
        <StatCard
          index={4}
          label="Meetings Today"
          value={snapshot.meetingsToday}
          icon={CalendarClock}
          accent="violet"
        />
        <StatCard
          index={5}
          label="Follow-ups Pending"
          value={snapshot.followUpsPending}
          icon={Clock}
          hint="Due by end of day"
          accent="cyan"
        />
        <StatCard
          index={6}
          label="Missed Follow-ups"
          value={snapshot.missedFollowUps}
          icon={AlertTriangle}
          hint={snapshot.missedFollowUps > 0 ? "Clear these first" : undefined}
          accent={snapshot.missedFollowUps > 0 ? "warning" : "success"}
        />
        <StatCard
          index={7}
          label="New Leads"
          value={snapshot.newLeadsThisWeek}
          icon={UserPlus}
          hint="This week"
          accent="primary"
        />
        <StatCard index={8} label="Open Tasks" value={snapshot.openTasks} icon={ListTodo} accent="violet" />
      </div>

      {/* Path to target */}
      {funnel && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Path to Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To close the remaining{" "}
              <span className="font-semibold text-foreground">{formatINR(funnel.remaining, true)}</span>{" "}
              this month, at typical conversion you need:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "New leads", value: funnel.leads },
                { label: "Outreach", value: funnel.outreach },
                { label: "Meetings", value: funnel.meetings },
                { label: "Proposals", value: funnel.proposals },
                { label: "Deals to win", value: funnel.deals },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-muted/30 p-3 text-center">
                  <div className="text-xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Assumes ~{formatINR(funnel.assumptions.avgDealValue, true)} avg deal &middot;{" "}
              {Math.round(funnel.assumptions.winRate * 100)}% win rate. Find the leads in the Lead Radar tab below.
            </p>
          </CardContent>
        </Card>
      )}

      {/* High priority leads + proposal deadlines */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> High Priority Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.highPriorityLeads.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No A+/A leads yet — analyse companies to surface priority leads.
              </p>
            ) : (
              <ul className="divide-y">
                {snapshot.highPriorityLeads.map((lead, i) => (
                  <li key={`${lead.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <GradeBadge grade={lead.grade} />
                      <p className="truncate text-sm font-medium">{lead.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {lead.score}
                      </span>
                      <StatusBadge status={lead.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Proposal Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.proposalDeadlines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No proposals expiring in the next 7 days.
              </p>
            ) : (
              <ul className="divide-y">
                {snapshot.proposalDeadlines.map((p, i) => (
                  <li key={`${p.proposalNo}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.company}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(p.value)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Valid till {formatDate(p.validUntil)}
                      </p>
                      <StatusBadge status={p.status} className="mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CEO OS workspace */}
      <CommandTabs
        plan={serializedPlan}
        companies={companies}
        leads={leads}
        placesConfigured={isPlacesConfigured()}
        automation={automation}
        agentRuns={agentRuns}
        outreachDrafts={outreachDrafts}
      />
    </div>
  );
}
