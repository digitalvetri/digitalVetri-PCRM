"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Crown,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRole } from "@/components/layout/app-shell";
import { relativeTime, cn } from "@/lib/utils";

// ---------------------------------------------------------------
// Types (mirror src/lib/ai/departments.ts + CeoBriefing, serialized)
// ---------------------------------------------------------------

type DeptKey =
  | "sales" | "marketing" | "social" | "finance" | "operations"
  | "customer-success" | "engineering" | "design" | "product" | "legal" | "people";
type DeptGroup = "Revenue" | "Delivery" | "Operations" | "Corporate";

interface DeptReport {
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  actions: { action: string; why: string }[];
  risks: string[];
}
interface StoredDeptReport {
  deptKey: DeptKey;
  deptTitle: string;
  report: DeptReport;
  createdAt: string;
}
interface CeoBriefing {
  greeting: string;
  headline: string;
  revenue: string;
  focus: string;
  risks: string[];
  actions: { action: string; why: string }[];
  spoken: string;
}

interface DeptMeta {
  key: DeptKey;
  title: string;
  emoji: string;
  tagline: string;
  group: DeptGroup;
  owns: string[];
  grounded: boolean;
}

const DEPTS: DeptMeta[] = [
  { key: "sales", title: "Head of Sales", emoji: "🎯", group: "Revenue", grounded: true, tagline: "Leads, outreach & closing", owns: ["Lead Radar", "Outreach", "Prospects", "Proposals"] },
  { key: "marketing", title: "Head of Marketing", emoji: "📣", group: "Revenue", grounded: true, tagline: "Content, ads & inbound demand", owns: ["Content", "Ads", "Enquiry funnel", "SEO"] },
  { key: "social", title: "Head of Social Media", emoji: "📱", group: "Revenue", grounded: false, tagline: "Posts, reels & community", owns: ["LinkedIn", "Instagram", "Facebook", "Reels"] },
  { key: "engineering", title: "Head of Engineering", emoji: "💻", group: "Delivery", grounded: false, tagline: "Build & ship client projects", owns: ["Delivery", "Architecture", "Quality"] },
  { key: "design", title: "Head of Design", emoji: "🎨", group: "Delivery", grounded: false, tagline: "UI/UX & brand craft", owns: ["UI/UX", "Brand", "Design system"] },
  { key: "product", title: "Head of Product", emoji: "🧭", group: "Delivery", grounded: false, tagline: "Strategy, roadmap & priorities", owns: ["Roadmap", "Discovery", "Positioning"] },
  { key: "operations", title: "Head of Operations", emoji: "⚙️", group: "Operations", grounded: true, tagline: "Follow-ups, tasks & delivery health", owns: ["Follow-ups", "Tasks", "Meetings", "Nurture"] },
  { key: "customer-success", title: "Head of Customer Success", emoji: "🤝", group: "Operations", grounded: true, tagline: "Retention, renewals & upsell", owns: ["Active clients", "Renewals", "Upsell"] },
  { key: "finance", title: "Head of Finance", emoji: "💰", group: "Corporate", grounded: true, tagline: "Revenue, profit & recurring", owns: ["Revenue", "MRR/ARR", "Outstanding", "Renewals"] },
  { key: "legal", title: "Head of Legal", emoji: "⚖️", group: "Corporate", grounded: false, tagline: "Contracts, NDAs & compliance", owns: ["Contracts", "NDAs", "Compliance"] },
  { key: "people", title: "Head of People", emoji: "👥", group: "Corporate", grounded: false, tagline: "Hiring, roles & team", owns: ["Hiring", "Onboarding", "Culture"] },
];
const GROUPS: DeptGroup[] = ["Revenue", "Delivery", "Operations", "Corporate"];

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

// ---------------------------------------------------------------
// The AI Company org chart
// ---------------------------------------------------------------

