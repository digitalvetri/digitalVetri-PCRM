"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  ListChecks,
  LogIn,
  LogOut,
  Loader2,
  Menu,
  MessageSquare,
  Plane,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  Star,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { TeamChat } from "@/components/chat/team-chat";
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
    project: {
      id: string;
      name: string;
      description: string | null;
      status: string;
      startDate: string | null;
      dueDate: string | null;
      company: string | null;
      team: { id: string; name: string; role: string | null }[];
    };
  }[];
  todayAttendance: { checkIn: string | null; checkOut: string | null; status: string } | null;
  recentAttendance: { date: string; status: string; checkIn: string | null; checkOut: string | null }[];
  leaves: { id: string; type: string; startDate: string; endDate: string; status: string; reason: string | null }[];
  salary: { id: string; month: string; baseSalary: number; allowances: number; deductions: number; netPay: number; status: string; paidAt: string | null }[];
  reviews: { id: string; period: string; rating: number; strengths: string | null; improvements: string | null; comments: string | null; createdAt: string }[];
  tasks: TaskItem[];
  announcements: { id: string; title: string; body: string; pinned: boolean; author: string; createdAt: string }[];
  timesheet: { id: string; projectId: string | null; date: string; hours: number; note: string | null }[];
  goals: { id: string; title: string; detail: string | null; target: number; current: number; unit: string | null; dueDate: string | null; status: string }[];
  holidays: { id: string; date: string; name: string }[];
  notifications: { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string }[];
  leaveBalances: { type: string; allowance: number; used: number; remaining: number }[];
  articles: { id: string; title: string; category: string | null; author: string; updatedAt: string }[];
  performance: { attendanceRate: number | null; avgRating: number | null; projectCount: number; score: number; reviewCount: number };
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
const initials = (name: string) => name.split(" ").map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

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

type TabKey = "dashboard" | "assistant" | "tasks" | "timesheet" | "calendar" | "attendance" | "projects" | "goals" | "knowledge" | "chat" | "leave" | "payslips" | "reviews" | "reports" | "settings";

