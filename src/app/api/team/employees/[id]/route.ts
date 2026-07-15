import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { getEmployeeAdminDetail, updateEmployee, resetEmployeePassword } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

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

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  employeeCode: z.string().min(1).max(40).optional(),
  designation: z.string().max(80).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  baseSalary: z.number().min(0).optional(),
  joinDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

/** PATCH /api/team/employees/[id] — edit profile and/or reset password (hr.manage). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    const b = patchSchema.parse(await req.json());
    if (b.newPassword) await resetEmployeePassword(id, b.newPassword);
    await updateEmployee(id, {
      name: b.name,
      employeeCode: b.employeeCode,
      designation: b.designation,
      department: b.department,
      phone: b.phone,
      baseSalary: b.baseSalary,
      joinDate: b.joinDate === undefined ? undefined : b.joinDate ? parseISTDate(b.joinDate) : null,
      isActive: b.isActive,
    });
    return { ok: true };
  });
}
