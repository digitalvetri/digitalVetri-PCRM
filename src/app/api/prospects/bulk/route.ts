import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  data: z.object({
    status: z.string().optional(),
    assignedToId: z.string().nullable().optional(),
    nextFollowUpDate: z.string().nullable().optional(),
  }),
});

/** POST /api/prospects/bulk — bulk update prospects. */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("prospects.bulkUpdate");
    const { ids, data } = bulkSchema.parse(await req.json());

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId;
    if (data.nextFollowUpDate !== undefined)
      updates.nextFollowUpDate = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;

    const result = await prisma.prospect.updateMany({
      where: { id: { in: ids } },
      data: updates,
    });

    return { count: result.count };
  });
}
