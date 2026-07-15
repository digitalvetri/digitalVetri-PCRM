import { clerkClient } from "@clerk/nextjs/server";
import type { LeaveType, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { istStartOfDay } from "@/lib/time";

/**
 * HRMS server helpers.
 *
 * PRIVACY: employee-facing reads NEVER select `Project.value` (contract value)
 * or any other employee's records. Enforced here on the server — not in the UI —
 * so a direct API call can't leak it. Salary reads are scoped to the caller's
 * own userId (an employee sees only their own payslips).
 */

// Project fields safe to show an employee (no `value`).
const SAFE_PROJECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  dueDate: true,
} as const;

// ---------------------------------------------------------------
// Employee self (privacy-scoped to userId)
// ---------------------------------------------------------------

export async function getEmployeeSelf(userId: string) {
  const [profile, assignments, todayAttendance, recentAttendance, leaves, salary, reviews, tasks] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId } }),
    prisma.projectAssignment.findMany({
      where: { userId },
      select: { id: true, role: true, assignedAt: true, project: { select: SAFE_PROJECT } },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.attendance.findUnique({ where: { userId_date: { userId, date: istStartOfDay() } } }),
    prisma.attendance.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 30 }),
    prisma.leaveRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.salaryRecord.findMany({ where: { userId }, orderBy: { month: "desc" }, take: 12 }),
    prisma.performanceReview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, period: true, rating: true, strengths: true, improvements: true, comments: true, createdAt: true },
    }),
    prisma.task.findMany({
      where: { assignedToId: userId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 40,
      select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true },
    }),
  ]);
  return { profile, assignments, todayAttendance, recentAttendance, leaves, salary, reviews, tasks };
}

/** Employee toggles one of THEIR OWN assigned tasks done/undone. */
export async function toggleEmployeeTask(userId: string, taskId: string) {
  const t = await prisma.task.findFirst({ where: { id: taskId, assignedToId: userId }, select: { id: true, status: true } });
  if (!t) throw new ApiError(404, "Task not found.");
  const done = t.status === "DONE";
  return prisma.task.update({
    where: { id: taskId },
    data: { status: done ? "TODO" : "DONE", completedAt: done ? null : new Date() },
  });
}

/** Employee sets the status of one of THEIR OWN tasks (TODO / IN_PROGRESS / DONE). */
export async function setEmployeeTaskStatus(userId: string, taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE") {
  const t = await prisma.task.findFirst({ where: { id: taskId, assignedToId: userId }, select: { id: true } });
  if (!t) throw new ApiError(404, "Task not found.");
  return prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
}

/** Employee adds a personal to-do for themselves. */
export async function createSelfTask(userId: string, input: { title: string; dueDate?: Date | null; priority?: string | null }) {
  if (!input.title?.trim()) throw new ApiError(400, "A task needs a title.");
  const pr = (input.priority ?? "").toUpperCase();
  return prisma.task.create({
    data: {
      title: input.title.trim(),
      createdById: userId,
      assignedToId: userId,
      dueDate: input.dueDate ?? undefined,
      priority: pr === "URGENT" || pr === "HIGH" || pr === "LOW" ? (pr as "URGENT" | "HIGH" | "LOW") : "MEDIUM",
    },
  });
}

export async function checkIn(userId: string) {
  const date = istStartOfDay();
  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId, date } } });
  if (existing?.checkIn) throw new ApiError(400, "You've already checked in today.");
  return prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, checkIn: new Date(), status: "PRESENT" },
    update: { checkIn: new Date(), status: "PRESENT" },
  });
}

export async function checkOut(userId: string) {
  const date = istStartOfDay();
  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId, date } } });
  if (!existing?.checkIn) throw new ApiError(400, "Check in first.");
  if (existing.checkOut) throw new ApiError(400, "You've already checked out today.");
  return prisma.attendance.update({ where: { userId_date: { userId, date } }, data: { checkOut: new Date() } });
}

export async function requestLeave(
  userId: string,
  input: { type: LeaveType; startDate: Date; endDate: Date; reason?: string }
) {
  if (input.endDate < input.startDate) throw new ApiError(400, "End date can't be before start date.");
  return prisma.leaveRequest.create({
    data: { userId, type: input.type, startDate: input.startDate, endDate: input.endDate, reason: input.reason },
  });
}

