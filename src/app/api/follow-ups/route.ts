import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** Build the Prisma `where` for the follow-up list from query params. */
function buildFollowUpWhere(sp: URLSearchParams): Prisma.FollowUpWhereInput {
  const where: Prisma.FollowUpWhereInput = {};

  const status = sp.get("status");
  const userId = sp.get("userId");
  const scope = sp.get("scope");

  if (status) where.status = status as never;
  if (userId) where.userId = userId;

  if (scope) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Active statuses only for scope-based views.
    where.status = { in: ["PENDING", "RESCHEDULED"] };

    if (scope === "today") {
      where.dueAt = { gte: startOfToday, lte: endOfToday };
    } else if (scope === "overdue") {
      where.dueAt = { lt: startOfToday };
    } else if (scope === "upcoming") {
      const in7 = new Date(endOfToday);
      in7.setDate(in7.getDate() + 7);
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
        user: true,
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

    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) throw new ApiError(404, "Prospect not found");

    const followUp = await prisma.followUp.create({
      data: {
        prospectId,
        userId: user.id,
        dueAt: new Date(dueAt),
        channel,
        notes: notes?.trim() || undefined,
      },
      include: { prospect: { include: { company: true } }, user: true },
    });

    return { followUp };
  });
}
