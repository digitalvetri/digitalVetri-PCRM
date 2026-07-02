import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { enumParam, TASK_STATUSES } from "@/lib/query";

/** GET /api/tasks — filtered list ordered by dueDate asc (nulls last), then priority. */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("tasks.view");
    const sp = new URL(req.url).searchParams;

    const where: Prisma.TaskWhereInput = {};
    const status = enumParam(sp.get("status"), TASK_STATUSES);
    const assignedTo = sp.get("assignedTo");
    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;

    const items = await prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: userCardSelect },
        createdBy: { select: userCardSelect },
        prospect: { include: { company: true } },
      },
      orderBy: [
        { dueDate: { sort: "asc", nulls: "last" } },
        // Priority enum order is URGENT, HIGH, MEDIUM, LOW → asc is urgent-first.
        { priority: "asc" },
      ],
    });

    return { items };
  });
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  dueDate: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  prospectId: z.string().optional().nullable(),
});

/** POST /api/tasks — create a task. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("tasks.manage");
    const body = createSchema.parse(await req.json());

    if (body.prospectId) {
      const prospect = await prisma.prospect.findUnique({ where: { id: body.prospectId } });
      if (!prospect) throw new ApiError(404, "Prospect not found");
    }

    const task = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || undefined,
        priority: body.priority ?? "MEDIUM",
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedToId: body.assignedToId || undefined,
        prospectId: body.prospectId || undefined,
        createdById: user.id,
      },
      include: {
        assignedTo: { select: userCardSelect },
        createdBy: { select: userCardSelect },
        prospect: { include: { company: true } },
      },
    });

    return { task };
  });
}
