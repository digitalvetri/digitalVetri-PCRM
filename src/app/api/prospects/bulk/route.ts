import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PROSPECT_STATUSES } from "@/lib/constants";
import { parseISTDate } from "@/lib/time";
import { syncProspectFollowUp } from "@/lib/follow-up-sync";

const bulkSchema = z.object({
  // Cap the batch so the per-prospect follow-up sync loop can't blow the tx budget.
  ids: z.array(z.string()).min(1).max(200),
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
      // Leaving WON clears the close date (parity with the single-prospect PATCH).
      if (data.status !== "WON") updates.wonAt = null;
    }
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId;
    if (followUpDate !== undefined) updates.nextFollowUpDate = followUpDate;

    const count = await prisma.$transaction(
      async (tx) => {
        // Stamp wonAt ONLY on prospects actually transitioning INTO won — never
        // on rows that were already WON (that would move their historical revenue
        // into the current month). Runs before the status flip below.
        if (data.status === "WON") {
          await tx.prospect.updateMany({
            where: { id: { in: ids }, status: { not: "WON" } },
            data: { wonAt: new Date() },
          });
        }

        const result = await tx.prospect.updateMany({ where: { id: { in: ids } }, data: updates });

        // Reassignment: move the auto-synced follow-ups to the new owner so they
        // show up in the new assignee's Follow-up Manager (which filters by userId).
        if (data.assignedToId) {
          await tx.followUp.updateMany({
            where: {
              prospectId: { in: ids },
              autoSynced: true,
              status: { in: ["PENDING", "RESCHEDULED"] },
            },
            data: { userId: data.assignedToId },
          });
        }

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
