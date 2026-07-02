import { Prisma } from "@prisma/client";

/** A prisma client or an interactive-transaction client — both expose the delegates used here. */
type Db = Prisma.TransactionClient;

const ACTIVE_STATUS: Prisma.EnumFollowUpStatusFilter = { in: ["PENDING", "RESCHEDULED"] };

/**
 * Forward bridge: keep the auto-synced FollowUp aligned with a prospect's
 * nextFollowUpDate. It finds its own row via the `autoSynced` marker (never by
 * matching an exact dueAt, which drifts and duplicates), updating in place,
 * creating on first set, and deleting when the date is cleared.
 */
export async function syncProspectFollowUp(
  db: Db,
  prospectId: string,
  newDue: Date | null,
  ownerId: string
): Promise<void> {
  const managed = await db.followUp.findFirst({
    where: { prospectId, autoSynced: true, status: ACTIVE_STATUS },
    orderBy: { createdAt: "desc" },
  });

  if (newDue) {
    if (managed) {
      await db.followUp.update({
        where: { id: managed.id },
        data: { dueAt: newDue, status: "PENDING", userId: ownerId },
      });
    } else {
      await db.followUp.create({
        data: {
          prospectId,
          userId: ownerId,
          dueAt: newDue,
          channel: "CALL",
          autoSynced: true,
          notes: "Auto-scheduled from the pipeline follow-up date",
        },
      });
    }
  } else if (managed) {
    await db.followUp.delete({ where: { id: managed.id } });
  }
}

/**
 * Reverse bridge: recompute a prospect's nextFollowUpDate to the earliest
 * still-active (PENDING/RESCHEDULED) follow-up, or null when none remain. Call
 * after any FollowUp is created, completed, rescheduled or deleted so the
 * pipeline field never shows a stale or already-completed date.
 */
export async function recomputeProspectNextFollowUp(db: Db, prospectId: string): Promise<void> {
  const next = await db.followUp.findFirst({
    where: { prospectId, status: ACTIVE_STATUS },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  await db.prospect.update({
    where: { id: prospectId },
    data: { nextFollowUpDate: next?.dueAt ?? null },
  });
}
