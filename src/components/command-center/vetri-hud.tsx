"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, AlertTriangle, BrainCircuit, Cpu, Database, Maximize2, Minimize2, Mic, Play, RadioTower, Rocket, Shield, Sparkles, Target } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { primeSpeech } from "@/lib/speech";

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
// Vetri HUD — cinematic holographic command deck
// ---------------------------------------------------------------

export function VetriHud({ vitals, providers, counts }: { vitals: VetriVitals; providers: VetriProvider[]; counts: VetriCounts }) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [clock, setClock] = React.useState("");
  const [date, setDate] = React.useState("");
  const [fullscreen, setFullscreen] = React.useState(false);
  const [briefing, setBriefing] = React.useState<CeoBriefing | null>(null);
  const [reports, setReports] = React.useState<Record<string, StoredDeptReport>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setDate(now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
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

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  }
  function talkToVetri() {
    primeSpeech();
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
        "vetri-hud animate-fade-in relative flex flex-col overflow-hidden rounded-2xl p-4 text-slate-200 sm:p-6",
        fullscreen ? "min-h-screen rounded-none" : "min-h-[86vh]"
      )}
      style={{ background: "radial-gradient(1200px 700px at 50% -10%, #0b2233 0%, #060d18 55%, #03060d 100%)" }}
    >
      {/* Scanline + grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(circle at 50% 40%, black 30%, transparent 80%)",
        }}
      />
      <style>{`
        @keyframes vetri-spin3d { from { transform: rotateX(-18deg) rotateY(0deg); } to { transform: rotateX(-18deg) rotateY(360deg); } }
        @keyframes vetri-scan { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>

      {/* Top bar */}
      <div className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 pb-3">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-cyan-400" />
          <span className="text-sm font-bold tracking-[0.25em] text-cyan-100">VETRI AI CORE SYSTEM</span>
        </div>
        <div className="text-center">
          <div className="font-mono text-xl font-bold tabular-nums tracking-[0.35em] text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">{clock}</div>
          <div className="text-[10px] tracking-[0.3em] text-slate-500">{date}</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            {online} ONLINE
          </span>
          <button onClick={toggleFullscreen} title={fullscreen ? "Exit full screen" : "Full screen"} aria-label="Full screen" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-cyan-300">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="relative z-10 grid flex-1 gap-4 lg:grid-cols-[1fr_1.35fr_1fr]">
        {/* Left */}
        <div className="space-y-4">
          <Panel title="Business Vitals" icon={<Cpu className="h-3.5 w-3.5" />}>
            <div className="flex items-center justify-around">
              <RadialGauge value={achievement} label="TARGET" sub={formatINR(vitals.revenueClosed, true)} />
              <RadialGauge value={vitals.monthlyTarget ? Math.min(100, Math.round((vitals.pipelineValue / vitals.monthlyTarget) * 100)) : 0} label="PIPELINE" sub={formatINR(vitals.pipelineValue, true)} tone="blue" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="MRR" value={formatINR(vitals.mrr, true)} />
              <Stat label="Meetings" value={String(vitals.meetingsToday)} />
              <Stat label="Follow-ups" value={String(vitals.followUpsPending)} warn={vitals.missedFollowUps > 0} />
              <Stat label="Open tasks" value={String(vitals.openTasks)} />
            </div>
          </Panel>
          <Panel title="Live Intelligence Feed" icon={<Activity className="h-3.5 w-3.5" />} live>
            {briefing ? (
              <div className="space-y-2 text-xs">
                {briefing.headline && <p className="font-medium text-cyan-100">{briefing.headline}</p>}
                {briefing.focus && (
                  <div className="flex items-start gap-1.5 rounded border border-cyan-500/25 bg-cyan-500/10 p-2">
                    <Target className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />
                    <span><span className="font-semibold">Focus: </span>{briefing.focus}</span>
                  </div>
                )}
                {briefing.actions.slice(0, 2).map((a, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-300">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[9px] font-semibold text-cyan-300">{i + 1}</span>
                    <span>{a.action}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Run shifts, then re-brief for the CEO feed.</p>
            )}
          </Panel>
        </div>

        {/* Center — 3D holographic core */}
        <div className="flex flex-col items-center justify-center gap-5">
          <HoloCore achievement={achievement} />
          <div className="text-center">
            <div className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-4xl font-black tracking-[0.35em] text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.5)]">VETRI</div>
            <div className="text-[10px] uppercase tracking-[0.5em] text-slate-500">AI Core · v3.0.0</div>
          </div>
          <button onClick={talkToVetri} className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(34,211,238,0.45)] transition-transform hover:scale-105">
            <Mic className="h-4 w-4" /> Talk to Vetri
          </button>
          <p className="text-[11px] text-slate-500">Tap to talk or type — Tamil or English.</p>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <Panel title="Quick Commands" icon={<Rocket className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <Command icon={<Mic className="h-4 w-4" />} label="Talk to Vetri" onClick={talkToVetri} />
              <Command icon={<Play className="h-4 w-4" />} label="Run all department shifts" onClick={runAllShifts} disabled={busy !== null} busy={busy === "shifts"} />
              <Command icon={<Sparkles className="h-4 w-4" />} label="Re-brief the CEO" onClick={rebrief} disabled={busy !== null} busy={busy === "brief"} />
              <Command icon={<Rocket className="h-4 w-4" />} label="Command Center" onClick={() => router.push("/command-center")} />
            </div>
          </Panel>
          <Panel title="Memory Bank" icon={<Database className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <FileRow label="Companies" value={counts.companies} />
              <FileRow label="Prospects" value={counts.prospects} />
              <FileRow label="Discovered leads" value={counts.leads} />
              <FileRow label="Notes" value={counts.notes} />
            </div>
          </Panel>
          <Panel title="LLM Status" icon={<RadioTower className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-2 gap-1.5">
              {providers.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 rounded border border-slate-700/50 px-2 py-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.connected ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-600")} />
                  <span className="truncate text-xs text-slate-300">{p.name}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Active agents strip */}
      <div className="relative z-10 mt-4">
        <Panel title="Active Agents" icon={<BrainCircuit className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AGENTS.map((a) => {
              const active = GROUNDED.has(a.key);
              const hasReport = Boolean(reports[a.key]);
              return (
                <div key={a.key} className="flex items-center gap-2 rounded border border-slate-700/50 bg-slate-800/30 px-2.5 py-2">
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
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// The 3D holographic core (CSS 3D — a rotating wireframe sphere + arc reactor)
// ---------------------------------------------------------------

function HoloCore({ achievement }: { achievement: number }) {
  const meridians = [0, 30, 60, 90, 120, 150];
  return (
    <div className="relative flex h-56 w-56 items-center justify-center" style={{ perspective: "900px" }}>
      {/* Outer static ring + progress arc */}
      <svg viewBox="0 0 224 224" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="112" cy="112" r="106" fill="none" className="stroke-cyan-500/15" strokeWidth="2" />
        <circle cx="112" cy="112" r="106" fill="none" className="stroke-cyan-400" strokeWidth="2" strokeLinecap="round" strokeDasharray={2 * Math.PI * 106} strokeDashoffset={(2 * Math.PI * 106) * (1 - Math.min(100, achievement) / 100)} style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.8))" }} />
      </svg>
      <div className="absolute inset-6 animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-cyan-400/25" />

      {/* Rotating wireframe sphere (meridians) */}
      <div className="relative h-40 w-40" style={{ transformStyle: "preserve-3d", animation: "vetri-spin3d 14s linear infinite" }}>
        {meridians.map((deg) => (
          <div key={deg} className="absolute inset-0 rounded-full border border-cyan-400/30" style={{ transform: `rotateY(${deg}deg)` }} />
        ))}
        {[-40, 0, 40].map((deg) => (
          <div key={`lat${deg}`} className="absolute left-1/2 top-1/2 rounded-full border border-blue-400/20" style={{ width: 160 * Math.cos((deg * Math.PI) / 180), height: 160 * Math.cos((deg * Math.PI) / 180), transform: `translate(-50%,-50%) translateZ(${80 * Math.sin((deg * Math.PI) / 180)}px) rotateX(90deg)` }} />
        ))}
      </div>

      {/* Arc reactor core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-pulse rounded-full bg-cyan-400/30 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-300/60 bg-gradient-to-br from-cyan-300/40 to-blue-600/40 shadow-[0_0_40px_rgba(34,211,238,0.7)]">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-200 to-blue-400 shadow-[inset_0_0_10px_rgba(255,255,255,0.7)]" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------

/** A holographic panel with corner brackets. */
function Panel({ title, icon, children, live }: { title: string; icon: React.ReactNode; children: React.ReactNode; live?: boolean }) {
  return (
    <div className="relative rounded-lg border border-cyan-500/20 bg-slate-950/40 p-3.5 backdrop-blur-sm">
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-cyan-400/60" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-cyan-400/60" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-cyan-400/60" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-cyan-400/60" />
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-300/80">
          <span className="text-cyan-400">{icon}</span> {title}
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function RadialGauge({ value, label, sub, tone = "cyan" }: { value: number; label: string; sub?: string; tone?: "cyan" | "blue" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 30;
  const c = 2 * Math.PI * r;
  const stroke = tone === "blue" ? "stroke-blue-400" : "stroke-cyan-400";
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[76px] w-[76px]">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" strokeWidth="5" className="stroke-slate-700/60" />
          <circle cx="38" cy="38" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className={cn(stroke, "transition-all duration-700")} strokeDasharray={c} strokeDashoffset={c - (clamped / 100) * c} style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-cyan-100">{Math.round(value)}%</div>
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
      {sub && <div className="text-[11px] font-semibold text-cyan-100">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded border px-2 py-1.5", warn ? "border-amber-500/40 bg-amber-500/10" : "border-slate-700/50 bg-slate-800/20")}>
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", warn ? "text-amber-400" : "text-cyan-100")}>{value}</div>
    </div>
  );
}

function FileRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5 last:border-0 last:pb-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="font-mono text-sm font-bold tabular-nums text-cyan-200">{value.toLocaleString("en-IN")}</span>
    </div>
  );
}

function Command({ icon, label, onClick, disabled, busy }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex w-full items-center gap-2.5 rounded border border-slate-700/50 bg-slate-800/20 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10 disabled:opacity-50">
      <span className={cn("text-cyan-400", busy && "animate-pulse")}>{icon}</span> {label}
    </button>
  );
}