/** A simple performance snapshot: attendance rate + review average + workload. */
export async function getEmployeePerformance(userId: string) {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [attendance, reviews, projectCount] = await Promise.all([
    prisma.attendance.findMany({ where: { userId, date: { gte: since } }, select: { status: true } }),
    prisma.performanceReview.findMany({ where: { userId }, select: { rating: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.projectAssignment.count({ where: { userId } }),
  ]);
  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  // Composite 0-100: attendance (up to 50) + review avg (up to 50).
  const score = Math.round((attendanceRate ?? 0) * 0.5 + (avgRating ? (avgRating / 5) * 100 : 0) * 0.5);
  return { attendanceRate, avgRating, projectCount, score, reviewCount: reviews.length };
}

// ---------------------------------------------------------------
// Admin / HR (gated by hr.manage at the route)
// ---------------------------------------------------------------

function clerkErrorMessage(e: unknown): string {
  const err = e as { errors?: { message?: string; longMessage?: string }[] };
  return err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "unknown error";
}

/** Admin creates an employee login (Clerk email+password) + DB user + HR profile. */
export async function createEmployee(input: {
  email: string;
  password: string;
  name: string;
  employeeCode: string;
  designation?: string;
  department?: string;
  phone?: string;
  joinDate?: Date;
  baseSalary?: number;
}) {
  const client = await clerkClient();
  const [firstName, ...rest] = input.name.trim().split(/\s+/);

  let clerkId: string;
  try {
    const cu = await client.users.createUser({
      emailAddress: [input.email],
      password: input.password,
      firstName: firstName || input.name,
      lastName: rest.join(" ") || undefined,
    });
    clerkId = cu.id;
  } catch (e) {
    throw new ApiError(400, `Couldn't create the login: ${clerkErrorMessage(e)}`);
  }

  try {
    return await prisma.user.create({
      data: {
        clerkId,
        email: input.email,
        name: input.name,
        role: "EMPLOYEE",
        isActive: true,
        employeeProfile: {
          create: {
            employeeCode: input.employeeCode,
            designation: input.designation,
            department: input.department,
            phone: input.phone,
            joinDate: input.joinDate,
            baseSalary: input.baseSalary ?? 0,
          },
        },
      },
      include: { employeeProfile: true },
    });
  } catch (e) {
    // Roll back the Clerk login so we don't orphan an account with no DB row.
    try {
      await client.users.deleteUser(clerkId);
    } catch {
      /* best-effort */
    }
    const msg = e instanceof Error && e.message.includes("Unique") ? "That email or employee code is already used." : "database error";
    throw new ApiError(400, `Couldn't save the employee: ${msg}`);
  }
}

export async function listEmployees() {
  return prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    include: { employeeProfile: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Admin assigns a task to an employee. */
export async function assignTask(
  adminId: string,
  employeeId: string,
  input: { title: string; description?: string | null; dueDate?: Date | null; priority?: string | null }
) {
  const emp = await prisma.user.findFirst({ where: { id: employeeId, role: "EMPLOYEE" }, select: { id: true } });
  if (!emp) throw new ApiError(400, "Not an employee.");
  if (!input.title?.trim()) throw new ApiError(400, "A task needs a title.");
  const pr = (input.priority ?? "").toUpperCase();
  return prisma.task.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      createdById: adminId,
      assignedToId: employeeId,
      dueDate: input.dueDate ?? undefined,
      priority: pr === "URGENT" || pr === "HIGH" || pr === "LOW" ? (pr as "URGENT" | "HIGH" | "LOW") : "MEDIUM",
    },
  });
}

/** Full per-employee view for an admin: attendance, tasks, leave, salary, performance. */
export async function getEmployeeAdminDetail(employeeId: string) {
  const emp = await prisma.user.findFirst({
    where: { id: employeeId, role: "EMPLOYEE" },
    include: { employeeProfile: true },
  });
  if (!emp) throw new ApiError(404, "Employee not found.");
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [attendance, tasks, leaves, salary, reviews, assignments, perf] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: employeeId }, orderBy: { date: "desc" }, take: 30 }),
    prisma.task.findMany({
      where: { assignedToId: employeeId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 40,
      select: { id: true, title: true, status: true, priority: true, dueDate: true },
    }),
    prisma.leaveRequest.findMany({ where: { userId: employeeId }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.salaryRecord.findMany({ where: { userId: employeeId }, orderBy: { month: "desc" }, take: 12 }),
    prisma.performanceReview.findMany({ where: { userId: employeeId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.projectAssignment.findMany({ where: { userId: employeeId }, include: { project: { select: { id: true, name: true, status: true } } } }),
    getEmployeePerformance(employeeId),
  ]);
  const recent = attendance.filter((a) => a.date >= since);
  const present = recent.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
  const tasksDone = tasks.filter((t) => t.status === "DONE").length;
  return {
    profile: emp.employeeProfile,
    name: emp.name,
    email: emp.email,
    attendance,
    attendanceRate: recent.length ? Math.round((present / recent.length) * 100) : null,
    tasks,
    tasksDone,
    tasksOpen: tasks.length - tasksDone,
    leaves,
    salary,
    reviews,
    assignments,
    performance: perf,
  };
}

// --- Projects ---

export async function createProject(input: {
  name: string;
  companyId?: string | null;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  dueDate?: Date | null;
  value?: number | null;
}) {
  if (!input.name?.trim()) throw new ApiError(400, "Project name is required.");
  return prisma.project.create({
    data: {
      name: input.name.trim(),
      companyId: input.companyId || undefined,
      description: input.description || undefined,
      status: input.status ?? "ACTIVE",
      startDate: input.startDate || undefined,
      dueDate: input.dueDate || undefined,
      value: input.value ?? undefined,
    },
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true } },
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
  });
}

export async function assignEmployeeToProject(projectId: string, userId: string, role?: string | null) {
  const emp = await prisma.user.findFirst({ where: { id: userId, role: "EMPLOYEE" }, select: { id: true } });
  if (!emp) throw new ApiError(400, "Not an employee.");
  return prisma.projectAssignment.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: role || undefined },
    update: { role: role || undefined },
  });
}

