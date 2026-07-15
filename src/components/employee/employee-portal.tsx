"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  ListChecks,
  LogIn,
  LogOut,
  Loader2,
  Plane,
  Plus,
  RotateCcw,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatINR, cn } from "@/lib/utils";

// ---------------------------------------------------------------
// Serialized types (mirror /me/page.tsx)
// ---------------------------------------------------------------

interface TaskItem { id: string; title: string; description: string | null; status: string; priority: string; dueDate: string | null }

interface Data {
  profile: { employeeCode: string; designation: string | null; department: string | null; phone: string | null; joinDate: string | null } | null;
  assignments: {
    id: string;
    role: string | null;
    project: { id: string; name: string; description: string | null; status: string; startDate: string | null; dueDate: string | null };
  }[];
  todayAttendance: { checkIn: string | null; checkOut: string | null; status: string } | null;
  recentAttendance: { date: string; status: string; checkIn: string | null; checkOut: string | null }[];
  leaves: { id: string; type: string; startDate: string; endDate: string; status: string; reason: string | null }[];
  salary: { id: string; month: string; baseSalary: number; allowances: number; deductions: number; netPay: number; status: string; paidAt: string | null }[];
  reviews: { id: string; period: string; rating: number; strengths: string | null; improvements: string | null; comments: string | null; createdAt: string }[];
  tasks: TaskItem[];
  performance: { attendanceRate: number | null; avgRating: number | null; projectCount: number; score: number; reviewCount: number };
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

const STATUS_TONE: Record<string, string> = {
  APPROVED: "text-emerald-600 border-emerald-500/40",
  PENDING: "text-amber-600 border-amber-500/40",
  REJECTED: "text-red-600 border-red-500/40",
  PAID: "text-emerald-600 border-emerald-500/40",
  DRAFT: "text-muted-foreground",
  ACTIVE: "text-primary border-primary/40",
  COMPLETED: "text-emerald-600 border-emerald-500/40",
};
const PRIORITY_TONE: Record<string, string> = {
  URGENT: "text-red-600 border-red-500/40 bg-red-500/5",
  HIGH: "text-amber-600 border-amber-500/40 bg-amber-500/5",
  LOW: "text-muted-foreground",
};

export function EmployeePortal({ name, data }: { name: string; data: Data }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const first = name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  async function post(url: string, body?: unknown, method = "POST") {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function checkAction(kind: "checkin" | "checkout") {
    setBusy(kind);
    try {
      await post(`/api/me/${kind}`);
      toast.success(kind === "checkin" ? "Checked in. Have a great day!" : "Checked out. See you tomorrow!");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function setTaskStatus(id: string, status: "TODO" | "IN_PROGRESS" | "DONE") {
    setBusy(`task-${id}`);
    try {
      await post(`/api/me/tasks/${id}`, { status }, "PATCH");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update task");
    } finally {
      setBusy(null);
    }
  }

  const checkedIn = Boolean(data.todayAttendance?.checkIn);
  const checkedOut = Boolean(data.todayAttendance?.checkOut);
  const doneCount = data.tasks.filter((t) => t.status === "DONE").length;
  const openCount = data.tasks.length - doneCount;
  const pct = data.tasks.length ? Math.round((doneCount / data.tasks.length) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hero + performance */}
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="relative bg-gradient-to-br from-primary/90 to-blue-700 p-6 text-white">
            <p className="text-sm text-blue-100">{greeting},</p>
            <h1 className="text-2xl font-bold">{first} 👋</h1>
            {data.profile && (
              <p className="mt-1 text-sm text-blue-100/90">
                {data.profile.designation ?? "Team member"}
                {data.profile.department ? ` · ${data.profile.department}` : ""} · {data.profile.employeeCode}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!checkedIn ? (
                <Button onClick={() => checkAction("checkin")} disabled={busy !== null} variant="secondary">
                  {busy === "checkin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  <span className="ml-1">Check in</span>
                </Button>
              ) : !checkedOut ? (
                <Button onClick={() => checkAction("checkout")} disabled={busy !== null} variant="secondary">
                  {busy === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  <span className="ml-1">Check out</span>
                </Button>
              ) : (
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">Day complete ✓</span>
              )}
              {checkedIn && (
                <span className="text-xs text-blue-100">
                  <Clock className="mr-1 inline h-3 w-3" /> In {fmtTime(data.todayAttendance?.checkIn ?? null)}
                  {checkedOut ? ` · Out ${fmtTime(data.todayAttendance?.checkOut ?? null)}` : ""}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <ScoreRing value={data.performance.score} />
            <div className="space-y-0.5 text-sm">
              <div className="font-semibold">Performance</div>
              <div className="text-muted-foreground">Attendance {data.performance.attendanceRate ?? "—"}%</div>
              <div className="text-muted-foreground">
                {data.performance.avgRating ? `${data.performance.avgRating.toFixed(1)}★` : "No reviews"} · {data.performance.projectCount} projects
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<ListChecks className="h-4 w-4" />} label="Open tasks" value={String(openCount)} tone={openCount > 0 ? "amber" : "emerald"} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Tasks done" value={String(doneCount)} tone="emerald" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Attendance" value={data.performance.attendanceRate != null ? `${data.performance.attendanceRate}%` : "—"} />
        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Projects" value={String(data.assignments.length)} />
      </div>

      {/* My Tasks — the workspace */}
      <TasksCard tasks={data.tasks} busy={busy} onStatus={setTaskStatus} onAdd={() => router.refresh()} post={post} pct={pct} doneCount={doneCount} />

      {/* My Projects */}
      <Section title="My Projects" icon={<Briefcase className="h-4 w-4" />}>
        {data.assignments.length === 0 ? (
          <Empty>No projects assigned yet.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.assignments.map((a) => (
              <div key={a.id} className="rounded-xl border p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{a.project.name}</p>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[a.project.status])}>{a.project.status}</Badge>
                </div>
                {a.role && <p className="text-xs text-muted-foreground">Your role: {a.role}</p>}
                {a.project.description && <p className="mt-1 text-sm text-muted-foreground">{a.project.description}</p>}
                {a.project.dueDate && (
                  <p className="mt-1 text-xs text-muted-foreground"><CalendarDays className="mr-1 inline h-3 w-3" /> Due {fmtDate(a.project.dueDate)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Leave */}
      <Section title="Leave" icon={<Plane className="h-4 w-4" />}>
        <LeaveForm onDone={() => router.refresh()} />
        {data.leaves.length > 0 && (
          <ul className="mt-3 divide-y">
            {data.leaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{l.type} · {fmtDate(l.startDate)} → {fmtDate(l.endDate)}</span>
                <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[l.status])}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Salary */}
      <Section title="My Salary Slips" icon={<Wallet className="h-4 w-4" />}>
        {data.salary.length === 0 ? (
          <Empty>No salary slips yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Base</th>
                  <th className="py-2 text-right">Allowances</th>
                  <th className="py-2 text-right">Deductions</th>
                  <th className="py-2 text-right">Net pay</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.salary.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.month}</td>
                    <td className="py-2 text-right tabular-nums">{formatINR(s.baseSalary)}</td>
                    <td className="py-2 text-right tabular-nums">{formatINR(s.allowances)}</td>
                    <td className="py-2 text-right tabular-nums">{formatINR(s.deductions)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatINR(s.netPay)}</td>
                    <td className="py-2 text-right"><Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[s.status])}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Performance reviews */}
      <Section title="My Performance Reviews" icon={<Star className="h-4 w-4" />}>
        {data.reviews.length === 0 ? (
          <Empty>No reviews yet. Your manager will add these.</Empty>
        ) : (
          <div className="space-y-3">
            {data.reviews.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.period}</span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                    ))}
                  </span>
                </div>
                {r.strengths && <p className="mt-1 text-sm"><span className="text-emerald-600">Strengths: </span>{r.strengths}</p>}
                {r.improvements && <p className="text-sm"><span className="text-amber-600">Improve: </span>{r.improvements}</p>}
                {r.comments && <p className="mt-1 text-sm text-muted-foreground">{r.comments}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------
// Tasks — the productive workspace
// ---------------------------------------------------------------

function TasksCard({
  tasks,
  busy,
  onStatus,
  onAdd,
  post,
  pct,
  doneCount,
}: {
  tasks: TaskItem[];
  busy: string | null;
  onStatus: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void;
  onAdd: () => void;
  post: (url: string, body?: unknown, method?: string) => Promise<unknown>;
  pct: number;
  doneCount: number;
}) {
  const [filter, setFilter] = React.useState<"open" | "all">("open");
  const shown = filter === "open" ? tasks.filter((t) => t.status !== "DONE") : tasks;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-primary"><ListChecks className="h-4 w-4" /></span> My Tasks
            <span className="text-sm font-normal text-muted-foreground">{doneCount}/{tasks.length} done</span>
          </CardTitle>
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            {(["open", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1 font-medium capitalize transition-colors", filter === f ? "bg-background shadow-sm" : "text-muted-foreground")}>{f}</button>
            ))}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <AddTaskRow post={post} onAdd={onAdd} />
        {shown.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {filter === "open" ? "No open tasks — you're all caught up! 🎉" : "No tasks yet. Add one above or your manager will assign them."}
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((t) => {
              const done = t.status === "DONE";
              const inProg = t.status === "IN_PROGRESS";
              const loading = busy === `task-${t.id}`;
              return (
                <li key={t.id} className={cn("flex items-start gap-3 rounded-xl border p-3 transition-colors", done && "bg-muted/30")}>
                  <button
                    onClick={() => onStatus(t.id, done ? "TODO" : "DONE")}
                    disabled={loading}
                    aria-label={done ? "Reopen" : "Mark done"}
                    className="mt-0.5 shrink-0"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : inProg ? <CircleDot className="h-5 w-5 text-amber-500" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{t.title}</span>
                      {inProg && <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-600">In progress</Badge>}
                      {t.priority && t.priority !== "MEDIUM" && <Badge variant="outline" className={cn("text-[10px]", PRIORITY_TONE[t.priority])}>{t.priority}</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    {t.dueDate && <p className="mt-0.5 text-xs text-muted-foreground"><CalendarDays className="mr-1 inline h-3 w-3" /> Due {fmtDate(t.dueDate)}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!done && !inProg && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onStatus(t.id, "IN_PROGRESS")} disabled={loading}>Start</Button>}
                    {done && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onStatus(t.id, "TODO")} disabled={loading}><RotateCcw className="h-3.5 w-3.5" /></Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AddTaskRow({ post, onAdd }: { post: (url: string, body?: unknown, method?: string) => Promise<unknown>; onAdd: () => void }) {
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [busy, setBusy] = React.useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await post("/api/me/tasks", { title, dueDate: due || undefined, priority });
      setTitle("");
      setDue("");
      toast.success("Task added");
      onAdd();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for yourself…" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
        {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------

function LeaveForm({ onDone }: { onDone: () => void }) {
  const typeId = React.useId();
  const startId = React.useId();
  const endId = React.useId();
  const reasonId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [type, setType] = React.useState("CASUAL");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [reason, setReason] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) return toast.error("Pick start and end dates");
    setBusy(true);
    try {
      const res = await fetch("/api/me/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, startDate: start, endDate: end, reason: reason || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Leave request submitted");
      setOpen(false);
      setStart("");
      setEnd("");
      setReason("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plane className="h-4 w-4" /> Request leave</Button>;
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={typeId}>Type</Label>
        <select id={typeId} value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          {["CASUAL", "SICK", "EARNED", "UNPAID", "OTHER"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={reasonId}>Reason (optional)</Label>
        <input id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={startId}>From</Label>
        <input id={startId} type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={endId}>To</Label>
        <input id={endId} type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "amber" | "emerald" }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone === "amber" ? "bg-amber-500/10 text-amber-600" : tone === "emerald" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary")}>{icon}</span>
        <div>
          <div className="text-lg font-bold tabular-nums">{value}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><span className="text-primary">{icon}</span> {title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>;
}

function ScoreRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (clamped / 100) * c;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="stroke-primary transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">{Math.round(value)}</div>
    </div>
  );
}
