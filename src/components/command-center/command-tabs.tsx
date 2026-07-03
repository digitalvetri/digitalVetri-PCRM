"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Copy,
  Lightbulb,
  Loader2,
  Lock,
  Megaphone,
  MessageSquareQuote,
  Phone,
  RefreshCw,
  Sparkles,
  Sunrise,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreRing } from "@/components/shared/score";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { useRole } from "@/components/layout/app-shell";
import { LeadRadar, type DiscoveredLeadItem } from "@/components/command-center/lead-radar";
import {
  AutomationPanel,
  type AutomationConfig,
  type AgentRunItem,
} from "@/components/command-center/automation-panel";
import { OutreachQueue, type OutreachDraftItem } from "@/components/command-center/outreach-queue";
import { AdsPanel } from "@/components/command-center/ads-panel";
import { cn } from "@/lib/utils";
import { INDUSTRIES } from "@/lib/constants";
import type {
  BniPack,
  ColdCallPack,
  ContentPack,
  DailyObjectives,
  EodAnswers,
  SalesCoachPack,
  ScheduleBlock,
} from "@/lib/ai/ceo-os";

// ---------------------------------------------------------------
// Types shared with the server page (Dates serialized to strings)
// ---------------------------------------------------------------

export interface StoredEodReview {
  answers?: EodAnswers | null;
  performanceScore: number;
  wins: string[];
  gaps: string[];
  suggestions: string[];
  tomorrowPlan: string[];
  summary: string;
}

export interface SerializedPlan {
  id: string;
  date: string; // ISO
  briefing: string | null;
  objectives: DailyObjectives;
  schedule: ScheduleBlock[];
  eodReview: StoredEodReview | null;
  performanceScore: number | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  industry: string | null;
}

const NO_COMPANY = "__none__";
const NO_INDUSTRY = "__none__";

