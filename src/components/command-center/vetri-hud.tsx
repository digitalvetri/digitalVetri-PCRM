"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Cpu,
  Database,
  Mic,
  Play,
  RadioTower,
  Rocket,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, cn } from "@/lib/utils";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface VetriVitals {
  monthlyTarget: number | null;
  revenueClosed: number;
  achievementPct: number | null;
  pipelineValue: number;
  mrr: number;
  meetingsToday: number;
  followUpsPending: number;
  missedFollowUps: number;
  openTasks: number;
}
export interface VetriProvider {
  name: string;
  connected: boolean;
  role?: string;
}
export interface VetriCounts {
  companies: number;
  prospects: number;
  leads: number;
  notes: number;
}

interface CeoBriefing {
  headline: string;
  revenue: string;
  focus: string;
  risks: string[];
  actions: { action: string; why: string }[];
}
interface StoredDeptReport {
  deptKey: string;
  deptTitle: string;
  report: { headline: string };
  createdAt: string;
}

const AGENTS: { key: string; label: string; emoji: string }[] = [
  { key: "sales", label: "Sales", emoji: "🎯" },
  { key: "marketing", label: "Marketing", emoji: "📣" },
  { key: "finance", label: "Finance", emoji: "💰" },
  { key: "operations", label: "Operations", emoji: "⚙️" },
  { key: "customer-success", label: "Customer Success", emoji: "🤝" },
  { key: "social", label: "Social", emoji: "📱" },
  { key: "engineering", label: "Engineering", emoji: "💻" },
  { key: "design", label: "Design", emoji: "🎨" },
];
const GROUNDED = new Set(["sales", "marketing", "finance", "operations", "customer-success"]);

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
// Vetri HUD
// ---------------------------------------------------------------