export async function unassignEmployee(projectId: string, userId: string) {
  await prisma.projectAssignment.deleteMany({ where: { projectId, userId } });
}

// --- Leave review ---

export async function listLeaveRequests() {
  return prisma.leaveRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function reviewLeave(id: string, reviewerId: string, status: "APPROVED" | "REJECTED", note?: string | null) {
  return prisma.leaveRequest.update({
    where: { id },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note || undefined },
  });
}

// --- Salary ---

export async function upsertSalary(input: {
  userId: string;
  month: string; // yyyy-MM
  baseSalary: number;
  allowances?: number;
  deductions?: number;
  status?: "DRAFT" | "PAID";
  note?: string | null;
}) {
  const emp = await prisma.user.findFirst({ where: { id: input.userId, role: "EMPLOYEE" }, select: { id: true } });
  if (!emp) throw new ApiError(400, "Not an employee.");
  const allowances = input.allowances ?? 0;
  const deductions = input.deductions ?? 0;
  const netPay = Math.round(input.baseSalary + allowances - deductions);
  const status = input.status ?? "DRAFT";
  return prisma.salaryRecord.upsert({
    where: { userId_month: { userId: input.userId, month: input.month } },
    create: {
      userId: input.userId,
      month: input.month,
      baseSalary: input.baseSalary,
      allowances,
      deductions,
      netPay,
      status,
      paidAt: status === "PAID" ? new Date() : undefined,
      note: input.note || undefined,
    },
    update: {
      baseSalary: input.baseSalary,
      allowances,
      deductions,
      netPay,
      status,
      paidAt: status === "PAID" ? new Date() : null,
      note: input.note || undefined,
    },
  });
}

// --- Performance reviews ---

export async function createReview(input: {
  userId: string;
  reviewerId: string;
  period: string;
  rating: number;
  strengths?: string | null;
  improvements?: string | null;
  comments?: string | null;
}) {
  const emp = await prisma.user.findFirst({ where: { id: input.userId, role: "EMPLOYEE" }, select: { id: true } });
  if (!emp) throw new ApiError(400, "Not an employee.");
  return prisma.performanceReview.create({
    data: {
      userId: input.userId,
      reviewerId: input.reviewerId,
      period: input.period,
      rating: Math.max(1, Math.min(5, Math.round(input.rating))),
      strengths: input.strengths || undefined,
      improvements: input.improvements || undefined,
      comments: input.comments || undefined,
    },
  });
}

/**
 * Executive dashboard for the admin: today's live team status + workloads + risks.
 * All from real records — no fabricated activity.
 */
