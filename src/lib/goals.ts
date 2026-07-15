import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { GoalStatus } from "@prisma/client";

/** Employee goals / OKRs with measurable progress. */

const SELECT = {
  id: true,
  title: true,
  detail: true,
  target: true,
  current: true,
  unit: true,
  dueDate: true,
  status: true,
} as const;

export async function listGoals(userId: string) {
  return prisma.goal.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    select: SELECT,
  });
}

export async function createGoal(ownerId: string, createdById: string, input: { title: string; detail?: string | null; target?: number; unit?: string | null; dueDate?: Date | null }) {
  if (!input.title?.trim()) throw new ApiError(400, "A goal needs a title.");
  return prisma.goal.create({
    data: {
      userId: ownerId,
      createdById,
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      target: input.target && input.target > 0 ? input.target : 100,
      unit: input.unit?.trim() || null,
      dueDate: input.dueDate || null,
    },
    select: SELECT,
  });
}

/** Owner updates progress / status of their own goal. */
export async function updateGoal(userId: string, id: string, input: { current?: number; status?: GoalStatus }) {
  const g = await prisma.goal.findFirst({ where: { id, userId }, select: { id: true, target: true } });
  if (!g) throw new ApiError(404, "Goal not found.");
  const data: { current?: number; status?: GoalStatus } = {};
  if (input.current != null) data.current = Math.max(0, input.current);
  if (input.status) data.status = input.status;
  // Auto-complete when progress reaches target.
  if (data.current != null && data.current >= g.target && !input.status) data.status = "COMPLETED";
  return prisma.goal.update({ where: { id }, data, select: SELECT });
}

export async function deleteGoal(userId: string, id: string) {
  const g = await prisma.goal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!g) throw new ApiError(404, "Goal not found.");
  await prisma.goal.delete({ where: { id } });
}