export function AiCompany() {
  const canManage = useRole() !== "VIEWER";
  const [loading, setLoading] = React.useState(true);
  const [rebriefing, setRebriefing] = React.useState(false);
  const [briefing, setBriefing] = React.useState<CeoBriefing | null>(null);
  const [reports, setReports] = React.useState<Partial<Record<DeptKey, StoredDeptReport>>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/reports");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setBriefing((data.briefing as CeoBriefing) ?? null);
      const map: Partial<Record<DeptKey, StoredDeptReport>> = {};
      for (const r of (data.reports ?? []) as StoredDeptReport[]) map[r.deptKey] = r;
      setReports(map);
    } catch {
      /* leave empty — cards show "no report yet" */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function rebrief() {
    setRebriefing(true);
    try {
      const data = await postJSON<{ briefing: CeoBriefing }>("/api/command-center/briefing", {});
      setBriefing(data.briefing);
      toast.success("CEO re-briefed from the latest reports");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-brief failed");
    } finally {
      setRebriefing(false);
    }
  }

  const filedCount = Object.keys(reports).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* CEO — top of the org chart */}
      <Card className="overflow-hidden border-primary/30">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Crown className="h-6 w-6" />
              </span>
              <span>
                AI CEO
                <span className="block text-xs font-normal text-muted-foreground">
                  Chief of Staff · synthesises {filedCount} department report{filedCount === 1 ? "" : "s"}
                </span>
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {canManage && (
                <Button type="button" size="sm" onClick={rebrief} disabled={rebriefing || loading}>
                  {rebriefing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Re-brief</span>
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !briefing ? (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reviewing the business…
              </p>
            ) : briefing ? (
              <>
                {briefing.headline && <p className="text-sm font-medium">{briefing.headline}</p>}
                {briefing.revenue && <p className="text-sm text-muted-foreground">💰 {briefing.revenue}</p>}
                {briefing.focus && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm">
                      <span className="font-semibold">Today&apos;s #1: </span>
                      {briefing.focus}
                    </p>
                  </div>
                )}
                {briefing.actions.length > 0 && (
                  <ul className="space-y-1.5">
                    {briefing.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span>
                          {a.action}
                          {a.why && <span className="text-muted-foreground"> — {a.why}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {briefing.risks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {briefing.risks.map((r, i) => (
                      <Badge key={i} variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mr-1 h-3 w-3" /> {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                No briefing yet. Run a few department shifts below, then hit Re-brief — the CEO
                synthesises their reports.
              </p>
            )}
          </CardContent>
        </div>
      </Card>

      <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
        ▲ everyone reports to the CEO ▲
      </p>

      {/* Department heads grouped by function */}
      {GROUPS.map((group) => {
        const depts = DEPTS.filter((d) => d.group === group);
        if (depts.length === 0) return null;
        return (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {depts.map((dept) => (
                <DeptCard
                  key={dept.key}
                  meta={dept}
                  stored={reports[dept.key]}
                  canManage={canManage}
                  onReport={(r) =>
                    setReports((prev) => ({
                      ...prev,
                      [dept.key]: { deptKey: dept.key, deptTitle: dept.title, report: r, createdAt: new Date().toISOString() },
                    }))
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------
// A single department head card (report + run shift + chat)
// ---------------------------------------------------------------

function DeptCard({
  meta,
  stored,
  canManage,
  onReport,
}: {
  meta: DeptMeta;
  stored?: StoredDeptReport;
  canManage: boolean;
  onReport: (r: DeptReport) => void;
}) {
  const [running, setRunning] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const report = stored?.report;

  async function runShift() {
    setRunning(true);
    try {
      const data = await postJSON<{ report: DeptReport }>("/api/company/shift", { department: meta.key });
      onReport(data.report);
      toast.success(`${meta.title} filed a report`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Shift failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">{meta.emoji}</span>
            <div>
              <CardTitle className="text-sm">{meta.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{meta.tagline}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!meta.grounded && (
              <Badge variant="secondary" className="text-[9px] uppercase">Advisory</Badge>
            )}
            {stored && (
              <span className="text-[10px] text-muted-foreground" title={new Date(stored.createdAt).toLocaleString()}>
                {relativeTime(stored.createdAt)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {report ? (
          <>
            <p className="text-sm font-medium">{report.headline}</p>
            {report.summary && <p className="text-sm text-muted-foreground">{report.summary}</p>}

            {report.metrics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {report.metrics.map((m, i) => (
                  <div key={i} className="rounded-lg border bg-muted/40 px-2.5 py-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                    <div className="text-sm font-semibold tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {report.actions.length > 0 && (
              <ul className="space-y-1.5">
                {report.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      {a.action}
                      {a.why && <span className="text-muted-foreground"> — {a.why}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {report.risks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {report.risks.map((r, i) => (
                  <Badge key={i} variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mr-1 h-3 w-3" /> {r}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-1.5 py-1">
            <p className="text-sm text-muted-foreground">
              {meta.grounded ? "No report filed yet." : "Ask me anything — I advise on demand."}
            </p>
            <div className="flex flex-wrap gap-1">
              {meta.owns.map((o) => (
                <Badge key={o} variant="secondary" className="text-[10px]">{o}</Badge>
              ))}
            </div>
          </div>
        )}

        {canManage && (
          <div className="mt-auto flex items-center gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={runShift} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="ml-1">{report ? "Re-run" : "Run shift"}</span>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setChatOpen((o) => !o)}>
              <MessageSquare className="h-4 w-4" />
              <span className="ml-1">Talk</span>
            </Button>
          </div>
        )}

        {chatOpen && <DeptChat meta={meta} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------
// Inline chat with a department head
// ---------------------------------------------------------------

function DeptChat({ meta }: { meta: DeptMeta }) {
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<{ role: "user" | "assistant"; content: string }[]>([]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const data = await postJSON<{ answer: string }>("/api/company/ask", { department: meta.key, question: q });
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1 rounded-lg border bg-muted/30 p-2">
      {messages.length > 0 && (
        <div className="mb-2 max-h-52 space-y-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-1.5 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {meta.title} is thinking…
            </div>
          )}
        </div>
      )}
      <form onSubmit={send} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask your ${meta.title}…`}
          aria-label={`Ask your ${meta.title}`}
          className="h-8 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary"
        />
        <Button type="submit" size="icon" className="h-8 w-8" disabled={loading || !input.trim()} aria-label="Send">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
