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
  const [profile, assignments, todayAttendance, recentAttendance, leaves, salary, reviews] = await Promise.all([
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
  ]);
  return { profile, assignments, todayAttendance, recentAttendance, leaves, salary, reviews };
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