export async function getAdminDashboard() {
  const today = istStartOfDay();
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      employeeProfile: { select: { employeeCode: true, designation: true, department: true } },
    },
    orderBy: { name: "asc" },
  });
  const ids = employees.map((e) => e.id);

  const [todayAtt, openTasks, activeLeaves, recentAtt, pendingLeave, activeProjects, reviews] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: { in: ids }, date: today }, select: { userId: true, checkIn: true, checkOut: true, status: true } }),
    prisma.task.findMany({ where: { assignedToId: { in: ids }, status: { not: "DONE" } }, select: { assignedToId: true, dueDate: true } }),
    prisma.leaveRequest.findMany({ where: { userId: { in: ids }, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } }, select: { userId: true } }),
    prisma.attendance.findMany({ where: { userId: { in: ids }, date: { gte: since } }, select: { userId: true, status: true } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.performanceReview.findMany({ where: { createdAt: { gte: since } }, select: { rating: true } }),
  ]);

  const attByUser = new Map(todayAtt.map((a) => [a.userId, a]));
  const onLeave = new Set(activeLeaves.map((l) => l.userId));
  const openByUser = new Map<string, number>();
  const overdueByUser = new Map<string, number>();
  for (const t of openTasks) {
    if (!t.assignedToId) continue;
    openByUser.set(t.assignedToId, (openByUser.get(t.assignedToId) ?? 0) + 1);
    if (t.dueDate && t.dueDate < now) overdueByUser.set(t.assignedToId, (overdueByUser.get(t.assignedToId) ?? 0) + 1);
  }
  const presentByUser = new Map<string, { present: number; total: number }>();
  for (const a of recentAtt) {
    const cur = presentByUser.get(a.userId) ?? { present: 0, total: 0 };
    cur.total++;
    if (a.status === "PRESENT" || a.status === "HALF_DAY") cur.present++;
    presentByUser.set(a.userId, cur);
  }

  const rows = employees.map((e) => {
    const att = attByUser.get(e.id);
    const leave = onLeave.has(e.id);
    const status: "PRESENT" | "CHECKED_OUT" | "LEAVE" | "ABSENT" = leave
      ? "LEAVE"
      : att?.checkOut
        ? "CHECKED_OUT"
        : att?.checkIn
          ? "PRESENT"
          : "ABSENT";
    const p = presentByUser.get(e.id);
    const attendanceRate = p && p.total ? Math.round((p.present / p.total) * 100) : null;
    const overdue = overdueByUser.get(e.id) ?? 0;
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      code: e.employeeProfile?.employeeCode ?? "—",
      designation: e.employeeProfile?.designation ?? null,
      department: e.employeeProfile?.department ?? null,
      status,
      checkIn: att?.checkIn?.toISOString() ?? null,
      checkOut: att?.checkOut?.toISOString() ?? null,
      openTasks: openByUser.get(e.id) ?? 0,
      overdueTasks: overdue,
      attendanceRate,
    };
  });

  const presentToday = rows.filter((r) => r.status === "PRESENT" || r.status === "CHECKED_OUT").length;
  const onLeaveToday = rows.filter((r) => r.status === "LEAVE").length;
  const absentToday = rows.filter((r) => r.status === "ABSENT").length;
  const totalOpen = openTasks.length;
  const totalOverdue = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const avgRating = reviews.length ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : null;

  // Risk flags: things an admin should look at today.
  const risks = rows
    .filter((r) => r.overdueTasks > 0 || (r.attendanceRate != null && r.attendanceRate < 60))
    .map((r) => ({
      id: r.id,
      name: r.name,
      reason: r.overdueTasks > 0 ? `${r.overdueTasks} overdue task${r.overdueTasks > 1 ? "s" : ""}` : `Low attendance (${r.attendanceRate}%)`,
    }));

  return {
    headcount: employees.length,
    presentToday,
    onLeaveToday,
    absentToday,
    pendingLeave,
    activeProjects,
    totalOpen,
    totalOverdue,
    avgRating,
    rows,
    risks,
  };
}

/** Aggregate team analytics for the AI Company People head. */
export async function getTeamOverview() {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [headcount, pendingLeave, attendance, reviews, activeProjects] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.attendance.findMany({ where: { date: { gte: since } }, select: { status: true } }),
    prisma.performanceReview.findMany({ where: { createdAt: { gte: since } }, select: { rating: true } }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
  ]);
  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null;
  const avgRating = reviews.length ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : null;
  return { headcount, pendingLeave, attendanceRate, avgRating, reviewCount: reviews.length, activeProjects };
}
