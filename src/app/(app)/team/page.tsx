import { redirect } from "next/navigation";
import { getCurrentUser, roleCan } from "@/lib/rbac";
import { listEmployees, listProjects, listLeaveRequests, getAdminDashboard, getTrackingReport } from "@/lib/hr";
import { listAnnouncements } from "@/lib/announcements";
import { listArticles } from "@/lib/kb";
import { listHolidays } from "@/lib/holidays";
import { PageHeader } from "@/components/shared/page-header";
import { TeamManager } from "@/components/team/team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!roleCan(user.role, "hr.manage")) redirect("/");

  const [employees, projects, leaves, dashboard, tracking, announcements, articles, holidays] = await Promise.all([
    listEmployees(),
    listProjects(),
    listLeaveRequests(),
    getAdminDashboard(),
    getTrackingReport(7),
    listAnnouncements(20),
    listArticles(),
    listHolidays(),
  ]);

  const announcementRows = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    author: a.author.name,
    createdAt: a.createdAt.toISOString(),
  }));

  const articleRows = articles.map((a) => ({ id: a.id, title: a.title, category: a.category, author: a.author.name, updatedAt: a.updatedAt.toISOString() }));
  const holidayRows = holidays.map((h) => ({ id: h.id, date: h.date.toISOString(), name: h.name }));

  const employeeRows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    active: e.isActive,
    code: e.employeeProfile?.employeeCode ?? "—",
    designation: e.employeeProfile?.designation ?? null,
    department: e.employeeProfile?.department ?? null,
    joinDate: e.employeeProfile?.joinDate?.toISOString() ?? null,
  }));

  const projectRows = projects.map((p) => ({
    id: p.id,
    name: p.name,
    company: p.company?.name ?? null,
    status: p.status,
    value: p.value,
    dueDate: p.dueDate?.toISOString() ?? null,
    assignments: p.assignments.map((a) => ({ userId: a.userId, name: a.user.name, role: a.role })),
    milestones: p.milestones.map((m) => ({ id: m.id, title: m.title, done: m.done, dueDate: m.dueDate?.toISOString() ?? null })),
    taskCount: p._count.tasks,
  }));

  const leaveRows = leaves.map((l) => ({
    id: l.id,
    employee: l.user.name,
    email: l.user.email,
    type: l.type,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    reason: l.reason,
    status: l.status,
    reviewNote: l.reviewNote,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Create logins, assign projects, approve leave, manage salary and reviews. Employees sign in to their own private workspace." />
      <TeamManager employees={employeeRows} projects={projectRows} leaves={leaveRows} dashboard={dashboard} tracking={tracking} announcements={announcementRows} articles={articleRows} holidays={holidayRows} />
    </div>
  );
}
