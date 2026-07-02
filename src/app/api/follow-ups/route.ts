import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { enumParam, FOLLOWUP_STATUSES } from "@/lib/query";
import { parseISTDate, istStartOfDay, istEndOfDay } from "@/lib/time";
import { recomputeProspectNextFollowUp } from "@/lib/follow-up-sync";

/** Build the Prisma `where` for the follow-up list from query params. */
function buildFollowUpWhere(sp: URLSearchParams): Prisma.FollowUpWhereInput {
  const where: Prisma.FollowUpWhereInput = {};

  const status = enumParam(sp.get("status"), FOLLOWUP_STATUSES);
  const userId = sp.get("userId");
  const scope = sp.get("scope");

  if (status) where.status = status;
  if (userId) where.userId = userId;

  if (scope) {
    const startOfToday = istStartOfDay();
    const endOfToday = istEndOfDay();

    // Active statuses only for scope-based views.
    where.status = { in: ["PENDING", "RESCHEDULED"] };

    if (scope === "today") {
      where.dueAt = { gte: startOfToday, lte: endOfToday };
    } else if (scope === "overdue") {
      where.dueAt = { lt: startOfToday };
    } else if (scope === "upcoming") {
      const in7 = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
      where.dueAt = { gt: endOfToday, lte: in7 };
    }
  }

  return where;
}

/** GET /api/follow-ups — filtered list ordered by dueAt asc. */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("prospects.view");
    const sp = new URL(req.url).searchParams;
    const where = buildFollowUpWhere(sp);

    const items = await prisma.followUp.findMany({
      where,
      include: {
        prospect: { include: { company: true } },
        user: { select: userCardSelect },
      },
      orderBy: { dueAt: "asc" },
    });

    return { items };
  });
}

const createSchema = z.object({
  prospectId: z.string().min(1),
  dueAt: z.string().min(1),
  channel: z.enum(["CALL", "EMAIL", "WHATSAPP", "MEETING", "LINKEDIN", "OTHER"]),
  notes: z.string().optional().nullable(),
});

/** POST /api/follow-ups — schedule a follow-up for a prospect. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("prospects.edit");
    const { prospectId, dueAt, channel, notes } = createSchema.parse(await req.json());

    const due = parseISTDate(dueAt);
    if (!due) throw new ApiError(400, "Invalid due date.");

    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) throw new ApiError(404, "Prospect not found");

    const followUp = await prisma.$transaction(async (tx) => {
      const created = await tx.followUp.create({
        data: {
          prospectId,
          userId: user.id,
          dueAt: due,
          channel,
          notes: notes?.trim() || undefined,
        },
        include: { prospect: { include: { company: true } }, user: { select: userCardSelect } },
      });
      // Reflect the new follow-up in the prospect's next-follow-up field.
      await recomputeProspectNextFollowUp(tx, prospectId);
      return created;
    });

    return { followUp };
  });
}