export function EmployeePortal({ name, email, data }: { name: string; email: string; data: Data }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("dashboard");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
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

  const activeGoals = data.goals.filter((g) => g.status === "ACTIVE").length;
  const nav: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "assistant", label: "Ask Vetri", icon: <Sparkles className="h-4 w-4" /> },
    { key: "tasks", label: "My Tasks", icon: <ListChecks className="h-4 w-4" />, badge: openCount || undefined },
    { key: "timesheet", label: "Timesheet", icon: <Timer className="h-4 w-4" /> },
    { key: "calendar", label: "Calendar", icon: <CalendarRange className="h-4 w-4" /> },
    { key: "attendance", label: "Attendance", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "projects", label: "Projects", icon: <Briefcase className="h-4 w-4" />, badge: data.assignments.length || undefined },
    { key: "goals", label: "Goals", icon: <Target className="h-4 w-4" />, badge: activeGoals || undefined },
    { key: "knowledge", label: "Knowledge", icon: <BookOpen className="h-4 w-4" /> },
    { key: "chat", label: "Team Chat", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "leave", label: "Leave", icon: <Plane className="h-4 w-4" />, badge: pendingLeave || undefined },
    { key: "payslips", label: "Payslips", icon: <Wallet className="h-4 w-4" /> },
    { key: "reviews", label: "Reviews", icon: <Star className="h-4 w-4" /> },
    { key: "reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
  ];

  const activeItem = nav.find((n) => n.key === tab);
  const overdueCount = data.tasks.filter((t) => t.status !== "DONE" && isPast(t.dueDate)).length;
  const attention: { label: string; onClick: () => void }[] = [];
  if (overdueCount > 0) attention.push({ label: `${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}`, onClick: () => setTab("tasks") });
  if (!checkedIn) attention.push({ label: "You haven't checked in today", onClick: () => setTab("dashboard") });
  if (pendingLeave > 0) attention.push({ label: `${pendingLeave} leave request pending`, onClick: () => setTab("leave") });

  const navList = (
    <nav className="flex flex-col gap-1 px-3">
      {nav.map((n) => {
        const active = tab === n.key;
        return (
          <button
            key={n.key}
            onClick={() => { setTab(n.key); setSidebarOpen(false); }}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
              active
                ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/25"
                : "text-sidebar-foreground hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {active && <span className="absolute -left-3 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-white" style={{ width: 3 }} />}
            <span className={cn("shrink-0 transition-transform duration-200", active ? "" : "group-hover:scale-110")}>{n.icon}</span>
            <span className="truncate">{n.label}</span>
            {n.badge ? (
              <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold", active ? "bg-white/25 text-white" : "bg-primary/20 text-white/80")}>{n.badge}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border/60 px-5 text-white">
          <Logo tileSize={32} subtitle="Employee" />
        </div>
        <div className="flex-1 overflow-y-auto py-3">{navList}</div>
        <div className="flex items-center gap-3 border-t border-sidebar-border/60 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-xs font-bold text-white shadow-lg shadow-primary/30">{initials(name)}</span>
          <div className="min-w-0 text-xs text-sidebar-foreground">
            <div className="truncate font-medium text-white">{name}</div>
            <div className="truncate">{data.profile?.designation ?? "Team member"}</div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar animate-in slide-in-from-left duration-200">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border/60 px-5 text-white">
              <Logo tileSize={30} subtitle="Employee" />
              <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" className="rounded-md p-1 text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">{navList}</div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="-ml-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted lg:hidden"><Menu className="h-5 w-5" /></button>
            <div>
              <h1 className="text-base font-semibold leading-tight">{activeItem?.label}</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">{greeting}, {first}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsBell items={attention} notifications={data.notifications} onGoTo={setTab} />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-none">{name}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>

        <main className="relative flex-1 p-4 sm:p-6">
          {/* Ambient brand glow behind the content */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72 bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent" />
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative mx-auto min-w-0 max-w-6xl space-y-5"
          >
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

        {tab === "assistant" && (
          <>
            <PageTitle icon={<Sparkles className="h-5 w-5" />} title="Ask Vetri" subtitle="Your AI assistant — ask about your tasks, leave, hours and more." />
            <AssistantTab first={first} />
          </>
        )}

        {tab === "tasks" && (
          <>
            <PageTitle icon={<ListChecks className="h-5 w-5" />} title="My Tasks" subtitle="Everything on your plate, in one place." />
            <TasksCard tasks={data.tasks} busy={busy} onStatus={setTaskStatus} onAdd={() => router.refresh()} post={post} pct={pct} doneCount={doneCount} />
          </>
        )}

        {tab === "timesheet" && (
          <>
            <PageTitle icon={<Timer className="h-5 w-5" />} title="Timesheet" subtitle="Log your hours by day and project." />
            <TimesheetTab entries={data.timesheet} assignments={data.assignments} post={post} onChange={() => router.refresh()} />
          </>
        )}

        {tab === "calendar" && (
          <>
            <PageTitle icon={<CalendarRange className="h-5 w-5" />} title="Calendar" subtitle="Tasks, leave and holidays in one view." />
            <CalendarTab data={data} onGoTo={setTab} />
          </>
        )}

        {tab === "attendance" && (
          <>
            <PageTitle icon={<CalendarDays className="h-5 w-5" />} title="Attendance" subtitle="Your check-ins and upcoming holidays." />
            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <AttendanceCalendar records={data.recentAttendance} holidays={data.holidays} />
              <div className="space-y-5">
                <RecentAttendance records={data.recentAttendance} />
                <HolidaysCard holidays={data.holidays} />
              </div>
            </div>
          </>
        )}

        {tab === "projects" && (
          <>
            <PageTitle icon={<Briefcase className="h-5 w-5" />} title="Projects" subtitle="What you're assigned to." />
            <ProjectsSection assignments={data.assignments} timesheet={data.timesheet} />
          </>
        )}

        {tab === "goals" && (
          <>
            <PageTitle icon={<Target className="h-5 w-5" />} title="Goals & OKRs" subtitle="Set targets and track your progress." />
            <GoalsTab goals={data.goals} post={post} onChange={() => router.refresh()} />
          </>
        )}

        {tab === "knowledge" && (
          <>
            <PageTitle icon={<BookOpen className="h-5 w-5" />} title="Knowledge Base" subtitle="Team docs, SOPs and how-tos." />
            <KnowledgeTab articles={data.articles} />
          </>
        )}

        {tab === "reports" && (
          <>
            <PageTitle icon={<BarChart3 className="h-5 w-5" />} title="My Reports" subtitle="Your hours and productivity trends." />
            <ReportsTab data={data} />
          </>
        )}

        {tab === "settings" && (
          <>
            <PageTitle icon={<Settings className="h-5 w-5" />} title="Settings" subtitle="Your profile and account security." />
            <SettingsTab name={name} email={email} profile={data.profile} />
          </>
        )}

        {tab === "chat" && (
          <>
            <PageTitle icon={<MessageSquare className="h-5 w-5" />} title="Team Chat" subtitle="One shared channel for the whole team." />
            <TeamChat />
          </>
        )}

        {tab === "leave" && (
          <>
            <PageTitle icon={<Plane className="h-5 w-5" />} title="Leave" subtitle="Request time off and track approvals." />
            <LeaveBalances balances={data.leaveBalances} />
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

          </motion.div>
          <div className="relative mx-auto mt-5 max-w-6xl"><FooterQuote /></div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Notifications bell
// ---------------------------------------------------------------

function NotificationsBell({ items, notifications, onGoTo }: { items: { label: string; onClick: () => void }[]; notifications: Data["notifications"]; onGoTo: (t: TabKey) => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;
  const dot = unread > 0 || items.length > 0;

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAllRead() {
    try { await fetch("/api/me/notifications", { method: "POST" }); router.refresh(); } catch { /* best-effort */ }
  }

  const timeAgo = (iso: string) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted">
        <Bell className="h-5 w-5" />
        {dot && <span className="absolute right-1 top-1 flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread > 0 ? unread : ""}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-xl border bg-card shadow-card-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length > 0 && (
              <div className="border-b bg-amber-500/[0.04]">
                {items.map((it, i) => (
                  <button key={`a-${i}`} onClick={() => { it.onClick(); setOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> {it.label}
                  </button>
                ))}
              </div>
            )}
            {notifications.length === 0 && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => { if (n.link) onGoTo(n.link as TabKey); setOpen(false); }}
                      className={cn("flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted", !n.read && "bg-primary/[0.03]")}
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{n.title}</span>
                        {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                        <span className="block text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------

function AnnouncementsCard({ items }: { items: Data["announcements"] }) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><span className="text-primary"><Bell className="h-4 w-4" /></span> Announcements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 4).map((a) => (
          <div key={a.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              {a.pinned && <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">Pinned</Badge>}
              <span className="font-medium">{a.title}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{a.author} · {fmtDate(a.createdAt)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
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
      <Card className="overflow-hidden border-0 shadow-card-lg">
        <div className="bg-brand-mesh relative overflow-hidden p-6 text-white sm:p-7">
          {/* decorative orbs */}
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/[0.07] blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold backdrop-blur-sm ring-1 ring-white/20">{initials(first + " " + (data.profile?.employeeCode ?? ""))}</span>
              <div>
                <p className="text-sm text-white/70">{greeting},</p>
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{first} 👋</h1>
                {data.profile && (
                  <p className="mt-0.5 text-sm text-white/70">
                    {data.profile.designation ?? "Team member"}
                    {data.profile.department ? ` · ${data.profile.department}` : ""} · {data.profile.employeeCode}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-right text-xs text-white/80 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="font-semibold text-white">{new Date().toLocaleDateString("en-IN", { weekday: "long" })}</div>
              <div>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long" })}</div>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            {!checkedIn ? (
              <Button onClick={() => onCheck("checkin")} disabled={busy !== null} className="bg-white font-semibold text-primary shadow-lg hover:bg-white/90">
                {busy === "checkin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                <span className="ml-1">Check in</span>
              </Button>
            ) : !checkedOut ? (
              <Button onClick={() => onCheck("checkout")} disabled={busy !== null} className="bg-white font-semibold text-primary shadow-lg hover:bg-white/90">
                {busy === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                <span className="ml-1">Check out</span>
              </Button>
            ) : (
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20">Day complete ✓</span>
            )}
            {checkedIn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90 ring-1 ring-white/15">
                <Clock className="h-3 w-3" /> In {fmtTime(data.todayAttendance?.checkIn ?? null)}
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

      {/* Announcements */}
      {data.announcements.length > 0 && <AnnouncementsCard items={data.announcements} />}

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
                <QuickAction icon={<MessageSquare className="h-5 w-5" />} label="Team chat" onClick={() => onGoTo("chat")} />
                <QuickAction icon={<Plane className="h-5 w-5" />} label="Request leave" onClick={() => onGoTo("leave")} />
                <QuickAction icon={<Wallet className="h-5 w-5" />} label="Payslips" onClick={() => onGoTo("payslips")} />
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
    if (r.status === "PRESENT" || r.status === "HALF_DAY") present++;
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
  HALF_DAY: "bg-amber-400 text-white",
  LEAVE: "bg-blue-500 text-white",
  ABSENT: "bg-red-400 text-white",
  HOLIDAY: "bg-muted-foreground/30 text-foreground",
};

function AttendanceCalendar({ records, holidays = [] }: { records: Data["recentAttendance"]; holidays?: Data["holidays"] }) {
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
  const holidayMap = new Map<number, string>();
  for (const h of holidays) {
    const d = new Date(h.date);
    if (d.getFullYear() === year && d.getMonth() === month) holidayMap.set(d.getDate(), h.name);
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
            const holiday = holidayMap.get(d);
            const tone = status ? ATT_TONE[status] : holiday ? "bg-violet-500 text-white" : "";
            const isTodayCell = d === today;
            return (
              <div
                key={i}
                title={holiday ? `${d}: ${holiday}` : status ? `${d}: ${status}` : String(d)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs font-medium",
                  tone || "text-muted-foreground",
                  !status && !holiday && isTodayCell && "ring-2 ring-primary",
                  (status || holiday) && isTodayCell && "ring-2 ring-offset-1 ring-primary",
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
          <Legend color="bg-violet-500" label="Holiday" />
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
    <button onClick={onClick} className="group flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 text-primary transition-all duration-300 group-hover:from-primary group-hover:to-blue-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30">{icon}</span>
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
  const [view, setView] = React.useState<"list" | "board">("list");
  const shown = filter === "open" ? tasks.filter((t) => t.status !== "DONE") : tasks;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-primary"><ListChecks className="h-4 w-4" /></span> My Tasks
            <span className="text-sm font-normal text-muted-foreground">{doneCount}/{tasks.length} done</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              <button onClick={() => setView("list")} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", view === "list" ? "bg-background shadow-sm" : "text-muted-foreground")}><List className="h-3.5 w-3.5" /> List</button>
              <button onClick={() => setView("board")} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", view === "board" ? "bg-background shadow-sm" : "text-muted-foreground")}><Columns3 className="h-3.5 w-3.5" /> Board</button>
            </div>
            {view === "list" && (
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                {(["open", "all"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1 font-medium capitalize transition-colors", filter === f ? "bg-background shadow-sm" : "text-muted-foreground")}>{f}</button>
                ))}
              </div>
            )}
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
        {view === "board" ? (
          <KanbanBoard tasks={tasks} busy={busy} onStatus={onStatus} />
        ) : shown.length === 0 ? (
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

const BOARD_COLUMNS: { key: "TODO" | "IN_PROGRESS" | "DONE"; label: string; dot: string }[] = [
  { key: "TODO", label: "To do", dot: "bg-muted-foreground/50" },
  { key: "IN_PROGRESS", label: "In progress", dot: "bg-amber-500" },
  { key: "DONE", label: "Done", dot: "bg-emerald-500" },
];

function KanbanBoard({ tasks, busy, onStatus }: { tasks: TaskItem[]; busy: string | null; onStatus: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {BOARD_COLUMNS.map((col) => {
        const items = tasks.filter((t) => (col.key === "TODO" ? t.status === "TODO" : t.status === col.key));
        const prev = col.key === "IN_PROGRESS" ? "TODO" : col.key === "DONE" ? "IN_PROGRESS" : null;
        const next = col.key === "TODO" ? "IN_PROGRESS" : col.key === "IN_PROGRESS" ? "DONE" : null;
        return (
          <div key={col.key} className="rounded-xl border bg-muted/20 p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", col.dot)} /> {col.label}
              <span className="ml-auto rounded-full bg-background px-1.5 py-0.5 text-[10px]">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">—</p>
              ) : (
                items.map((t) => {
                  const loading = busy === `task-${t.id}`;
                  return (
                    <div key={t.id} className="rounded-lg border bg-card p-2.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("text-sm font-medium leading-snug", col.key === "DONE" && "text-muted-foreground line-through")}>{t.title}</span>
                        {t.priority && t.priority !== "MEDIUM" && <Badge variant="outline" className={cn("shrink-0 text-[9px]", PRIORITY_TONE[t.priority])}>{t.priority}</Badge>}
                      </div>
                      {t.dueDate && <p className="mt-1 text-[11px] text-muted-foreground"><CalendarDays className="mr-1 inline h-3 w-3" />{fmtDate(t.dueDate)}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        {prev ? (
                          <button onClick={() => onStatus(t.id, prev)} disabled={loading} aria-label="Move back" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                        ) : <span />}
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        {next ? (
                          <button onClick={() => onStatus(t.id, next)} disabled={loading} aria-label="Move forward" className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                        ) : (
                          <button onClick={() => onStatus(t.id, "TODO")} disabled={loading} aria-label="Reopen" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
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

function projectHealth(status: string, dueDate: string | null): { label: string; tone: string } {
  if (status === "COMPLETED") return { label: "Completed", tone: "text-emerald-600" };
  if (status === "ON_HOLD") return { label: "On hold", tone: "text-amber-600" };
  if (dueDate) {
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, tone: "text-red-600" };
    if (days <= 7) return { label: `Due in ${days}d`, tone: "text-amber-600" };
    return { label: "On track", tone: "text-emerald-600" };
  }
  return { label: "Active", tone: "text-primary" };
}

function timelineProgress(start: string | null, due: string | null): number | null {
  if (!start || !due) return null;
  const s = new Date(start).getTime();
  const e = new Date(due).getTime();
  if (e <= s) return null;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - s) / (e - s)) * 100)));
}

function ProjectsSection({ assignments, timesheet }: { assignments: Data["assignments"]; timesheet: Data["timesheet"] }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const active = assignments.find((a) => a.project.id === openId);

  if (assignments.length === 0) return <Card className="shadow-sm"><CardContent className="py-8"><Empty>No projects assigned yet.</Empty></CardContent></Card>;

  if (active) return <ProjectDetail assignment={active} timesheet={timesheet} onBack={() => setOpenId(null)} />;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {assignments.map((a) => {
        const health = projectHealth(a.project.status, a.project.dueDate);
        return (
          <button key={a.id} onClick={() => setOpenId(a.project.id)} className="rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{a.project.name}</p>
              <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[a.project.status])}>{a.project.status}</Badge>
            </div>
            {a.project.company && <p className="text-xs text-muted-foreground">{a.project.company}</p>}
            {a.project.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.project.description}</p>}
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className={cn("font-medium", health.tone)}>● {health.label}</span>
              <span className="text-muted-foreground">{a.project.team.length} member{a.project.team.length !== 1 ? "s" : ""} · View →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProjectDetail({ assignment, timesheet, onBack }: { assignment: Data["assignments"][number]; timesheet: Data["timesheet"]; onBack: () => void }) {
  const p = assignment.project;
  const health = projectHealth(p.status, p.dueDate);
  const progress = timelineProgress(p.startDate, p.dueDate);
  const myHours = timesheet.filter((t) => t.projectId === p.id).reduce((s, t) => s + t.hours, 0);

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack}><ChevronLeft className="h-4 w-4" /> All projects</Button>

      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="bg-gradient-to-br from-primary/90 to-blue-700 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">{p.name}</h2>
              {p.company && <p className="mt-0.5 text-sm text-blue-100">{p.company}</p>}
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">{p.status}</span>
          </div>
          <p className={cn("mt-3 text-sm font-medium text-white/90")}>● {health.label}{assignment.role ? ` · Your role: ${assignment.role}` : ""}</p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Overview</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{p.description || "No description provided for this project."}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs uppercase text-muted-foreground">Start</div><div className="font-medium">{fmtDate(p.startDate)}</div></div>
                <div><div className="text-xs uppercase text-muted-foreground">Due</div><div className="font-medium">{fmtDate(p.dueDate)}</div></div>
              </div>
              {progress != null && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>Timeline</span><span className="font-medium text-foreground">{progress}% elapsed</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", progress >= 100 ? "bg-red-500" : progress > 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Team ({p.team.length})</CardTitle></CardHeader>
            <CardContent>
              {p.team.length === 0 ? (
                <Empty>No one assigned yet.</Empty>
              ) : (
                <ul className="space-y-2">
                  {p.team.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{m.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div className="text-sm"><span className="font-medium">{m.name}</span>{m.role && <span className="text-muted-foreground"> · {m.role}</span>}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <MetricCard icon={<Clock className="h-4 w-4" />} tone="primary" label="Your hours logged" value={`${Math.round(myHours * 10) / 10}h`} hint="last 21 days" />
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Status" value={p.status} />
              <Row label="Health" value={health.label} />
              <Row label="Your role" value={assignment.role ?? "Member"} />
              <Row label="Team size" value={String(p.team.length)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b py-1.5 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
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
                <Badge variant="outline" className={cn("text-[10px]", r.status === "PRESENT" ? "text-emerald-600 border-emerald-500/40" : r.status === "LEAVE" ? "text-blue-600 border-blue-500/40" : r.status === "HALF_DAY" ? "text-amber-600 border-amber-500/40" : r.status === "HOLIDAY" ? "text-muted-foreground" : "text-red-600 border-red-500/40")}>{r.status}</Badge>
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
// Timesheet
// ---------------------------------------------------------------

function TimesheetTab({
  entries,
  assignments,
  post,
  onChange,
}: {
  entries: Data["timesheet"];
  assignments: Data["assignments"];
  post: (url: string, body?: unknown, method?: string) => Promise<unknown>;
  onChange: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = React.useState(todayStr);
  const [hours, setHours] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const projName = (id: string | null) => assignments.find((a) => a.project.id === id)?.project.name ?? null;

  const weekTotal = entries
    .filter((e) => { const d = new Date(e.date); const diff = (Date.now() - d.getTime()) / 86_400_000; return diff <= 7; })
    .reduce((s, e) => s + e.hours, 0);
  const totalAll = entries.reduce((s, e) => s + e.hours, 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(hours);
    if (!(h > 0)) return toast.error("Enter hours");
    setBusy(true);
    try {
      await post("/api/me/timesheet", { date, hours: h, projectId: projectId || undefined, note: note || undefined });
      setHours("");
      setNote("");
      toast.success("Logged");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try { await post(`/api/me/timesheet/${id}`, {}, "DELETE"); onChange(); } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard icon={<Timer className="h-4 w-4" />} tone="primary" label="Last 7 days" value={`${Math.round(weekTotal * 10) / 10}h`} />
        <MetricCard icon={<Clock className="h-4 w-4" />} tone="emerald" label="Logged (21d)" value={`${Math.round(totalAll * 10) / 10}h`} />
        <MetricCard icon={<ListChecks className="h-4 w-4" />} tone="amber" label="Entries" value={String(entries.length)} />
      </div>
      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Log time</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
            <input type="number" step="0.25" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" className="h-9 w-24 rounded-md border bg-background px-2 text-sm" />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">No project</option>
              {assignments.map((a) => <option key={a.project.id} value={a.project.id}>{a.project.name}</option>)}
            </select>
            <Button type="submit" size="sm" disabled={busy || !hours}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log</Button>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-9 rounded-md border bg-background px-3 text-sm sm:col-span-4" />
          </form>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Recent entries</CardTitle></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <Empty>No time logged yet.</Empty>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium tabular-nums">{e.hours}h</span> · {fmtDate(e.date)}
                    {projName(e.projectId) && <span className="text-muted-foreground"> · {projName(e.projectId)}</span>}
                    {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                  </div>
                  <button onClick={() => remove(e.id)} aria-label="Delete" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Holidays + leave balances
// ---------------------------------------------------------------

function HolidaysCard({ holidays }: { holidays: Data["holidays"] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><span className="text-violet-500"><CalendarDays className="h-4 w-4" /></span> Upcoming holidays</CardTitle></CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <Empty>No holidays scheduled.</Empty>
        ) : (
          <ul className="divide-y">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{h.name}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(h.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveBalances({ balances }: { balances: Data["leaveBalances"] }) {
  const shown = balances.filter((b) => b.allowance > 0);
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {shown.map((b) => (
        <Card key={b.type} className="shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{b.type}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums leading-none">{b.remaining}<span className="text-sm font-normal text-muted-foreground">/{b.allowance}</span></div>
            <div className="mt-0.5 text-xs text-muted-foreground">{b.used} used · days left</div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${b.allowance ? (b.used / b.allowance) * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// Goals / OKRs
// ---------------------------------------------------------------

function GoalsTab({ goals, post, onChange }: { goals: Data["goals"]; post: (url: string, body?: unknown, method?: string) => Promise<unknown>; onChange: () => void }) {
  const [title, setTitle] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await post("/api/me/goals", { title, target: target ? parseFloat(target) : undefined, unit: unit || undefined });
      setTitle(""); setTarget(""); setUnit(""); setOpen(false);
      toast.success("Goal added");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function setProgress(id: string, current: number) {
    try { await post(`/api/me/goals/${id}`, { current }, "PATCH"); onChange(); } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function remove(id: string) {
    try { await post(`/api/me/goals/${id}`, {}, "DELETE"); onChange(); } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New goal</Button>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="pt-5">
            <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Close 5 deals this quarter" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" className="h-9 w-24 rounded-md border bg-background px-2 text-sm" />
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" className="h-9 w-24 rounded-md border bg-background px-2 text-sm" />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy || !title.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {goals.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="py-8"><Empty>No goals yet. Set one to track your progress.</Empty></CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
            const done = g.status === "COMPLETED";
            return (
              <Card key={g.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{g.title}</span>
                      {done && <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">Done</Badge>}
                    </div>
                    <button onClick={() => remove(g.id)} aria-label="Delete" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {g.detail && <p className="mt-0.5 text-sm text-muted-foreground">{g.detail}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">{g.current}{g.unit ? ` ${g.unit}` : ""} / {g.target}{g.unit ? ` ${g.unit}` : ""}</span>
                    <span className="font-semibold text-foreground">{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", done ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                  {!done && (
                    <div className="mt-3 flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setProgress(g.id, Math.max(0, g.current - 1))}>−</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setProgress(g.id, g.current + 1)}>+1</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setProgress(g.id, g.target)}>Mark done</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------

function KnowledgeTab({ articles }: { articles: Data["articles"] }) {
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [article, setArticle] = React.useState<{ id: string; title: string; body: string; category: string | null; author: { name: string }; updatedAt: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const filtered = articles.filter((a) => (a.title + (a.category ?? "")).toLowerCase().includes(q.toLowerCase()));
  const groups = filtered.reduce((acc, a) => { const k = a.category || "General"; (acc[k] ||= []).push(a); return acc; }, {} as Record<string, Data["articles"]>);

  async function open(id: string) {
    setOpenId(id); setArticle(null); setLoading(true);
    try {
      const res = await fetch(`/api/kb/${id}`);
      const json = await res.json();
      if (res.ok) setArticle(json.article);
    } finally { setLoading(false); }
  }

  if (openId) {
    return (
      <Card className="shadow-sm">
        <CardContent className="pt-5">
          <Button size="sm" variant="ghost" className="mb-3" onClick={() => { setOpenId(null); setArticle(null); }}><ChevronLeft className="h-4 w-4" /> Back</Button>
          {loading || !article ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <article>
              {article.category && <div className="text-xs font-medium uppercase tracking-wide text-primary">{article.category}</div>}
              <h2 className="mt-1 text-xl font-bold">{article.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{article.author.name} · updated {fmtDate(article.updatedAt)}</p>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{article.body}</div>
            </article>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the knowledge base…" className="h-10 w-full rounded-lg border bg-card px-4 text-sm outline-none focus:border-primary" />
      {filtered.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="py-10"><Empty>{articles.length === 0 ? "No articles yet. Your admin will add docs and SOPs here." : "No matches."}</Empty></CardContent></Card>
      ) : (
        Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((a) => (
                <button key={a.id} onClick={() => open(a.id)} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.author} · {fmtDate(a.updatedAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Personal reports
// ---------------------------------------------------------------

function ReportsTab({ data }: { data: Data }) {
  // Hours per day for the last 14 days, from attendance check-in/out.
  const days: { label: string; hours: number }[] = [];
  const attMap = new Map<string, { checkIn: string | null; checkOut: string | null }>();
  for (const a of data.recentAttendance) attMap.set(a.date.slice(0, 10), { checkIn: a.checkIn, checkOut: a.checkOut });
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const rec = attMap.get(key);
    let hours = 0;
    if (rec?.checkIn && rec.checkOut) hours = Math.max(0, (new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime()) / 3_600_000);
    days.push({ label: d.toLocaleDateString("en-IN", { day: "2-digit" }), hours: Math.round(hours * 10) / 10 });
  }
  const maxH = Math.max(1, ...days.map((d) => d.hours));
  const totalDone = data.tasks.filter((t) => t.status === "DONE").length;
  const totalTasks = data.tasks.length;
  const tsTotal = data.timesheet.reduce((s, e) => s + e.hours, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={<Clock className="h-4 w-4" />} tone="primary" label="Attendance" value={data.performance.attendanceRate != null ? `${data.performance.attendanceRate}%` : "—"} hint="last 60 days" />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" label="Tasks done" value={`${totalDone}/${totalTasks}`} />
        <MetricCard icon={<Timer className="h-4 w-4" />} tone="amber" label="Logged hrs" value={`${Math.round(tsTotal * 10) / 10}h`} hint="last 21 days" />
        <MetricCard icon={<Star className="h-4 w-4" />} tone="primary" label="Avg review" value={data.performance.avgRating ? `${data.performance.avgRating.toFixed(1)}★` : "—"} />
      </div>
      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Hours worked · last 14 days</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1.5">
            {days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t bg-primary/70 transition-all hover:bg-primary" style={{ height: `${(d.hours / maxH) * 100}%` }} title={`${d.hours}h`} />
                </div>
                <span className="text-[9px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Ask Vetri — scoped AI assistant
// ---------------------------------------------------------------

const VETRI_SUGGESTIONS = [
  "What are my tasks today?",
  "How much leave do I have left?",
  "How many hours did I log this week?",
  "What projects am I on?",
  "When is the next holiday?",
];

function AssistantTab({ first }: { first: string }) {
  const [messages, setMessages] = React.useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/me/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setMessages((m) => [...m, { role: "assistant", content: json.answer }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, I couldn't answer that right now. ${err instanceof Error ? err.message : ""}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-[65vh] flex-col overflow-hidden shadow-card">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-500 text-white shadow-lg shadow-primary/30"><Sparkles className="h-7 w-7" /></span>
            <p className="mt-3 font-semibold">Hi {first}, I&apos;m Vetri.</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Ask me anything about your workspace — I can only see your own data.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {VETRI_SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-500 text-white"><Sparkles className="h-3.5 w-3.5" /></span>}
            <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "bg-primary text-white" : "border bg-muted/40")}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-500 text-white"><Sparkles className="h-3.5 w-3.5" /></span>
            <div className="rounded-2xl border bg-muted/40 px-3.5 py-2.5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Vetri…" className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
        <Button type="submit" size="sm" disabled={busy || !input.trim()} className="h-10">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}</Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------
// Personal calendar (tasks + leave + holidays)
// ---------------------------------------------------------------

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CalendarTab({ data, onGoTo }: { data: Data; onGoTo: (t: TabKey) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const today = new Date();
  const [selected, setSelected] = React.useState<number | null>(today.getDate());

  const first = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();

  // Build per-day event buckets.
  const inLeave = (d: Date) => data.leaves.find((l) => { const s = new Date(l.startDate); const e = new Date(l.endDate); s.setHours(0,0,0,0); e.setHours(23,59,59,999); return d >= s && d <= e; });
  const dayTasks = (d: Date) => data.tasks.filter((t) => t.dueDate && sameDay(new Date(t.dueDate), d) && t.status !== "DONE");
  const dayHoliday = (d: Date) => data.holidays.find((h) => sameDay(new Date(h.date), d));

  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selDate = selected != null ? new Date(cursor.y, cursor.m, selected) : null;
  const selTasks = selDate ? dayTasks(selDate) : [];
  const selHoliday = selDate ? dayHoliday(selDate) : undefined;
  const selLeave = selDate ? inLeave(selDate) : undefined;

  function shift(delta: number) {
    setSelected(null);
    setCursor((c) => { const m = c.m + delta; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</CardTitle>
            <div className="flex gap-1">
              <button onClick={() => shift(-1)} className="rounded-md border p-1 text-muted-foreground hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => shift(1)} className="rounded-md border p-1 text-muted-foreground hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
            {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const date = new Date(cursor.y, cursor.m, d);
              const isToday = sameDay(date, today);
              const isSel = selected === d;
              const tks = dayTasks(date);
              const hol = dayHoliday(date);
              const lv = inLeave(date);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-colors",
                    isSel ? "bg-primary text-white shadow-sm" : "hover:bg-muted",
                    !isSel && isToday && "ring-1 ring-primary",
                  )}
                >
                  <span className={cn(isToday && !isSel && "font-bold text-primary")}>{d}</span>
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {tks.length > 0 && <span className={cn("h-1.5 w-1.5 rounded-full", isSel ? "bg-white" : "bg-amber-500")} />}
                    {hol && <span className={cn("h-1.5 w-1.5 rounded-full", isSel ? "bg-white" : "bg-violet-500")} />}
                    {lv && <span className={cn("h-1.5 w-1.5 rounded-full", isSel ? "bg-white" : "bg-blue-500")} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <Legend color="bg-amber-500" label="Task due" />
            <Legend color="bg-blue-500" label="Leave" />
            <Legend color="bg-violet-500" label="Holiday" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3"><CardTitle className="text-base">{selDate ? selDate.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" }) : "Select a day"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {selHoliday && <div className="rounded-lg bg-violet-500/10 px-3 py-2 text-sm text-violet-700">🎉 {selHoliday.name} — company holiday</div>}
          {selLeave && <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-700">✈️ {selLeave.type} leave ({selLeave.status.toLowerCase()})</div>}
          {selTasks.length > 0 ? (
            <ul className="space-y-2">
              {selTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", t.priority === "URGENT" || t.priority === "HIGH" ? "bg-red-500" : "bg-amber-500")} />
                  <span className="flex-1">{t.title}</span>
                  {t.priority !== "MEDIUM" && <Badge variant="outline" className={cn("text-[10px]", PRIORITY_TONE[t.priority])}>{t.priority}</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            !selHoliday && !selLeave && <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled. <button onClick={() => onGoTo("tasks")} className="font-medium text-primary hover:underline">Add a task →</button></p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Settings — profile + password
// ---------------------------------------------------------------

function SettingsTab({ name, email, profile }: { name: string; email: string; profile: Data["profile"] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserIcon className="h-4 w-4 text-primary" /> Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 pb-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-500 text-lg font-bold text-white shadow-lg shadow-primary/25">{initials(name)}</span>
            <div><div className="font-semibold">{name}</div><div className="text-sm text-muted-foreground">{email}</div></div>
          </div>
          <Row label="Employee code" value={profile?.employeeCode ?? "—"} />
          <Row label="Designation" value={profile?.designation ?? "—"} />
          <Row label="Department" value={profile?.department ?? "—"} />
          <Row label="Phone" value={profile?.phone ?? "—"} />
          <Row label="Joined" value={fmtDate(profile?.joinDate ?? null)} />
          <p className="pt-1 text-xs text-muted-foreground">To update your profile details, contact your admin/HR.</p>
        </CardContent>
      </Card>
      <Card className="shadow-card">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" /> Change password</CardTitle></CardHeader>
        <CardContent><PasswordForm /></CardContent>
      </Card>
    </div>
  );
}

function PasswordForm() {
  const { user } = useUser();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters.");
    if (next !== confirm) return toast.error("Passwords don't match.");
    if (!user) return toast.error("Not signed in.");
    setBusy(true);
    try {
      await user.updatePassword({ currentPassword: current, newPassword: next, signOutOfOtherSessions: true });
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password updated.");
    } catch (err) {
      const msg = (err as { errors?: { message?: string; longMessage?: string }[] })?.errors?.[0]?.longMessage
        ?? (err as { errors?: { message?: string }[] })?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : "Couldn't update password");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cur-pw">Current password</Label>
        <input id="cur-pw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">New password</Label>
        <input id="new-pw" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-pw">Confirm new password</Label>
        <input id="cf-pw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" />
      </div>
      <Button type="submit" size="sm" disabled={busy || !current || !next}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Update password</Button>
    </form>
  );
}

// ---------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------

function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-500 text-white shadow-lg shadow-primary/25">{icon}</span>
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
  const iconCls =
    tone === "amber" ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30" :
    tone === "emerald" ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-500/30" :
    tone === "muted" ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-slate-400/30" :
    "bg-gradient-to-br from-primary to-blue-500 text-white shadow-primary/30";
  const barCls =
    tone === "amber" ? "bg-gradient-to-r from-amber-400 to-orange-500" :
    tone === "emerald" ? "bg-gradient-to-r from-emerald-400 to-teal-500" :
    "bg-gradient-to-r from-primary to-blue-500";
  return (
    <Card className="group relative overflow-hidden shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-lg">
      <CardContent className="p-4">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-lg", iconCls)}>{icon}</span>
        <div className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</div>
        <div className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        {progress != null && (
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all duration-700", barCls)} style={{ width: `${Math.min(100, progress)}%` }} />
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
