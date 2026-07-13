"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, AlertTriangle, BrainCircuit, Cpu, Database, Maximize2, Minimize2, Mic, Play, RadioTower, Rocket, Sparkles, Target } from "lucide-react";
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
  { key: "people", label: "People", emoji: "👥" },
  { key: "social", label: "Social", emoji: "📱" },
  { key: "engineering", label: "Engineering", emoji: "💻" },
];
const GROUNDED = new Set(["sales", "marketing", "finance", "operations", "customer-success", "people"]);

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

// ---------------------------------------------------------------
// Vetri HUD — dark immersive command deck
// ---------------------------------------------------------------

export function VetriHud({ vitals, providers, counts }: { vitals: VetriVitals; providers: VetriProvider[]; counts: VetriCounts }) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [clock, setClock] = React.useState("");
  const [fullscreen, setFullscreen] = React.useState(false);
  const [briefing, setBriefing] = React.useState<CeoBriefing | null>(null);
  const [reports, setReports] = React.useState<Record<string, StoredDeptReport>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  }

  React.useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const loadReports = React.useCallback(async () => {
    try {
      const d = await fetch("/api/company/reports").then((r) => r.json());
      setBriefing((d.briefing as CeoBriefing) ?? null);
      const map: Record<string, StoredDeptReport> = {};
      for (const r of (d.reports ?? []) as StoredDeptReport[]) map[r.deptKey] = r;
      setReports(map);
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const achievement = vitals.achievementPct ?? 0;
  const online = providers.filter((p) => p.connected).length;

  function talkToVetri() {
    window.dispatchEvent(new CustomEvent("vetri:talk"));
  }
  async function runAllShifts() {
    setBusy("shifts");
    try {
      let n = 0;
      for (const key of ["sales", "marketing", "finance", "operations", "people"]) {
        try {
          await postJSON("/api/company/shift", { department: key });
          n++;
        } catch {
          /* keep going */
        }
      }
      toast.success(`${n} department heads filed fresh reports`);
      await loadReports();
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
    <div
      ref={rootRef}
      className={cn(
        "animate-fade-in flex flex-col overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-950 via-[#0a1120] to-slate-950 p-4 text-slate-200 ring-1 ring-cyan-500/20 sm:p-6",
        fullscreen ? "min-h-screen rounded-none" : "min-h-[82vh]"
      )}
    >
      {/* Top status strip */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/10 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-semibold tracking-[0.2em] text-slate-300">SYSTEM STATUS</span>
          <span className="font-bold text-emerald-400">OPTIMAL</span>
        </div>
        <div className="font-mono text-base font-bold tabular-nums tracking-[0.3em] text-cyan-300">{clock}</div>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1.5">
            <RadioTower className="h-3.5 w-3.5 text-cyan-400" /> {online} online
          </span>
          <button onClick={toggleFullscreen} title={fullscreen ? "Exit full screen" : "Full screen"} aria-label="Toggle full screen" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-cyan-300">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Core + vitals + commands */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr_1fr]">
        <div className="space-y-4">
          <HudCard title="Business Vitals" icon={<Cpu className="h-4 w-4" />}>
            <div className="flex items-center gap-4">
              <Gauge value={achievement} label="of target" />
              <div className="space-y-0.5 text-sm">
                <div className="font-semibold text-cyan-100">{formatINR(vitals.revenueClosed, true)}</div>
                <div className="text-xs text-slate-400">closed{vitals.monthlyTarget ? ` of ${formatINR(vitals.monthlyTarget, true)}` : ""}</div>
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

        {/* The core */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent py-6">
          <VetriCore />
          <div className="text-center">
            <div className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-3xl font-black tracking-[0.35em] text-transparent">VETRI</div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">AI Core · v3.0.0</div>
          </div>
          <button
            onClick={talkToVetri}
            className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-transform hover:scale-105"
          >
            <Mic className="h-4 w-4" /> Talk to Vetri
          </button>
          <p className="text-[11px] text-slate-500">Tap to talk or type — Tamil or English.</p>
        </div>

        <div>
          <HudCard title="Quick Commands" icon={<Rocket className="h-4 w-4" />}>
            <div className="space-y-2">
              <Command icon={<Mic className="h-4 w-4" />} label="Talk to Vetri" onClick={talkToVetri} />
              <Command icon={<Play className="h-4 w-4" />} label="Run all department shifts" onClick={runAllShifts} disabled={busy !== null} busy={busy === "shifts"} />
              <Command icon={<Sparkles className="h-4 w-4" />} label="Re-brief the CEO" onClick={rebrief} disabled={busy !== null} busy={busy === "brief"} />
              <Command icon={<Rocket className="h-4 w-4" />} label="Open Command Center" onClick={() => router.push("/command-center")} />
            </div>
          </HudCard>
        </div>
      </div>

      {/* Feed + agents + models */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <HudCard title="Live Intelligence Feed" icon={<Activity className="h-4 w-4" />} live>
          {briefing ? (
            <div className="space-y-2.5 text-sm">
              {briefing.headline && <p className="font-medium text-cyan-100">{briefing.headline}</p>}
              {briefing.focus && (
                <div className="flex items-start gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2.5">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  <p className="text-xs text-slate-200"><span className="font-semibold">Focus: </span>{briefing.focus}</p>
                </div>
              )}
              {briefing.actions.slice(0, 3).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-semibold text-cyan-300">{i + 1}</span>
                  <span>{a.action}</span>
                </div>
              ))}
              {briefing.risks.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {r}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Awaiting the CEO briefing — run shifts, then re-brief.</p>
          )}
        </HudCard>

        <HudCard title="Active Agents" icon={<BrainCircuit className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2">
            {AGENTS.map((a) => {
              const active = GROUNDED.has(a.key);
              const hasReport = Boolean(reports[a.key]);
              return (
                <div key={a.key} className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-2.5 py-2">
                  <span className="text-base">{a.emoji}</span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-slate-200">{a.label}</div>
                    <div className="flex items-center gap-1">
                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", hasReport ? "bg-emerald-400" : active ? "bg-cyan-400" : "bg-slate-600")} />
                      <span className="text-[10px] text-slate-500">{hasReport ? "Reported" : active ? "Active" : "Standby"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </HudCard>

        <div className="space-y-4">
          <HudCard title="LLM Status" icon={<RadioTower className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-1.5">
              {providers.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 rounded-md border border-slate-700/50 px-2 py-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.connected ? "bg-emerald-400" : "bg-slate-600")} />
                  <span className="truncate text-xs text-slate-300">{p.name}</span>
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
    <div className="relative flex h-44 w-44 items-center justify-center">
      <div className="absolute inset-0 animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-cyan-400/40" />
      <div className="absolute inset-3 animate-[spin_18s_linear_infinite] rounded-full border border-blue-400/30 [animation-direction:reverse]" />
      <div className="absolute inset-7 animate-[spin_11s_linear_infinite] rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
      <div className="absolute inset-12 animate-pulse rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/30 blur-xl" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_30px_rgba(34,211,238,0.6)]">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
    </div>
  );
}

function HudCard({ title, icon, children, live }: { title: string; icon: React.ReactNode; children: React.ReactNode; live?: boolean }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-900/50 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span className="text-cyan-400">{icon}</span> {title}
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Vital({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-2.5 py-1.5", warn ? "border-amber-500/40 bg-amber-500/10" : "border-slate-700/50 bg-slate-800/30")}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", warn ? "text-amber-400" : "text-cyan-100")}>{value}</div>
    </div>
  );
}

function Command({ icon, label, onClick, disabled, busy }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10 disabled:opacity-50"
    >
      <span className={cn("text-cyan-400", busy && "animate-pulse")}>{icon}</span> {label}
    </button>
  );
}

function Gauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (clamped / 100) * c;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-slate-700" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="stroke-cyan-400 transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-cyan-100">{Math.round(value)}%</span>
        <span className="text-[8px] uppercase text-slate-500">{label}</span>
      </div>
    </div>
  );
}