const CATEGORY_COLORS: Record<ScheduleBlock["category"], string> = {
  planning: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  prospecting: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  calls: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  meeting: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  proposal: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "follow-up": "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  delivery: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  bni: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  marketing: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

/** Parse a numeric input value; empty/invalid → null. */
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function str(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

/** Coerce a plan object returned by the API into our serialized shape. */
function normalizePlan(plan: Record<string, unknown>): SerializedPlan {
  return {
    id: String(plan.id),
    date: String(plan.date),
    briefing: (plan.briefing as string | null) ?? null,
    objectives: (plan.objectives ?? {}) as DailyObjectives,
    schedule: (plan.schedule ?? []) as ScheduleBlock[],
    eodReview: (plan.eodReview ?? null) as StoredEodReview | null,
    performanceScore: (plan.performanceScore as number | null) ?? null,
  };
}

// ---------------------------------------------------------------
// Main tabbed workspace
// ---------------------------------------------------------------

export function CommandTabs({
  plan,
  companies,
  leads,
  placesConfigured,
  automation,
  agentRuns,
  outreachDrafts,
}: {
  plan: SerializedPlan | null;
  companies: CompanyOption[];
  leads: DiscoveredLeadItem[];
  placesConfigured: boolean;
  automation: AutomationConfig;
  agentRuns: AgentRunItem[];
  outreachDrafts: OutreachDraftItem[];
}) {
  // Shared, so the EOD tab knows when the plan tab just created a plan.
  const [currentPlan, setCurrentPlan] = React.useState<SerializedPlan | null>(plan);

  // Every tab here is a write/AI-generation action, gated on commandCenter.manage
  // (ADMIN/MANAGER/SALES). Read-only VIEWERs still see the CEO dashboard above.
  const canManage = useRole() !== "VIEWER";
  if (!canManage) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">CEO OS workspace is read-only for your role</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Daily planning, EOD review and coaching packs are available to Sales, Managers and Admins.
            You can still track the metrics above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="plan" className="animate-fade-in">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="radar">Lead Radar</TabsTrigger>
        <TabsTrigger value="outreach">Outreach</TabsTrigger>
        <TabsTrigger value="agent">Agent</TabsTrigger>
        <TabsTrigger value="ads">Ads</TabsTrigger>
        <TabsTrigger value="plan">Daily Plan</TabsTrigger>
        <TabsTrigger value="review">EOD Review</TabsTrigger>
        <TabsTrigger value="sales">Sales Coach</TabsTrigger>
        <TabsTrigger value="cold-call">Cold Call</TabsTrigger>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="bni">BNI</TabsTrigger>
      </TabsList>

      <TabsContent value="radar" forceMount className="mt-4 data-[state=inactive]:hidden">
        <LeadRadar leads={leads} placesConfigured={placesConfigured} />
      </TabsContent>
      <TabsContent value="outreach" forceMount className="mt-4 data-[state=inactive]:hidden">
        <OutreachQueue drafts={outreachDrafts} />
      </TabsContent>
      <TabsContent value="agent" forceMount className="mt-4 data-[state=inactive]:hidden">
        <AutomationPanel config={automation} recentRuns={agentRuns} placesConfigured={placesConfigured} />
      </TabsContent>
      <TabsContent value="ads" forceMount className="mt-4 data-[state=inactive]:hidden">
        <AdsPanel />
      </TabsContent>
      {/* forceMount + hidden keeps each tab's state alive while switching */}
      <TabsContent value="plan" forceMount className="mt-4 data-[state=inactive]:hidden">
        <DailyPlanTab plan={currentPlan} onPlanChange={setCurrentPlan} />
      </TabsContent>
      <TabsContent value="review" forceMount className="mt-4 data-[state=inactive]:hidden">
        <EodReviewTab plan={currentPlan} onPlanChange={setCurrentPlan} />
      </TabsContent>
      <TabsContent value="sales" forceMount className="mt-4 data-[state=inactive]:hidden">
        <SalesCoachTab companies={companies} />
      </TabsContent>
      <TabsContent value="cold-call" forceMount className="mt-4 data-[state=inactive]:hidden">
        <ColdCallTab companies={companies} />
      </TabsContent>
      <TabsContent value="content" forceMount className="mt-4 data-[state=inactive]:hidden">
        <ContentTab />
      </TabsContent>
      <TabsContent value="bni" forceMount className="mt-4 data-[state=inactive]:hidden">
        <BniTab />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------
// Daily Plan tab
// ---------------------------------------------------------------

function DailyPlanTab({
  plan,
  onPlanChange,
}: {
  plan: SerializedPlan | null;
  onPlanChange: (p: SerializedPlan) => void;
}) {
  const router = useRouter();
  const bniActivityId = React.useId();
  const clientDeliveriesId = React.useId();
  const blockedTasksId = React.useId();
  const notesId = React.useId();
  const [showForm, setShowForm] = React.useState(plan === null);
  const [loading, setLoading] = React.useState(false);

  const obj = plan?.objectives;
  const [revenueTarget, setRevenueTarget] = React.useState(obj?.revenueTarget?.toString() ?? "");
  const [meetings, setMeetings] = React.useState(obj?.meetings?.toString() ?? "");
  const [coldCalls, setColdCalls] = React.useState(obj?.coldCalls?.toString() ?? "");
  const [followUps, setFollowUps] = React.useState(obj?.followUps?.toString() ?? "");
  const [proposals, setProposals] = React.useState(obj?.proposals?.toString() ?? "");
  const [bniActivity, setBniActivity] = React.useState(obj?.bniActivity ?? "");
  const [clientDeliveries, setClientDeliveries] = React.useState(obj?.clientDeliveries ?? "");
  const [blockedTasks, setBlockedTasks] = React.useState(obj?.blockedTasks ?? "");
  const [notes, setNotes] = React.useState(obj?.notes ?? "");

  function openForm() {
    const o = plan?.objectives;
    setRevenueTarget(o?.revenueTarget?.toString() ?? "");
    setMeetings(o?.meetings?.toString() ?? "");
    setColdCalls(o?.coldCalls?.toString() ?? "");
    setFollowUps(o?.followUps?.toString() ?? "");
    setProposals(o?.proposals?.toString() ?? "");
    setBniActivity(o?.bniActivity ?? "");
    setClientDeliveries(o?.clientDeliveries ?? "");
    setBlockedTasks(o?.blockedTasks ?? "");
    setNotes(o?.notes ?? "");
    setShowForm(true);
  }

  async function generate() {
    setLoading(true);
    try {
      const objectives: DailyObjectives = {
        revenueTarget: num(revenueTarget),
        meetings: num(meetings),
        coldCalls: num(coldCalls),
        followUps: num(followUps),
        proposals: num(proposals),
        bniActivity: str(bniActivity),
        clientDeliveries: str(clientDeliveries),
        blockedTasks: str(blockedTasks),
        notes: str(notes),
      };
      const data = await postJSON<{ plan: Record<string, unknown> }>(
        "/api/command-center/plan",
        objectives
      );
      onPlanChange(normalizePlan(data.plan));
      setShowForm(false);
      toast.success("Today's plan is ready");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the plan");
    } finally {
      setLoading(false);
    }
  }

  if (showForm || !plan) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sunrise className="h-5 w-5 text-primary" />
            Good morning. Let&apos;s build DigitalVetri today.
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set today&apos;s objectives — the OS turns them into an hour-by-hour execution plan
            grounded in your live pipeline.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <NumberField label="Revenue target (₹)" value={revenueTarget} onChange={setRevenueTarget} placeholder="e.g. 100000" />
            <NumberField label="Meetings" value={meetings} onChange={setMeetings} placeholder="e.g. 2" />
            <NumberField label="Cold calls" value={coldCalls} onChange={setColdCalls} placeholder="e.g. 10" />
            <NumberField label="Follow-ups" value={followUps} onChange={setFollowUps} placeholder="e.g. 5" />
            <NumberField label="Proposals" value={proposals} onChange={setProposals} placeholder="e.g. 1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={bniActivityId}>BNI activity</Label>
              <Input id={bniActivityId} value={bniActivity} onChange={(e) => setBniActivity(e.target.value)} placeholder="e.g. weekly meeting, 1 one-to-one" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={clientDeliveriesId}>Client deliveries</Label>
              <Input id={clientDeliveriesId} value={clientDeliveries} onChange={(e) => setClientDeliveries(e.target.value)} placeholder="What must ship today?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={blockedTasksId}>Blocked tasks</Label>
              <Input id={blockedTasksId} value={blockedTasks} onChange={(e) => setBlockedTasks(e.target.value)} placeholder="Anything stuck?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={notesId}>Notes</Label>
              <Input id={notesId} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else on your mind" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={generate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building your day…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate Today&apos;s Plan
                </>
              )}
            </Button>
            {plan && (
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={loading}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Briefing */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> CEO Morning Briefing
          </CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={openForm} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Replan
          </Button>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {plan.briefing ?? "No briefing generated."}
          </p>
        </CardContent>
      </Card>

      {/* Hourly schedule timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {plan.schedule.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No schedule blocks.</p>
          ) : (
            <ol className="relative space-y-0 border-l border-border pl-0">
              {plan.schedule.map((block, i) => (
                <li key={`${block.time}-${i}`} className="relative flex gap-4 pb-6 pl-6 last:pb-0">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="mt-0.5 w-14 shrink-0 rounded-md bg-muted px-2 py-0.5 text-center text-xs font-semibold tabular-nums">
                    {block.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{block.activity}</p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          CATEGORY_COLORS[block.category] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {block.category}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{block.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// EOD Review tab
// ---------------------------------------------------------------

function EodReviewTab({
  plan,
  onPlanChange,
}: {
  plan: SerializedPlan | null;
  onPlanChange: (p: SerializedPlan) => void;
}) {
  const router = useRouter();
  const biggestLearningId = React.useId();
  const tomorrowPriorityId = React.useId();
  const review = plan?.eodReview ?? null;
  const [showForm, setShowForm] = React.useState(review === null);
  const [loading, setLoading] = React.useState(false);

  const a = review?.answers;
  const [revenueClosed, setRevenueClosed] = React.useState(a?.revenueClosed?.toString() ?? "");
  const [meetingsConducted, setMeetingsConducted] = React.useState(a?.meetingsConducted?.toString() ?? "");
  const [proposalsSent, setProposalsSent] = React.useState(a?.proposalsSent?.toString() ?? "");
  const [leadsAdded, setLeadsAdded] = React.useState(a?.leadsAdded?.toString() ?? "");
  const [callsCompleted, setCallsCompleted] = React.useState(a?.callsCompleted?.toString() ?? "");
  const [followUpsMissed, setFollowUpsMissed] = React.useState(a?.followUpsMissed?.toString() ?? "");
  const [biggestLearning, setBiggestLearning] = React.useState(a?.biggestLearning ?? "");
  const [tomorrowPriority, setTomorrowPriority] = React.useState(a?.tomorrowPriority ?? "");

  async function runReview() {
    setLoading(true);
    try {
      const answers: EodAnswers = {
        revenueClosed: num(revenueClosed),
        meetingsConducted: num(meetingsConducted),
        proposalsSent: num(proposalsSent),
        leadsAdded: num(leadsAdded),
        callsCompleted: num(callsCompleted),
        followUpsMissed: num(followUpsMissed),
        biggestLearning: str(biggestLearning),
        tomorrowPriority: str(tomorrowPriority),
      };
      const data = await postJSON<{ plan: Record<string, unknown> }>(
        "/api/command-center/review",
        answers
      );
      onPlanChange(normalizePlan(data.plan));
      setShowForm(false);
      toast.success("Accountability review complete");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to run the review";
      // 400 = no plan yet — tell them to plan first.
      toast.error(msg.includes("No plan") ? "No plan for today yet — run your morning planning first." : msg);
    } finally {
      setLoading(false);
    }
  }

  if (showForm || !review) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle>End-of-Day Accountability</CardTitle>
          <p className="text-sm text-muted-foreground">
            Report today&apos;s actuals — the OS scores the day against this morning&apos;s objectives.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="Revenue closed (₹)" value={revenueClosed} onChange={setRevenueClosed} placeholder="0" />
            <NumberField label="Meetings conducted" value={meetingsConducted} onChange={setMeetingsConducted} placeholder="0" />
            <NumberField label="Proposals sent" value={proposalsSent} onChange={setProposalsSent} placeholder="0" />
            <NumberField label="Leads added" value={leadsAdded} onChange={setLeadsAdded} placeholder="0" />
            <NumberField label="Calls completed" value={callsCompleted} onChange={setCallsCompleted} placeholder="0" />
            <NumberField label="Follow-ups missed" value={followUpsMissed} onChange={setFollowUpsMissed} placeholder="0" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={biggestLearningId}>Biggest learning today</Label>
              <Textarea
                id={biggestLearningId}
                value={biggestLearning}
                onChange={(e) => setBiggestLearning(e.target.value)}
                placeholder="What did today teach you?"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={tomorrowPriorityId}>Tomorrow&apos;s #1 priority</Label>
              <Textarea
                id={tomorrowPriorityId}
                value={tomorrowPriority}
                onChange={(e) => setTomorrowPriority(e.target.value)}
                placeholder="The one thing that must happen tomorrow"
                rows={3}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={runReview} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your day…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Run Accountability Review
                </>
              )}
            </Button>
            {review && (
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={loading}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <ScoreRing score={review.performanceScore} size={104} label="Day Score" />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <h3 className="font-semibold">Coach&apos;s Verdict</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{review.summary}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <RefreshCw className="h-4 w-4" /> Re-run Review
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionList
          title="Wins"
          items={review.wins}
          icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
        />
        <SectionList
          title="Gaps"
          items={review.gaps}
          icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
        />
        <SectionList
          title="Suggestions"
          items={review.suggestions}
          icon={<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
        />
        <SectionList
          title="Tomorrow's Plan"
          items={review.tomorrowPlan}
          icon={<ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          ordered
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Sales Coach tab
// ---------------------------------------------------------------

function SalesCoachTab({ companies }: { companies: CompanyOption[] }) {
  const leadId = React.useId();
  const [companyId, setCompanyId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [pack, setPack] = React.useState<SalesCoachPack | null>(null);

  async function coach() {
    if (!companyId) {
      toast.error("Pick a company to coach on first");
      return;
    }
    setLoading(true);
    try {
      const data = await postJSON<{ pack: SalesCoachPack }>("/api/command-center/coach", {
        type: "sales",
        companyId,
      });
      setPack(data.pack);
      toast.success("Sales coaching pack ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the coaching pack");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={leadId}>Lead to coach on</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger id={leadId}>
                <SelectValue placeholder="Select a company…" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.industry ? ` — ${c.industry}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={coach} disabled={loading || !companyId}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing your pack…
              </>
            ) : (
              <>
                <Users className="h-4 w-4" /> Coach Me
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {!pack && !loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Pick a lead and hit &quot;Coach Me&quot; for a full pre-call coaching pack.
        </p>
      )}

      {pack && (
        <div className="space-y-4 animate-fade-in">
          <PackCard title="Company Summary">{pack.companySummary}</PackCard>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionList
              title="Likely Pain Points"
              items={pack.likelyPainPoints}
              icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
            />
            <SectionList
              title="Industry Insights"
              items={pack.industryInsights}
              icon={<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Suggested Modules</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {pack.suggestedModules.map((m) => (
                <Badge key={m} variant="secondary">
                  {m}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Buying Probability
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary">{pack.buyingProbability}%</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Estimated Budget
                  </p>
                  <p className="mt-1 text-2xl font-bold">{pack.estimatedBudget}</p>
                </div>
              </div>
              <EstimateNote />
            </CardContent>
          </Card>

          <PackCard title="Decision-Maker Strategy">{pack.decisionMakerStrategy}</PackCard>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-primary" /> Conversation Opening
              </CardTitle>
              <CopyButton text={pack.conversationOpening} label="Opening" />
            </CardHeader>
            <CardContent>
              <blockquote className="border-l-2 border-primary pl-4 text-sm italic leading-relaxed">
                {pack.conversationOpening}
              </blockquote>
            </CardContent>
          </Card>

          <SectionList title="Discovery Questions" items={pack.discoveryQuestions} ordered />

          <Card>
            <CardHeader>
              <CardTitle>Objection Handling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pack.objectionHandling.map((o, i) => (
                <ObjectionCard key={i} objection={o.objection} response={o.response} />
              ))}
            </CardContent>
          </Card>

          <PackCard title="Closing Strategy">{pack.closingStrategy}</PackCard>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Cold Call tab
// ---------------------------------------------------------------

function ColdCallTab({ companies }: { companies: CompanyOption[] }) {
  const companyFieldId = React.useId();
  const industryId = React.useId();
  const [companyId, setCompanyId] = React.useState<string>(NO_COMPANY);
  const [industry, setIndustry] = React.useState<string>(NO_INDUSTRY);
  const [loading, setLoading] = React.useState(false);
  const [pack, setPack] = React.useState<ColdCallPack | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const data = await postJSON<{ pack: ColdCallPack }>("/api/command-center/coach", {
        type: "cold-call",
        companyId: companyId === NO_COMPANY ? null : companyId,
        industry: industry === NO_INDUSTRY ? null : industry,
      });
      setPack(data.pack);
      toast.success("Cold-call script ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the script");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={companyFieldId}>Specific company (optional)</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger id={companyFieldId}>
                <SelectValue placeholder="Any company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>No specific company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={industryId}>Or target industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id={industryId}>
                <SelectValue placeholder="Any industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_INDUSTRY}>Any SMB</SelectItem>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Writing your script…
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" /> Generate Script
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {!pack && !loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Generate a problem-led cold-call script — for a specific lead or a whole industry.
        </p>
      )}

      {pack && (
        <div className="space-y-4 animate-fade-in">
          <PackCard title="Greeting" copyText={pack.greeting}>
            {pack.greeting}
          </PackCard>
          <PackCard title="30-Second Introduction" copyText={pack.introduction}>
            {pack.introduction}
          </PackCard>
          <SectionList title="Qualifying Questions" items={pack.qualifyingQuestions} ordered />
          <Card>
            <CardHeader>
              <CardTitle>Objections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pack.objections.map((o, i) => (
                <ObjectionCard key={i} objection={o.objection} response={o.response} />
              ))}
            </CardContent>
          </Card>
          <PackCard title="Closing Statement" copyText={pack.closingStatement}>
            {pack.closingStatement}
          </PackCard>
          <div className="grid gap-4 md:grid-cols-2">
            <PackCard title="Follow-up Message (WhatsApp)" copyText={pack.followUpMessage}>
              {pack.followUpMessage}
            </PackCard>
            <PackCard title="Meeting Booking Message (WhatsApp)" copyText={pack.meetingBookingMessage}>
              {pack.meetingBookingMessage}
            </PackCard>
          </div>
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" /> If they reject
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{pack.ifRejected}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Content tab
// ---------------------------------------------------------------

const CONTENT_FIELDS: { key: keyof ContentPack; title: string }[] = [
  { key: "linkedinPost", title: "LinkedIn Post" },
  { key: "facebookPost", title: "Facebook Post" },
  { key: "caseStudyIdea", title: "Case Study Idea" },
  { key: "crmTip", title: "CRM Tip" },
  { key: "aiAutomationTip", title: "AI Automation Tip" },
  { key: "websiteTip", title: "Website Tip" },
  { key: "seoBlogTopic", title: "SEO Blog Topic" },
  { key: "videoScript", title: "60-Second Video Script" },
];

function ContentTab() {
  const themeId = React.useId();
  const [theme, setTheme] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [pack, setPack] = React.useState<ContentPack | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const data = await postJSON<{ pack: ContentPack }>("/api/command-center/coach", {
        type: "content",
        theme: str(theme),
      });
      setPack(data.pack);
      toast.success("Content pack ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the content pack");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={themeId}>Theme (optional)</Label>
            <Input
              id={themeId}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. WhatsApp automation for manufacturers"
            />
          </div>
          <Button type="button" onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating content…
              </>
            ) : (
              <>
                <Megaphone className="h-4 w-4" /> Generate Content Pack
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {!pack && !loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          One click gets you today&apos;s full content pack — LinkedIn, Facebook, tips, blog topic and a reel script.
        </p>
      )}

      {pack && (
        <div className="grid gap-4 md:grid-cols-2 animate-fade-in">
          {CONTENT_FIELDS.map(({ key, title }) => (
            <PackCard key={key} title={title} copyText={pack[key]}>
              {pack[key]}
            </PackCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// BNI tab
// ---------------------------------------------------------------

function BniTab() {
  const focusId = React.useId();
  const [focus, setFocus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [pack, setPack] = React.useState<BniPack | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const data = await postJSON<{ pack: BniPack }>("/api/command-center/coach", {
        type: "bni",
        focus: str(focus),
      });
      setPack(data.pack);
      toast.success("BNI pack ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the BNI pack");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={focusId}>Focus (optional)</Label>
            <Input
              id={focusId}
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. referrals from construction companies"
            />
          </div>
          <Button type="button" onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing your week…
              </>
            ) : (
              <>
                <Users className="h-4 w-4" /> Generate BNI Pack
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {!pack && !loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Get this week&apos;s 60-second presentation, referral ask, one-to-one strategy and goals.
        </p>
      )}

      {pack && (
        <div className="space-y-4 animate-fade-in">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-primary" /> 60-Second Presentation
              </CardTitle>
              <CopyButton text={pack.sixtySecondPresentation} label="Presentation" />
            </CardHeader>
            <CardContent>
              <blockquote className="whitespace-pre-wrap border-l-2 border-primary pl-4 text-sm italic leading-relaxed">
                {pack.sixtySecondPresentation}
              </blockquote>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <PackCard title="Referral Request" copyText={pack.referralRequest}>
              {pack.referralRequest}
            </PackCard>
            <PackCard title="Feature Presentation Idea">{pack.featurePresentationIdea}</PackCard>
          </div>

          <PackCard title="One-to-One Strategy">{pack.oneToOneStrategy}</PackCard>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionList
              title="Weekly Goals"
              items={pack.weeklyGoals}
              icon={<CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            />
            <SectionList
              title="Networking Tips"
              items={pack.networkingTips}
              icon={<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Helper subcomponents
// ---------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fieldId = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function CopyButton({ text, label = "Text" }: { text: string; label?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }
  return (
    <Button type="button" size="sm" variant="ghost" onClick={copy}>
      <Copy className="h-4 w-4" /> Copy
    </Button>
  );
}

/** Titled card for a block of generated text, with optional Copy button. */
function PackCard({
  title,
  children,
  copyText,
}: {
  title: string;
  children: React.ReactNode;
  copyText?: string;
}) {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {copyText && <CopyButton text={copyText} label={title} />}
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
      </CardContent>
    </Card>
  );
}

/** Card with a bulleted / numbered / icon list. */
function SectionList({
  title,
  items,
  icon,
  ordered = false,
}: {
  title: string;
  items: string[];
  icon?: React.ReactNode;
  ordered?: boolean;
}) {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                {ordered ? (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                ) : (
                  icon ?? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Objection → response card used by Sales Coach and Cold Call tabs. */
function ObjectionCard({ objection, response }: { objection: string; response: string }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2">
        <p className="text-sm font-medium">&quot;{objection}&quot;</p>
      </div>
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{response}</p>
      </div>
    </div>
  );
}
