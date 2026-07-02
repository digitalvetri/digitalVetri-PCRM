import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PROSPECT_STATUSES } from "@/lib/constants";
import { parseISTDate } from "@/lib/time";
import { syncProspectFollowUp } from "@/lib/follow-up-sync";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  data: z.object({
    status: z.enum(PROSPECT_STATUSES as unknown as [string, ...string[]]).optional(),
    assignedToId: z.string().nullable().optional(),
    nextFollowUpDate: z.string().nullable().optional(),
  }),
});

/** POST /api/prospects/bulk — bulk update prospects (status / assignee / follow-up date). */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("prospects.bulkUpdate");
    const { ids, data } = bulkSchema.parse(await req.json());

    let followUpDate: Date | null | undefined;
    if (data.nextFollowUpDate !== undefined) {
      followUpDate = data.nextFollowUpDate ? parseISTDate(data.nextFollowUpDate) : null;
      if (data.nextFollowUpDate && !followUpDate) throw new ApiError(400, "Invalid date value.");
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updates.status = data.status;
      // Stamp the close date when bulk-moving prospects into WON.
      if (data.status === "WON") updates.wonAt = new Date();
    }
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId;
    if (followUpDate !== undefined) updates.nextFollowUpDate = followUpDate;

    const count = await prisma.$transaction(
      async (tx) => {
        const result = await tx.prospect.updateMany({ where: { id: { in: ids } }, data: updates });
        // Mirror the follow-up date into FollowUp rows per prospect so bulk edits
        // surface in the Follow-up Manager and Calendar, exactly like single edits.
        if (followUpDate !== undefined) {
          const targets = await tx.prospect.findMany({
            where: { id: { in: ids } },
            select: { id: true, assignedToId: true },
          });
          for (const t of targets) {
            await syncProspectFollowUp(tx, t.id, followUpDate, t.assignedToId ?? user.id);
          }
        }
        return result.count;
      },
      { timeout: 20000 }
    );

    return { count };
  });
}
