import { getCurrentUser } from "@/lib/rbac";
import { getEmployeeSelf, getEmployeePerformance, getDirectory } from "@/lib/hr";
import { listAnnouncements } from "@/lib/announcements";
import { listTimesheet } from "@/lib/timesheet";
import { listGoals } from "@/lib/goals";
import { upcomingHolidays, getLeaveBalances } from "@/lib/holidays";
import { listArticles } from "@/lib/kb";
import { listNotifications } from "@/lib/notifications";
import { EmployeePortal } from "@/components/employee/employee-portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Workspace" };

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects; satisfies types

  const [self, performance, announcements, timesheet, goals, holidays, leaveBalances, articles, notifications, directory] = await Promise.all([
    getEmployeeSelf(user.id),
    getEmployeePerformance(user.id),
    listAnnouncements(10),
    listTimesheet(user.id),
    listGoals(user.id),
    upcomingHolidays(8),
    getLeaveBalances(user.id),
    listArticles(),
    listNotifications(user.id),
    getDirectory(),
  ]);

  const data = {
    profile: self.profile
      ? {
          employeeCode: self.profile.employeeCode,
          designation: self.profile.designation,
          department: self.profile.department,
          phone: self.profile.phone,
          joinDate: self.profile.joinDate?.toISOString() ?? null,
        }
      : null,
    assignments: self.assignments.map((a) => ({
      id: a.id,
      role: a.role,
      project: {
        id: a.project.id,
        name: a.project.name,
        description: a.project.description,
        status: a.project.status,
        startDate: a.project.startDate?.toISOString() ?? null,
        dueDate: a.project.dueDate?.toISOString() ?? null,
        company: a.project.company?.name ?? null,
        stage: a.project.stage,
        team: a.project.assignments.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role })),
        milestones: a.project.milestones.map((ms) => ({ id: ms.id, title: ms.title, done: ms.done, dueDate: ms.dueDate?.toISOString() ?? null })),
        notes: a.project.notes.map((n) => ({ id: n.id, body: n.body, author: n.author.name, authorId: n.author.id, createdAt: n.createdAt.toISOString() })),
        projectTasks: a.project.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate?.toISOString() ?? null, assignee: t.assignedTo?.name ?? null, assigneeId: t.assignedTo?.id ?? null })),
      },
    })),
    todayAttendance: self.todayAttendance
      ? {
          checkIn: self.todayAttendance.checkIn?.toISOString() ?? null,
          checkOut: self.todayAttendance.checkOut?.toISOString() ?? null,
          status: self.todayAttendance.status,
        }
      : null,
    recentAttendance: self.recentAttendance.map((a) => ({
      date: a.date.toISOString(),
      status: a.status,
      checkIn: a.checkIn?.toISOString() ?? null,
      checkOut: a.checkOut?.toISOString() ?? null,
    })),
    leaves: self.leaves.map((l) => ({
      id: l.id,
      type: l.type,
      startDate: l.startDate.toISOString(),
      endDate: l.endDate.toISOString(),
      status: l.status,
      reason: l.reason,
    })),
    salary: self.salary.map((s) => ({
      id: s.id,
      month: s.month,
      baseSalary: s.baseSalary,
      allowances: s.allowances,
      deductions: s.deductions,
      netPay: s.netPay,
      status: s.status,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
    reviews: self.reviews.map((r) => ({
      id: r.id,
      period: r.period,
      rating: r.rating,
      strengths: r.strengths,
      improvements: r.improvements,
      comments: r.comments,
      createdAt: r.createdAt.toISOString(),
    })),
    tasks: self.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      projectId: t.projectId,
      projectName: t.project?.name ?? null,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      author: a.author.name,
      createdAt: a.createdAt.toISOString(),
    })),
    timesheet: timesheet.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      date: t.date.toISOString(),
      hours: t.hours,
      note: t.note,
    })),
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      detail: g.detail,
      target: g.target,
      current: g.current,
      unit: g.unit,
      dueDate: g.dueDate?.toISOString() ?? null,
      status: g.status,
    })),
    holidays: holidays.map((h) => ({ id: h.id, date: h.date.toISOString(), name: h.name })),
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: n.read, createdAt: n.createdAt.toISOString() })),
    directory,
    leaveBalances,
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      author: a.author.name,
      updatedAt: a.updatedAt.toISOString(),
    })),
    performance,
  };

  return <EmployeePortal name={user.name} email={user.email} userId={user.id} data={data} />;
}
