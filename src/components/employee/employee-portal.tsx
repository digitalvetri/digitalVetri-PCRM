"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  LogIn,
  LogOut,
  Loader2,
  Plane,
  Star,
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
  tasks: { id: string; title: string; description: string | null; status: string; priority: string; dueDate: string | null }[];
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
  URGENT: "text-red-600 border-red-500/40",
  HIGH: "text-amber-600 border-amber-500/40",
  LOW: "text-muted-foreground",
};

export function EmployeePortal({ name, data }: { name: string; data: Data }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const first = name.split(" ")[0];

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
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

  async function toggleTask(id: string) {
    setBusy(`task-${id}`);
    try {
      await post(`/api/me/tasks/${id}/toggle`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update task");
    } finally {
      setBusy(null);
    }
  }

  const checkedIn = Boolean(data.todayAttendance?.checkIn);
  const checkedOut = Boolean(data.todayAttendance?.checkOut);
  const openTasks = data.tasks.filter((t) => t.status !== "DONE").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 to-cyan-500/10 p-6">
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-2xl font-bold">{first} 👋</h1>
            {data.profile && (
              <p className="mt-1 text-sm text-muted-foreground">
                {data.profile.designation ?? "Team member"}
                {data.profile.department ? ` · ${data.profile.department}` : ""} · {data.profile.employeeCode}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!checkedIn ? (
                <Button onClick={() => checkAction("checkin")} disabled={busy !== null}>
                  {busy === "checkin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  <span className="ml-1">Check in</span>
                </Button>
              ) : !checkedOut ? (
                <Button variant="outline" onClick={() => checkAction("checkout")} disabled={busy !== null}>
                  {busy === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  <span className="ml-1">Check out</span>
                </Button>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Day complete ✓</Badge>
              )}
              {checkedIn && (
                <span className="text-xs text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  In {fmtTime(data.todayAttendance?.checkIn ?? null)}
                  {checkedOut ? ` · Out ${fmtTime(data.todayAttendance?.checkOut ?? null)}` : ""}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <ScoreRing value={data.performance.score} />
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Performance</div>
              <div className="text-muted-foreground">
                Attendance {data.performance.attendanceRate ?? "—"}%
              </div>
              <div className="text-muted-foreground">
                Reviews {data.performance.avgRating ? `${data.performance.avgRating.toFixed(1)}★` : "—"} · {data.performance.projectCount} projects
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Tasks — assigned by the admin */}
      <Section title={`My Tasks${openTasks ? ` · ${openTasks} open` : ""}`} icon={<ListChecks className="h-4 w-4" />}>
        {data.tasks.length === 0 ? (
          <Empty>No tasks assigned yet. Your manager will add them here.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.tasks.map((t) => {
              const done = t.status === "DONE";
              return (
                <li key={t.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <button
                    onClick={() => toggleTask(t.id)}
                    disabled={busy === `task-${t.id}`}
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                    className="mt-0.5 shrink-0"
                  >
                    {busy === `task-${t.id}` ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground transition-colors hover:text-primary" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{t.title}</span>
                      {t.priority && t.priority !== "MEDIUM" && (
                        <Badge variant="outline" className={cn("text-[10px]", PRIORITY_TONE[t.priority])}>{t.priority}</Badge>
                      )}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    {t.dueDate && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <CalendarDays className="mr-1 inline h-3 w-3" /> Due {fmtDate(t.dueDate)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* My Projects — names only, never the value */}
      <Section title="My Projects" icon={<Briefcase className="h-4 w-4" />}>
        {data.assignments.length === 0 ? (
          <Empty>No projects assigned yet.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.assignments.map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{a.project.name}</p>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[a.project.status])}>{a.project.status}</Badge>
                </div>
                {a.role && <p className="text-xs text-muted-foreground">Your role: {a.role}</p>}
                {a.project.description && <p className="mt-1 text-sm text-muted-foreground">{a.project.description}</p>}
                {a.project.dueDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <CalendarDays className="mr-1 inline h-3 w-3" /> Due {fmtDate(a.project.dueDate)}
                  </p>
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
                <span>
                  {l.type} · {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                </span>
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
                    <td className="py-2 text-right">
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[s.status])}>{s.status}</Badge>
                    </td>
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
          <Empty>No reviews yet. Your manager will add these in the AI Company.</Empty>
        ) : (
          <div className="space-y-3">
            {data.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
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
    if (!start || !end) {
      toast.error("Pick start and end dates");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, startDate: start, endDate: end, reason: reason || undefined }),
      });
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
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plane className="h-4 w-4" /> Request leave
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={typeId}>Type</Label>
        <select
          id={typeId}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {["CASUAL", "SICK", "EARNED", "UNPAID", "OTHER"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
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
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-primary">{icon}</span> {title}
        </CardTitle>
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
