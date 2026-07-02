import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  dueDate: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

/** PATCH /api/tasks/[id] — update fields; complete on DONE. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("tasks.manage");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { prospect: { include: { company: true } } },
    });
    if (!existing) throw new ApiError(404, "Task not found");

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.title) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.priority) data.priority = body.priority;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null;

    if (body.status === "DONE") {
      data.completedAt = new Date();
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: userCardSelect },
        createdBy: { select: userCardSelect },
        prospect: { include: { company: true } },
      },
    });

    if (body.status === "DONE" && existing.status !== "DONE") {
      await logActivity({
        type: "TASK_COMPLETED",
        message: `${user.name} completed task "${existing.title}"`,
        userId: user.id,
        companyId: existing.prospect?.companyId ?? undefined,
      });
    }

    return { task };
  });
}

/** DELETE /api/tasks/[id] */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("tasks.manage");
    const { id } = await params;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Task not found");

    await prisma.task.delete({ where: { id } });
    return { ok: true };
  });
}
