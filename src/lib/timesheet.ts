import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

/** Employee-logged hours per day (self-scoped). */

export async function listTimesheet(userId: string, days = 21) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return prisma.timesheetEntry.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "desc" },
    select: { id: true, projectId: true, date: true, hours: true, note: true, status: true },
  });
}

/** Admin approves/rejects a timesheet entry. */
export async function reviewTimesheet(id: string, status: "APPROVED" | "REJECTED") {
  return prisma.timesheetEntry.update({ where: { id }, data: { status, reviewedAt: new Date() }, select: { id: true, status: true } });
}

export async function addTimesheet(userId: string, input: { date: Date; hours: number; projectId?: string | null; note?: string | null }) {
  if (!(input.hours > 0) || input.hours > 24) throw new ApiError(400, "Hours must be between 0 and 24.");
  return prisma.timesheetEntry.create({
    data: { userId, date: input.date, hours: input.hours, projectId: input.projectId || null, note: input.note?.trim() || null },
    select: { id: true, projectId: true, date: true, hours: true, note: true },
  });
}

export async function deleteTimesheet(userId: string, id: string) {
  const entry = await prisma.timesheetEntry.findFirst({ where: { id, userId }, select: { id: true } });
  if (!entry) throw new ApiError(404, "Entry not found.");
  await prisma.timesheetEntry.delete({ where: { id } });
}