export function VetriHud({
  vitals,
  providers,
  counts,
}: {
  vitals: VetriVitals;
  providers: VetriProvider[];
  counts: VetriCounts;
}) {
  const router = useRouter();
  const [clock, setClock] = React.useState("");
  const [briefing, setBriefing] = React.useState<CeoBriefing | null>(null);
  const [reports, setReports] = React.useState<Record<string, StoredDeptReport>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    fetch("/api/company/reports")
      .then((r) => r.json())
      .then((d) => {
        setBriefing((d.briefing as CeoBriefing) ?? null);
        const map: Record<string, StoredDeptReport> = {};
        for (const r of (d.reports ?? []) as StoredDeptReport[]) map[r.deptKey] = r;
        setReports(map);
      })
      .catch(() => {});
  }, []);

  const achievement = vitals.achievementPct ?? 0;

  function talkToVetri() {
    window.dispatchEvent(new CustomEvent("vetri:talk"));
  }
  async function runAllShifts() {
    setBusy("shifts");
    try {
      let n = 0;
      for (const key of ["sales", "marketing", "finance", "operations"]) {
        try {
          await postJSON("/api/company/shift", { department: key });
          n++;
        } catch {
          /* keep going */
        }
      }
      toast.success(`${n} department heads filed fresh reports`);
      const d = await fetch("/api/company/reports").then((r) => r.json());
      const map: Record<string, StoredDeptReport> = {};
      for (const r of (d.reports ?? []) as StoredDeptReport[]) map[r.deptKey] = r;
      setReports(map);
    } finally {
      setBusy(null);
    }
  }
  async function rebrief() {
    setBusy("brief");
    try {
      const d = await postJSON<{ briefing: CeoBriefing }>("/api/command-center/briefing", {});
      setBriefing(d.briefing);
      toast.success("Vetri re-briefed from the latest reports");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-brief failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Top status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r from-primary/10 via-card to-cyan-500/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold tracking-wide">SYSTEM STATUS</span>
          <span className="text-emerald-600">OPTIMAL</span>
        </div>
        <div className="font-mono text-lg font-bold tabular-nums tracking-widest text-primary">{clock}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RadioTower className="h-3.5 w-3.5 text-primary" />
          {providers.filter((p) => p.connected).length} models online
        </div>
      </div>

      {/* Core + quick commands */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_1fr]">
        {/* Vitals */}
        <div className="space-y-4">
          <HudCard title="Business Vitals" icon={<Cpu className="h-4 w-4" />}>
            <div className="flex items-center gap-4">
              <Gauge value={achievement} label="of target" />
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{formatINR(vitals.revenueClosed, true)}</div>
                <div className="text-xs text-muted-foreground">
                  closed{vitals.monthlyTarget ? ` of ${formatINR(vitals.monthlyTarget, true)}` : ""}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Vital label="Pipeline" value={formatINR(vitals.pipelineValue, true)} />
              <Vital label="MRR" value={formatINR(vitals.mrr, true)} />
              <Vital label="Meetings" value={String(vitals.meetingsToday)} />
              <Vital label="Follow-ups" value={String(vitals.followUpsPending)} warn={vitals.missedFollowUps > 0} />
            </div>
          </HudCard>
        </div>

        {/* The Core */}
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-gradient-to-b from-primary/5 to-cyan-500/5 py-6">
          <VetriCore />
          <div className="mt-2 text-center">
            <div className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-3xl font-black tracking-[0.3em] text-transparent">
              VETRI
            </div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">AI Core · v3.0.0</div>
          </div>
          <Button onClick={talkToVetri} className="mt-4 gap-2 rounded-full px-6">
            <Mic className="h-4 w-4" /> Talk to Vetri
          </Button>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Say “Vetri” or clap twice — anytime.</p>
        </div>

        {/* Quick commands */}
        <div>
          <HudCard title="Quick Commands" icon={<Rocket className="h-4 w-4" />}>
            <div className="space-y-2">
              <Command icon={<Mic className="h-4 w-4" />} label="Talk to Vetri" onClick={talkToVetri} />
              <Command
                icon={busy === "shifts" ? <Play className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
                label="Run all department shifts"
                onClick={runAllShifts}
                disabled={busy !== null}
              />
              <Command
                icon={<Sparkles className="h-4 w-4" />}
                label="Re-brief the CEO"
                onClick={rebrief}
                disabled={busy !== null}
              />
              <Command
                icon={<Rocket className="h-4 w-4" />}
                label="Open Command Center"
                onClick={() => router.push("/command-center")}
              />
            </div>
          </HudCard>
        </div>
      </div>

      {/* Feed + agents + models */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live intelligence feed */}
        <HudCard title="Live Intelligence Feed" icon={<Activity className="h-4 w-4" />} live>
          {briefing ? (
            <div className="space-y-2.5 text-sm">
              {briefing.headline && <p className="font-medium">{briefing.headline}</p>}
              {briefing.focus && (
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-xs">
                    <span className="font-semibold">Focus: </span>
                    {briefing.focus}
                  </p>
                </div>
              )}
              {briefing.actions.slice(0, 3).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span>{a.action}</span>
                </div>
              ))}
              {briefing.risks.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {r}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Awaiting the CEO briefing — run shifts, then re-brief.</p>
          )}
        </HudCard>

        {/* Active agents */}
        <HudCard title="Active Agents" icon={<BrainCircuit className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2">
            {AGENTS.map((a) => {
              const active = GROUNDED.has(a.key);
              const hasReport = Boolean(reports[a.key]);
              return (
                <div key={a.key} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2">
                  <span className="text-base">{a.emoji}</span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{a.label}</div>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          hasReport ? "bg-emerald-500" : active ? "bg-cyan-500" : "bg-muted-foreground/40"
                        )}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {hasReport ? "Reported" : active ? "Active" : "Standby"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </HudCard>

        {/* Models + memory */}
        <div className="space-y-4">
          <HudCard title="LLM Status" icon={<RadioTower className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-1.5">
              {providers.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  <span className="truncate text-xs">{p.name}</span>
                </div>
              ))}
            </div>
          </HudCard>
          <HudCard title="Memory" icon={<Database className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <Vital label="Companies" value={String(counts.companies)} />
              <Vital label="Prospects" value={String(counts.prospects)} />
              <Vital label="Leads" value={String(counts.leads)} />
              <Vital label="Notes" value={String(counts.notes)} />
            </div>
          </HudCard>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

function VetriCore() {
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <div className="absolute inset-0 animate-[spin_24s_linear_infinite] rounded-full border-2 border-dashed border-primary/40" />
      <div className="absolute inset-4 animate-[spin_16s_linear_infinite] rounded-full border border-cyan-500/40 [animation-direction:reverse]" />
      <div className="absolute inset-8 animate-[spin_10s_linear_infinite] rounded-full border-2 border-primary/30 border-t-primary" />
      <div className="absolute inset-12 animate-pulse rounded-full bg-gradient-to-br from-primary/30 to-cyan-500/30 blur-md" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-500 shadow-lg shadow-primary/40">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
    </div>
  );
}

function HudCard({
  title,
  icon,
  children,
  live,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Vital({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-2.5 py-1.5", warn && "border-amber-500/40 bg-amber-500/5")}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", warn && "text-amber-600")}>{value}</div>
    </div>
  );
}

function Command({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

/** A circular progress gauge (0-100+). */
function Gauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (clamped / 100) * c;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="stroke-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums">{Math.round(value)}%</span>
        <span className="text-[8px] uppercase text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
