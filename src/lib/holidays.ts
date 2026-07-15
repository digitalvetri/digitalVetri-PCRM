import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { istStartOfDay } from "@/lib/time";

/** Company holidays + leave-balance helpers. */

export async function listHolidays(year?: number) {
  const y = year ?? new Date().getFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const end = new Date(Date.UTC(y + 1, 0, 1));
  return prisma.holiday.findMany({ where: { date: { gte: start, lt: end } }, orderBy: { date: "asc" }, select: { id: true, date: true, name: true } });
}

/** Upcoming holidays from today onward. */
export async function upcomingHolidays(limit = 6) {
  return prisma.holiday.findMany({ where: { date: { gte: istStartOfDay() } }, orderBy: { date: "asc" }, take: limit, select: { id: true, date: true, name: true } });
}

export async function addHoliday(input: { date: Date; name: string }) {
  if (!input.name?.trim()) throw new ApiError(400, "A holiday needs a name.");
  return prisma.holiday.upsert({
    where: { date: input.date },
    create: { date: input.date, name: input.name.trim() },
    update: { name: input.name.trim() },
    select: { id: true, date: true, name: true },
  });
}

export async function deleteHoliday(id: string) {
  await prisma.holiday.delete({ where: { id } });
}

// Simple annual allowance per leave type (working days). Tune as policy evolves.
export const LEAVE_ALLOWANCE: Record<string, number> = { CASUAL: 12, SICK: 12, EARNED: 15, UNPAID: 0, OTHER: 0 };

function daysBetween(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

/** Leave days used per type this calendar year (APPROVED only) + remaining allowance. */
export async function getLeaveBalances(userId: string) {
  const y = new Date().getFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const approved = await prisma.leaveRequest.findMany({
    where: { userId, status: "APPROVED", startDate: { gte: start } },
    select: { type: true, startDate: true, endDate: true },
  });
  const used: Record<string, number> = {};
  for (const l of approved) used[l.type] = (used[l.type] ?? 0) + daysBetween(l.startDate, l.endDate);
  return Object.keys(LEAVE_ALLOWANCE).map((type) => ({
    type,
    allowance: LEAVE_ALLOWANCE[type],
    used: used[type] ?? 0,
    remaining: Math.max(0, LEAVE_ALLOWANCE[type] - (used[type] ?? 0)),
  }));
}
