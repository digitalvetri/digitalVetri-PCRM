"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Briefcase, Check, Clock, Loader2, Plane, Plus, UserCheck, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { TeamChat } from "@/components/chat/team-chat";
import { formatINR, cn } from "@/lib/utils";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  code: string;
  designation: string | null;
  department: string | null;
  joinDate: string | null;
}
interface ProjectRow {
  id: string;
  name: string;
  company: string | null;
  status: string;
  value: number | null;
  dueDate: string | null;
  assignments: { userId: string; name: string; role: string | null }[];
}
interface LeaveRow {
  id: string;
  employee: string;
  email: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  reviewNote: string | null;
}
interface DashboardRow {
  id: string;
  name: string;
  email: string;
  code: string;
  designation: string | null;
  department: string | null;
  status: "PRESENT" | "CHECKED_OUT" | "LEAVE" | "ABSENT";
  checkIn: string | null;
  checkOut: string | null;
  openTasks: number;
  overdueTasks: number;
  attendanceRate: number | null;
}
interface Dashboard {
  headcount: number;
  presentToday: number;
  onLeaveToday: number;
  absentToday: number;
  pendingLeave: number;
  activeProjects: number;
  totalOpen: number;
  totalOverdue: number;
  avgRating: number | null;
  rows: DashboardRow[];
  risks: { id: string; name: string; reason: string }[];
}
interface TrackingRow {
  id: string;
  name: string;
  code: string;
  designation: string | null;
  daysPresent: number;
  totalMinutes: number;
  avgHoursPerDay: number;
  lateCount: number;
  avgCheckIn: string | null;
  tasksDone: number;
  spark: number[];
}
interface Tracking {
  days: number;
  dayKeys: string[];
  rows: TrackingRow[];
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

async function post(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "border-emerald-500/40 text-emerald-600",
  PENDING: "border-amber-500/40 text-amber-600",
  REJECTED: "border-red-500/40 text-red-600",
  ACTIVE: "border-primary/40 text-primary",
  COMPLETED: "border-emerald-500/40 text-emerald-600",
  ON_HOLD: "border-amber-500/40 text-amber-600",
};

export function TeamManager({ employees, projects, leaves, dashboard, tracking }: { employees: EmployeeRow[]; projects: ProjectRow[]; leaves: LeaveRow[]; dashboard: Dashboard; tracking: Tracking }) {
  const pendingLeave = leaves.filter((l) => l.status === "PENDING").length;
  return (
    <Tabs defaultValue="overview" className="animate-fade-in">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="tracking">Tracking</TabsTrigger>
        <TabsTrigger value="employees">Employees ({employees.length})</TabsTrigger>
        <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
        <TabsTrigger value="leave">Leave{pendingLeave ? ` (${pendingLeave})` : ""}</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        <OverviewTab dashboard={dashboard} />
      </TabsContent>
      <TabsContent value="tracking" className="mt-4">
        <TrackingTab tracking={tracking} />
      </TabsContent>
      <TabsContent value="employees" className="mt-4">
        <EmployeesTab employees={employees} projects={projects} />
      </TabsContent>
      <TabsContent value="projects" className="mt-4">
        <ProjectsTab projects={projects} employees={employees} />
      </TabsContent>
      <TabsContent value="leave" className="mt-4">
        <LeaveTab leaves={leaves} />
      </TabsContent>
      <TabsContent value="chat" className="mt-4">
        <p className="mb-3 text-sm text-muted-foreground">Company-wide channel — visible to you and every employee.</p>
        <TeamChat height="h-[60vh]" />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------
// Overview — executive dashboard
// ---------------------------------------------------------------

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

const DASH_STATUS: Record<DashboardRow["status"], { label: string; cls: string; dot: string }> = {
  PRESENT: { label: "Present", cls: "text-emerald-600 border-emerald-500/40", dot: "bg-emerald-500" },
  CHECKED_OUT: { label: "Checked out", cls: "text-blue-600 border-blue-500/40", dot: "bg-blue-500" },
  LEAVE: { label: "On leave", cls: "text-amber-600 border-amber-500/40", dot: "bg-amber-500" },
  ABSENT: { label: "Absent", cls: "text-muted-foreground border-border", dot: "bg-muted-foreground/40" },
};

function OverviewTab({ dashboard: d }: { dashboard: Dashboard }) {
  const present = d.rows.filter((r) => r.status === "PRESENT");
  const checkedOut = d.rows.filter((r) => r.status === "CHECKED_OUT");
  const leave = d.rows.filter((r) => r.status === "LEAVE");
  const absent = d.rows.filter((r) => r.status === "ABSENT");
  const ordered = [...present, ...checkedOut, ...leave, ...absent];

  if (d.headcount === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No employees yet. Create logins from the <span className="font-medium text-foreground">Employees</span> tab to see the live team dashboard here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<UserCheck className="h-4 w-4" />} tone="emerald" label="Present today" value={`${d.presentToday}/${d.headcount}`} hint={`${d.onLeaveToday} on leave · ${d.absentToday} absent`} />
        <KpiCard icon={<Clock className="h-4 w-4" />} tone={d.totalOverdue ? "amber" : "primary"} label="Open tasks" value={String(d.totalOpen)} hint={d.totalOverdue ? `${d.totalOverdue} overdue` : "on track"} />
        <KpiCard icon={<Briefcase className="h-4 w-4" />} tone="primary" label="Active projects" value={String(d.activeProjects)} hint={d.avgRating ? `${d.avgRating}★ avg review` : "no reviews yet"} />
        <KpiCard icon={<Plane className="h-4 w-4" />} tone={d.pendingLeave ? "amber" : "primary"} label="Leave to review" value={String(d.pendingLeave)} hint={d.pendingLeave ? "needs action" : "all clear"} />
      </div>

      {/* Risk flags */}
      {d.risks.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Needs your attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {d.risks.map((r) => (
                <span key={r.id} className="rounded-full border border-amber-500/40 bg-background px-3 py-1 text-xs">
                  <span className="font-medium">{r.name}</span> · <span className="text-muted-foreground">{r.reason}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> Today&apos;s team</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2">Status</th>
                <th className="py-2">Hours</th>
                <th className="py-2 text-center">Open</th>
                <th className="py-2 text-center">Overdue</th>
                <th className="py-2 text-right">Attendance 60d</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((r) => {
                const s = DASH_STATUS[r.status];
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.designation ?? r.code}{r.department ? ` · ${r.department}` : ""}</div>
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                        <span className="text-xs">{s.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{r.checkIn ? `${fmtTime(r.checkIn)}${r.checkOut ? ` – ${fmtTime(r.checkOut)}` : ""}` : "—"}</td>
                    <td className="py-2.5 text-center tabular-nums">{r.openTasks}</td>
                    <td className={cn("py-2.5 text-center tabular-nums", r.overdueTasks > 0 && "font-semibold text-red-600")}>{r.overdueTasks || "—"}</td>
                    <td className="py-2.5 text-right">
                      {r.attendanceRate != null ? (
                        <span className={cn("tabular-nums", r.attendanceRate < 60 ? "text-red-600" : r.attendanceRate < 80 ? "text-amber-600" : "text-emerald-600")}>{r.attendanceRate}%</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "amber" | "emerald" | "primary" }) {
  const toneCls = tone === "amber" ? "bg-amber-500/10 text-amber-600" : tone === "emerald" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary";
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneCls)}>{icon}</span>
        <div className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------
// Tracking — web-based time & productivity (honest signals only)
// ---------------------------------------------------------------

function TrackingTab({ tracking }: { tracking: Tracking }) {
  if (tracking.rows.length === 0) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No employees to track yet.</CardContent></Card>;
  }
  const maxSpark = Math.max(1, ...tracking.rows.flatMap((r) => r.spark));
  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Web-based tracking over the last {tracking.days} days — from check-in/out times and completed tasks.
        Punctuality flags check-ins after 10:00 IST. This does not capture screens or keystrokes (that needs a desktop agent).
      </p>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" /> Time &amp; productivity</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2 text-center">Days</th>
                <th className="py-2 text-right">Total hrs</th>
                <th className="py-2 text-right">Avg/day</th>
                <th className="py-2 text-center">Avg in</th>
                <th className="py-2 text-center">Late</th>
                <th className="py-2 text-center">Tasks done</th>
                <th className="py-2 pl-4">Last {tracking.days}d</th>
              </tr>
            </thead>
            <tbody>
              {tracking.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.designation ?? r.code}</div>
                  </td>
                  <td className="py-2.5 text-center tabular-nums">{r.daysPresent}</td>
                  <td className="py-2.5 text-right tabular-nums">{Math.round((r.totalMinutes / 60) * 10) / 10}h</td>
                  <td className="py-2.5 text-right tabular-nums">{r.avgHoursPerDay}h</td>
                  <td className="py-2.5 text-center tabular-nums text-muted-foreground">{r.avgCheckIn ?? "—"}</td>
                  <td className={cn("py-2.5 text-center tabular-nums", r.lateCount > 0 && "font-semibold text-amber-600")}>{r.lateCount || "—"}</td>
                  <td className="py-2.5 text-center tabular-nums">{r.tasksDone}</td>
                  <td className="py-2.5 pl-4">
                    <div className="flex h-8 items-end gap-0.5">
                      {r.spark.map((h, i) => (
                        <div key={i} title={`${h}h`} className="w-2 rounded-sm bg-primary/70" style={{ height: `${Math.max(3, (h / maxSpark) * 100)}%` }} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Employees
// ---------------------------------------------------------------

function EmployeesTab({ employees, projects }: { employees: EmployeeRow[]; projects: ProjectRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [manageId, setManageId] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding((o) => !o)}>
          <UserPlus className="h-4 w-4" /> {adding ? "Close" : "Add employee"}
        </Button>
      </div>
      {adding && <AddEmployeeForm onDone={() => { setAdding(false); router.refresh(); }} />}

      <Card>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No employees yet. Add your first one above.</p>
          ) : (
            <div className="divide-y">
              {employees.map((e) => (
                <div key={e.id}>
                  <button
                    onClick={() => setManageId((id) => (id === e.id ? null : e.id))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.email} · {e.designation ?? "—"}{e.department ? ` · ${e.department}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className={e.active ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground"}>
                      {e.active ? "Active" : "Inactive"}
                    </Badge>
                  </button>
                  {manageId === e.id && <ManageEmployee employee={e} projects={projects} onDone={() => router.refresh()} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManageEmployee({ employee, projects, onDone }: { employee: EmployeeRow; projects: ProjectRow[]; onDone: () => void }) {
  return (
    <div className="space-y-4 border-t bg-muted/20 p-4">
      <EmployeeDetail employeeId={employee.id} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <AssignTaskPanel employee={employee} onDone={onDone} />
        <AssignPanel employee={employee} projects={projects} onDone={onDone} />
        <SalaryPanel employee={employee} onDone={onDone} />
        <ReviewPanel employee={employee} onDone={onDone} />
      </div>
    </div>
  );
}

interface EmpDetail {
  attendanceRate: number | null;
  performance: { score: number; avgRating: number | null; attendanceRate: number | null };
  tasksDone: number;
  tasksOpen: number;
  tasks: { id: string; title: string; status: string; priority: string; dueDate: string | null }[];
  leaves: { id: string; type: string; startDate: string; endDate: string; status: string }[];
  salary: { id: string; month: string; netPay: number; status: string }[];
  reviews: { id: string; period: string; rating: number }[];
  projects: { id: string; name: string; status: string }[];
}

function EmployeeDetail({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = React.useState(false);
  const [d, setD] = React.useState<EmpDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    if (!open) {
      setOpen(true);
      if (!d) {
        setLoading(true);
        try {
          const res = await fetch(`/api/team/employees/${employeeId}`);
          const json = await res.json();
          if (res.ok) setD(json as EmpDetail);
        } finally {
          setLoading(false);
        }
      }
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="rounded-lg border bg-background">
      <button onClick={load} className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
        <span>Full details — attendance, tasks, performance</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "View"}</span>
      </button>
      {open && (
        <div className="border-t p-3">
          {loading || !d ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Performance" value={`${d.performance.score}`} />
                <Metric label="Attendance" value={d.attendanceRate != null ? `${d.attendanceRate}%` : "—"} />
                <Metric label="Tasks done" value={`${d.tasksDone}`} />
                <Metric label="Tasks open" value={`${d.tasksOpen}`} warn={d.tasksOpen > 0} />
              </div>
              {d.tasks.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasks</div>
                  <ul className="space-y-1">
                    {d.tasks.slice(0, 8).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className={cn(t.status === "DONE" && "text-muted-foreground line-through")}>{t.title}</span>
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[t.status] ?? "")}>{t.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {d.projects.length > 0 && (
                  <DetailList title="Projects" items={d.projects.map((p) => `${p.name} · ${p.status}`)} />
                )}
                {d.salary.length > 0 && (
                  <DetailList title="Recent salary" items={d.salary.slice(0, 4).map((s) => `${s.month} · ${formatINR(s.netPay)} · ${s.status}`)} />
                )}
                {d.reviews.length > 0 && (
                  <DetailList title="Reviews" items={d.reviews.slice(0, 4).map((r) => `${r.period} · ${r.rating}★`)} />
                )}
                {d.leaves.length > 0 && (
                  <DetailList title="Leave" items={d.leaves.slice(0, 4).map((l) => `${l.type} · ${fmtDate(l.startDate)} · ${l.status}`)} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-md border px-2.5 py-1.5", warn ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/30")}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", warn && "text-amber-600")}>{value}</div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="space-y-0.5 text-sm">
        {items.map((it, i) => <li key={i} className="text-muted-foreground">{it}</li>)}
      </ul>
    </div>
  );
}

function AssignTaskPanel({ employee, onDone }: { employee: EmployeeRow; onDone: () => void }) {
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [busy, setBusy] = React.useState(false);
  async function assign() {
    if (!title.trim()) return toast.error("Task title required");
    setBusy(true);
    try {
      await post("/api/team/tasks", { employeeId: employee.id, title, dueDate: dueDate || undefined, priority });
      toast.success("Task assigned");
      setTitle("");
      setDueDate("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MiniCard title="Assign task">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      <div className="flex gap-1.5">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 w-24 rounded-md border bg-background px-2 text-sm">
          {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <Button size="sm" onClick={assign} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign
      </Button>
    </MiniCard>
  );
}

function AssignPanel({ employee, projects, onDone }: { employee: EmployeeRow; projects: ProjectRow[]; onDone: () => void }) {
  const [projectId, setProjectId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function assign() {
    if (!projectId) return toast.error("Pick a project");
    setBusy(true);
    try {
      await post("/api/team/projects/assign", { projectId, userId: employee.id, role: role || undefined });
      toast.success("Assigned to project");
      setRole("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MiniCard title="Assign to project">
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
        <option value="">Select project…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)" className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      <Button size="sm" onClick={assign} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign
      </Button>
    </MiniCard>
  );
}

function SalaryPanel({ employee, onDone }: { employee: EmployeeRow; onDone: () => void }) {
  const [month, setMonth] = React.useState("");
  const [base, setBase] = React.useState("");
  const [allow, setAllow] = React.useState("");
  const [ded, setDed] = React.useState("");
  const [status, setStatus] = React.useState("DRAFT");
  const [busy, setBusy] = React.useState(false);
  async function save() {
    if (!month || !base) return toast.error("Month and base salary required");
    setBusy(true);
    try {
      const r = await post("/api/team/salary", {
        userId: employee.id,
        month,
        baseSalary: Number(base),
        allowances: allow ? Number(allow) : undefined,
        deductions: ded ? Number(ded) : undefined,
        status,
      });
      toast.success(`Salary saved · net ${formatINR(r.netPay)}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MiniCard title="Salary record">
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      <div className="grid grid-cols-3 gap-1.5">
        <input value={base} onChange={(e) => setBase(e.target.value)} type="number" placeholder="Base" className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
        <input value={allow} onChange={(e) => setAllow(e.target.value)} type="number" placeholder="Allow." className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
        <input value={ded} onChange={(e) => setDed(e.target.value)} type="number" placeholder="Deduct." className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
        <option value="DRAFT">Draft</option>
        <option value="PAID">Paid</option>
      </select>
      <Button size="sm" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save salary
      </Button>
    </MiniCard>
  );
}

function ReviewPanel({ employee, onDone }: { employee: EmployeeRow; onDone: () => void }) {
  const [period, setPeriod] = React.useState("");
  const [rating, setRating] = React.useState("4");
  const [strengths, setStrengths] = React.useState("");
  const [improvements, setImprovements] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function save() {
    if (!period) return toast.error("Period required (e.g. 2026-Q2)");
    setBusy(true);
    try {
      await post("/api/team/reviews", { userId: employee.id, period, rating: Number(rating), strengths: strengths || undefined, improvements: improvements || undefined });
      toast.success("Review added");
      setStrengths("");
      setImprovements("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MiniCard title="Performance review">
      <div className="flex gap-1.5">
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q2" className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" />
        <select value={rating} onChange={(e) => setRating(e.target.value)} className="h-9 w-16 rounded-md border bg-background px-2 text-sm">
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
        </select>
      </div>
      <input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Strengths" className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      <input value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="To improve" className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
      <Button size="sm" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Add review
      </Button>
    </MiniCard>
  );
}

// ---------------------------------------------------------------
// Projects
// ---------------------------------------------------------------

function ProjectsTab({ projects, employees }: { projects: ProjectRow[]; employees: EmployeeRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen((o) => !o)}>
          <Plus className="h-4 w-4" /> {open ? "Close" : "New project"}
        </Button>
      </div>
      {open && <CreateProjectForm onDone={() => { setOpen(false); router.refresh(); }} />}
      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[p.status])}>{p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.company ?? "Internal"}{p.value != null ? ` · ${formatINR(p.value)}` : ""}{p.dueDate ? ` · due ${fmtDate(p.dueDate)}` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {p.assignments.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No one assigned</span>
                  ) : (
                    p.assignments.map((a) => (
                      <ProjectMember key={a.userId} projectId={p.id} member={a} onDone={() => router.refresh()} />
                    ))
                  )}
                </div>
                <AssignToProject projectId={p.id} employees={employees} onDone={() => router.refresh()} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectMember({ projectId, member, onDone }: { projectId: string; member: { userId: string; name: string; role: string | null }; onDone: () => void }) {
  async function remove() {
    try {
      await post("/api/team/projects/assign", { projectId, userId: member.userId, remove: true });
      onDone();
    } catch {
      toast.error("Failed to remove");
    }
  }
  return (
    <Badge variant="secondary" className="gap-1">
      {member.name}{member.role ? ` · ${member.role}` : ""}
      <button onClick={remove} aria-label="Remove" className="ml-0.5 rounded hover:text-red-600"><X className="h-3 w-3" /></button>
    </Badge>
  );
}

function AssignToProject({ projectId, employees, onDone }: { projectId: string; employees: EmployeeRow[]; onDone: () => void }) {
  const [userId, setUserId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function assign() {
    if (!userId) return;
    setBusy(true);
    try {
      await post("/api/team/projects/assign", { projectId, userId });
      setUserId("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex gap-1.5">
      <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-8 flex-1 rounded-md border bg-background px-2 text-xs">
        <option value="">Assign employee…</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <Button size="sm" className="h-8" onClick={assign} disabled={busy || !userId}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function CreateProjectForm({ onDone }: { onDone: () => void }) {
  const statusId = React.useId();
  const [f, setF] = React.useState({ name: "", value: "", status: "ACTIVE", dueDate: "" });
  const [busy, setBusy] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name) return toast.error("Project name required");
    setBusy(true);
    try {
      await post("/api/team/projects", { name: f.name, value: f.value ? Number(f.value) : undefined, status: f.status, dueDate: f.dueDate || undefined });
      toast.success("Project created");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Project name *" value={f.name} onChange={(v) => setF((p) => ({ ...p, name: v }))} />
          <Field label="Value (₹, hidden from staff)" type="number" value={f.value} onChange={(v) => setF((p) => ({ ...p, value: v }))} />
          <div className="space-y-1.5">
            <Label htmlFor={statusId}>Status</Label>
            <select id={statusId} value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Due date" type="date" value={f.dueDate} onChange={(v) => setF((p) => ({ ...p, dueDate: v }))} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create project</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------
// Leave
// ---------------------------------------------------------------

function LeaveTab({ leaves }: { leaves: LeaveRow[] }) {
  const router = useRouter();
  if (leaves.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No leave requests.</p>;
  return (
    <div className="space-y-2">
      {leaves.map((l) => (
        <LeaveItem key={l.id} leave={l} onDone={() => router.refresh()} />
      ))}
    </div>
  );
}

function LeaveItem({ leave, onDone }: { leave: LeaveRow; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  async function review(status: "APPROVED" | "REJECTED") {
    setBusy(true);
    try {
      await post(`/api/team/leave/${leave.id}`, { status }, "PATCH");
      toast.success(status === "APPROVED" ? "Leave approved" : "Leave rejected");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{leave.employee}</span>
            <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[leave.status])}>{leave.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {leave.type} · {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)}{leave.reason ? ` · ${leave.reason}` : ""}
          </div>
        </div>
        {leave.status === "PENDING" && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => review("APPROVED")} disabled={busy}><Check className="h-4 w-4" /> Approve</Button>
            <Button size="sm" variant="outline" onClick={() => review("REJECTED")} disabled={busy}><X className="h-4 w-4" /> Reject</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------
// Shared: add-employee form + small helpers
// ---------------------------------------------------------------

function AddEmployeeForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({ name: "", email: "", password: "", employeeCode: "", designation: "", department: "", phone: "", joinDate: "", baseSalary: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.email || !f.password || !f.employeeCode) return toast.error("Name, email, password and code are required");
    setBusy(true);
    try {
      await post("/api/team/employees", {
        name: f.name, email: f.email, password: f.password, employeeCode: f.employeeCode,
        designation: f.designation || undefined, department: f.department || undefined,
        phone: f.phone || undefined, joinDate: f.joinDate || undefined, baseSalary: f.baseSalary ? Number(f.baseSalary) : undefined,
      });
      toast.success(`${f.name} can now sign in with their email and password.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New employee</CardTitle>
        <p className="text-xs text-muted-foreground">You set the starting email &amp; password — the employee can change their password after signing in.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name *" value={f.name} onChange={set("name")} />
          <Field label="Email (login) *" type="email" value={f.email} onChange={set("email")} />
          <Field label="Temporary password *" value={f.password} onChange={set("password")} placeholder="min 8 characters" />
          <Field label="Employee code *" value={f.employeeCode} onChange={set("employeeCode")} placeholder="DV-E-001" />
          <Field label="Designation" value={f.designation} onChange={set("designation")} />
          <Field label="Department" value={f.department} onChange={set("department")} />
          <Field label="Phone" value={f.phone} onChange={set("phone")} />
          <Field label="Join date" type="date" value={f.joinDate} onChange={set("joinDate")} />
          <Field label="Base salary (₹/month)" type="number" value={f.baseSalary} onChange={set("baseSalary")} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create employee</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary" />
    </div>
  );
}
