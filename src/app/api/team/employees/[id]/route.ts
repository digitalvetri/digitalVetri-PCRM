import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { getEmployeeAdminDetail } from "@/lib/hr";

/** GET /api/team/employees/[id] — full per-employee view for an admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    const d = await getEmployeeAdminDetail(id);
    return {
      name: d.name,
      email: d.email,
      profile: d.profile
        ? { employeeCode: d.profile.employeeCode, designation: d.profile.designation, department: d.profile.department, phone: d.profile.phone, joinDate: d.profile.joinDate?.toISOString() ?? null }
        : null,
      attendanceRate: d.attendanceRate,
      performance: d.performance,
      tasksDone: d.tasksDone,
      tasksOpen: d.tasksOpen,
      tasks: d.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate?.toISOString() ?? null })),
      attendance: d.attendance.map((a) => ({ date: a.date.toISOString(), status: a.status, checkIn: a.checkIn?.toISOString() ?? null, checkOut: a.checkOut?.toISOString() ?? null })),
      leaves: d.leaves.map((l) => ({ id: l.id, type: l.type, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(), status: l.status })),
      salary: d.salary.map((s) => ({ id: s.id, month: s.month, netPay: s.netPay, status: s.status })),
      reviews: d.reviews.map((r) => ({ id: r.id, period: r.period, rating: r.rating, strengths: r.strengths, improvements: r.improvements })),
      projects: d.assignments.map((a) => ({ id: a.project.id, name: a.project.name, status: a.project.status })),
    };
  });
}
