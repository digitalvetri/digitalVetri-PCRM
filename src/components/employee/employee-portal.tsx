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
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Loader2,
  Plane,
  Plus,
  RotateCcw,
  Star,
  Sparkles,
  Sun,
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

const QUOTES = [
  "Small daily improvements are the key to staggering long-term results.",
  "Focus on being productive instead of busy.",
  "Great things are done by a series of small things brought together.",
  "The way to get started is to quit talking and begin doing.",
  "Quality means doing it right when no one is looking.",
  "Discipline is choosing between what you want now and what you want most.",
  "Done is better than perfect — then make it better.",
];

type TabKey = "dashboard" | "tasks" | "attendance" | "projects" | "leave" | "payslips" | "reviews";

export function EmployeePortal({ name, data }: { name: string; data: Data }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("dashboard");
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
  const openTasks = data.tasks.filter((t) => t.status !== "DONE");
  const openCount = openTasks.length;
  const pct = data.tasks.length ? Math.round((doneCount / data.tasks.length) * 100) : 0;
  const pendingLeave = data.leaves.filter((l) => l.status === "PENDING").length;

  const nav: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "tasks", label: "My Tasks", icon: <ListChecks className="h-4 w-4" />, badge: openCount || undefined },
    { key: "attendance", label: "Attendance", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "projects", label: "Projects", icon: <Briefcase className="h-4 w-4" />, badge: data.assignments.length || undefined },
    { key: "leave", label: "Leave", icon: <Plane className="h-4 w-4" />, badge: pendingLeave || undefined },
    { key: "payslips", label: "Payslips", icon: <Wallet className="h-4 w-4" /> },
    { key: "reviews", label: "Reviews", icon: <Star className="h-4 w-4" /> },
  ];

  return (
    <div className="animate-fade-in lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
      {/* Left workspace nav */}
      <aside className="mb-4 lg:mb-0">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full",
                tab === n.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className={cn(tab === n.key ? "" : "text-muted-foreground")}>{n.icon}</span>
              <span className="whitespace-nowrap">{n.label}</span>
              {n.badge ? (
                <span className={cn("ml-auto hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold lg:inline-block", tab === n.key ? "bg-white/20" : "bg-primary/10 text-primary")}>{n.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 space-y-5">
        {tab === "dashboard" && (
          <DashboardTab
            first={first}
            greeting={greeting}
            data={data}
            busy={busy}
            checkedIn={checkedIn}
            checkedOut={checkedOut}
            onCheck={checkAction}
            openCount={openCount}
            doneCount={doneCount}
            pct={pct}
            onGoTo={setTab}
          />
        )}

        {tab === "tasks" && (
          <>
            <PageTitle icon={<ListChecks className="h-5 w-5" />} title="My Tasks" subtitle="Everything on your plate, in one place." />
            <TasksCard tasks={data.tasks} busy={busy} onStatus={setTaskStatus} onAdd={() => router.refresh()} post={post} pct={pct} doneCount={doneCount} />
          </>
        )}

        {tab === "attendance" && (
          <>
            <PageTitle icon={<CalendarDays className="h-5 w-5" />} title="Attendance" subtitle="Your check-ins for the last few weeks." />
            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <AttendanceCalendar records={data.recentAttendance} />
              <RecentAttendance records={data.recentAttendance} />
            </div>
          </>
        )}

        {tab === "projects" && (
          <>
            <PageTitle icon={<Briefcase className="h-5 w-5" />} title="Projects" subtitle="What you're assigned to." />
            <ProjectsGrid assignments={data.assignments} />
          </>
        )}

        {tab === "leave" && (
          <>
            <PageTitle icon={<Plane className="h-5 w-5" />} title="Leave" subtitle="Request time off and track approvals." />
            <Card className="shadow-sm">
              <CardContent className="pt-5">
                <LeaveForm onDone={() => router.refresh()} />
                {data.leaves.length > 0 && (
                  <ul className="mt-3 divide-y">
                    {data.leaves.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span>{l.type} · {fmtDate(l.startDate)} → {fmtDate(l.endDate)}{l.reason ? ` · ${l.reason}` : ""}</span>
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[l.status])}>{l.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {tab === "payslips" && (
          <>
            <PageTitle icon={<Wallet className="h-5 w-5" />} title="Payslips" subtitle="Your salary records." />
            <SalaryTable salary={data.salary} />
          </>
        )}

        {tab === "reviews" && (
          <>
            <PageTitle icon={<Star className="h-5 w-5" />} title="Performance Reviews" subtitle="Feedback from your manager." />
            <ReviewsList reviews={data.reviews} />
          </>
        )}

        <FooterQuote />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------

function DashboardTab({
  first,
  greeting,
  data,
  busy,
  checkedIn,
  checkedOut,
  onCheck,
  openCount,
  doneCount,
  pct,
  onGoTo,
}: {
  first: string;
  greeting: string;
  data: Data;
  busy: string | null;
  checkedIn: boolean;
  checkedOut: boolean;
  onCheck: (k: "checkin" | "checkout") => void;
  openCount: number;
  doneCount: number;
  pct: number;
  onGoTo: (t: TabKey) => void;
}) {
  const worked = workedMinutes(data.todayAttendance);
  const month = monthlySummary(data.recentAttendance);
  const todayTasks = data.tasks.filter((t) => t.status !== "DONE" && isToday(t.dueDate));
  const overdue = data.tasks.filter((t) => t.status !== "DONE" && isPast(t.dueDate)).length;

  return (
    <>
      {/* Hero */}
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
              <Button onClick={() => onCheck("checkin")} disabled={busy !== null} variant="secondary">
                {busy === "checkin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                <span className="ml-1">Check in</span>
              </Button>
            ) : !checkedOut ? (
              <Button onClick={() => onCheck("checkout")} disabled={busy !== null} variant="secondary">
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

      {/* Four hero metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          tone="primary"
          label="Working hours"
          value={worked != null ? fmtDuration(worked) : "—"}
          hint={checkedIn ? (checkedOut ? "Today · logged" : "Today · running") : "Not checked in"}
          progress={worked != null ? Math.min(100, Math.round((worked / 480) * 100)) : 0}
        />
        <MetricCard
          icon={<Sun className="h-4 w-4" />}
          tone={checkedIn ? "emerald" : "muted"}
          label="Attendance"
          value={checkedIn ? (checkedOut ? "Done" : "Present") : "Awaiting"}
          hint={data.performance.attendanceRate != null ? `${data.performance.attendanceRate}% last 60d` : "—"}
        />
        <MetricCard
          icon={<ListChecks className="h-4 w-4" />}
          tone={openCount > 0 ? "amber" : "emerald"}
          label="Task progress"
          value={`${pct}%`}
          hint={`${doneCount}/${data.tasks.length} done${overdue ? ` · ${overdue} overdue` : ""}`}
          progress={pct}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          tone="primary"
          label="This month"
          value={`${month.present}d`}
          hint={`${month.present} present · ${month.leave} leave`}
        />
      </div>

      {/* Two-column: schedule + calendar */}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><span className="text-primary"><CalendarDays className="h-4 w-4" /></span> Today&apos;s schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <TodaySchedule checkIn={data.todayAttendance?.checkIn ?? null} tasks={todayTasks} onGoTo={onGoTo} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><span className="text-primary"><Sparkles className="h-4 w-4" /></span> Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickAction icon={<ListChecks className="h-5 w-5" />} label="My tasks" onClick={() => onGoTo("tasks")} />
                <QuickAction icon={<Plane className="h-5 w-5" />} label="Request leave" onClick={() => onGoTo("leave")} />
                <QuickAction icon={<Wallet className="h-5 w-5" />} label="Payslips" onClick={() => onGoTo("payslips")} />
                <QuickAction icon={<Briefcase className="h-5 w-5" />} label="Projects" onClick={() => onGoTo("projects")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <AttendanceCalendar records={data.recentAttendance} />
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <ScoreRing value={data.performance.score} />
              <div className="space-y-0.5 text-sm">
                <div className="font-semibold">Performance score</div>
                <div className="text-muted-foreground">Attendance {data.performance.attendanceRate ?? "—"}%</div>
                <div className="text-muted-foreground">
                  {data.performance.avgRating ? `${data.performance.avgRating.toFixed(1)}★` : "No reviews"} · {data.performance.projectCount} projects
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------
// Working-hours / month / calendar helpers
// ---------------------------------------------------------------

function workedMinutes(today: Data["todayAttendance"]): number | null {
  if (!today?.checkIn) return null;
  const start = new Date(today.checkIn).getTime();
  const end = today.checkOut ? new Date(today.checkOut).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function monthlySummary(records: Data["recentAttendance"]) {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  let present = 0;
  let leave = 0;
  for (const r of records) {
    const d = new Date(r.date);
    if (d.getFullYear() !== y || d.getMonth() !== mo) continue;
    if (r.status === "PRESENT" || r.status === "HALF_DAY" || r.status === "WFH") present++;
    else if (r.status === "LEAVE") leave++;
  }
  return { present, leave };
}

const isToday = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const isPast = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime() < n.getTime();
};

const ATT_TONE: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white",
  WFH: "bg-emerald-500 text-white",
  HALF_DAY: "bg-amber-400 text-white",
  LEAVE: "bg-blue-500 text-white",
  ABSENT: "bg-red-400 text-white",
};

function AttendanceCalendar({ records }: { records: Data["recentAttendance"] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map = new Map<number, string>();
  for (const r of records) {
    const d = new Date(r.date);
    if (d.getFullYear() === year && d.getMonth() === month) map.set(d.getDate(), r.status);
  }
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const today = now.getDate();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><span className="text-primary"><CalendarDays className="h-4 w-4" /></span> {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const status = map.get(d);
            const tone = status ? ATT_TONE[status] : "";
            const isTodayCell = d === today;
            return (
              <div
                key={i}
                title={status ? `${d}: ${status}` : String(d)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs font-medium",
                  tone || "text-muted-foreground",
                  !status && isTodayCell && "ring-2 ring-primary",
                  status && isTodayCell && "ring-2 ring-offset-1 ring-primary",
                )}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Legend color="bg-emerald-500" label="Present" />
          <Legend color="bg-amber-400" label="Half day" />
          <Legend color="bg-blue-500" label="Leave" />
          <Legend color="bg-red-400" label="Absent" />
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded-full", color)} /> {label}</span>;
}

function TodaySchedule({ checkIn, tasks, onGoTo }: { checkIn: string | null; tasks: TaskItem[]; onGoTo: (t: TabKey) => void }) {
  const items: { time: string; label: string; tone: string }[] = [];
  if (checkIn) items.push({ time: fmtTime(checkIn), label: "Checked in", tone: "emerald" });
  for (const t of tasks) items.push({ time: t.dueDate ? "Due today" : "Anytime", label: t.title, tone: t.priority === "URGENT" || t.priority === "HIGH" ? "amber" : "primary" });

  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Nothing scheduled for today.{" "}
        <button onClick={() => onGoTo("tasks")} className="font-medium text-primary hover:underline">Plan your day →</button>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", it.tone === "emerald" ? "bg-emerald-500" : it.tone === "amber" ? "bg-amber-500" : "bg-primary")} />
            {i < items.length - 1 && <span className="w-px flex-1 bg-border" />}
          </div>
          <div className="pb-1">
            <div className="text-xs text-muted-foreground">{it.time}</div>
            <div className="text-sm font-medium">{it.label}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/40 hover:shadow-sm">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
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
// Section content blocks (used by tabs)
// ---------------------------------------------------------------

function ProjectsGrid({ assignments }: { assignments: Data["assignments"] }) {
  if (assignments.length === 0) return <Card className="shadow-sm"><CardContent className="py-8"><Empty>No projects assigned yet.</Empty></CardContent></Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {assignments.map((a) => (
        <Card key={a.id} className="shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{a.project.name}</p>
              <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[a.project.status])}>{a.project.status}</Badge>
            </div>
            {a.role && <p className="text-xs text-muted-foreground">Your role: {a.role}</p>}
            {a.project.description && <p className="mt-1 text-sm text-muted-foreground">{a.project.description}</p>}
            {a.project.dueDate && (
              <p className="mt-2 text-xs text-muted-foreground"><CalendarDays className="mr-1 inline h-3 w-3" /> Due {fmtDate(a.project.dueDate)}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentAttendance({ records }: { records: Data["recentAttendance"] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-base">Recent days</CardTitle></CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <Empty>No attendance recorded yet.</Empty>
        ) : (
          <ul className="divide-y">
            {records.slice(0, 12).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{fmtDate(r.date)}</span>
                <span className="text-xs text-muted-foreground">{fmtTime(r.checkIn)} – {fmtTime(r.checkOut)}</span>
                <Badge variant="outline" className={cn("text-[10px]", r.status === "PRESENT" || r.status === "WFH" ? "text-emerald-600 border-emerald-500/40" : r.status === "LEAVE" ? "text-blue-600 border-blue-500/40" : r.status === "HALF_DAY" ? "text-amber-600 border-amber-500/40" : "text-red-600 border-red-500/40")}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SalaryTable({ salary }: { salary: Data["salary"] }) {
  if (salary.length === 0) return <Card className="shadow-sm"><CardContent className="py-8"><Empty>No salary slips yet.</Empty></CardContent></Card>;
  return (
    <Card className="shadow-sm">
      <CardContent className="overflow-x-auto pt-5">
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
            {salary.map((s) => (
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
      </CardContent>
    </Card>
  );
}

function ReviewsList({ reviews }: { reviews: Data["reviews"] }) {
  if (reviews.length === 0) return <Card className="shadow-sm"><CardContent className="py-8"><Empty>No reviews yet. Your manager will add these.</Empty></CardContent></Card>;
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <Card key={r.id} className="shadow-sm">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------

function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <div>
        <h1 className="text-xl font-bold leading-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function FooterQuote() {
  const q = QUOTES[new Date().getDate() % QUOTES.length];
  return (
    <p className="pt-2 text-center text-xs italic text-muted-foreground">&ldquo;{q}&rdquo;</p>
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

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "amber" | "emerald" | "primary" | "muted";
  progress?: number;
}) {
  const toneCls =
    tone === "amber" ? "bg-amber-500/10 text-amber-600" :
    tone === "emerald" ? "bg-emerald-500/10 text-emerald-600" :
    tone === "muted" ? "bg-muted text-muted-foreground" :
    "bg-primary/10 text-primary";
  const barCls =
    tone === "amber" ? "bg-amber-500" :
    tone === "emerald" ? "bg-emerald-500" :
    "bg-primary";
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneCls)}>{icon}</span>
        </div>
        <div className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        {progress != null && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", barCls)} style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </CardContent>
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
