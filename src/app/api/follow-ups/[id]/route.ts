import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  status: z.enum(["PENDING", "DONE", "SKIPPED", "RESCHEDULED"]).optional(),
  outcome: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
});

/** PATCH /api/follow-ups/[id] — update status/outcome/dueAt. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("prospects.edit");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.followUp.findUnique({
      where: { id },
      include: { prospect: { include: { company: true } } },
    });
    if (!existing) throw new ApiError(404, "Follow-up not found");

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.outcome !== undefined) data.outcome = body.outcome?.trim() || null;
    if (body.dueAt) data.dueAt = new Date(body.dueAt);

    if (body.status === "DONE") {
      data.completedAt = new Date();
    }

    const followUp = await prisma.followUp.update({
      where: { id },
      data,
      include: { prospect: { include: { company: true } }, user: true },
    });

    if (body.status === "DONE") {
      await logActivity({
        type: "FOLLOW_UP_DONE",
        message: `${user.name} completed a ${existing.channel.toLowerCase()} follow-up with ${existing.prospect.company.name}`,
        userId: user.id,
        companyId: existing.prospect.companyId,
      });
    }

    return { followUp };
  });
}

/** DELETE /api/follow-ups/[id] */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("prospects.edit");
    const { id } = await params;

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Follow-up not found");

    await prisma.followUp.delete({ where: { id } });
    return { ok: true };
  });
}
