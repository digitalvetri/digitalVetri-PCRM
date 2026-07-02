import { z } from "zod";
import type { ActivityType } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, roleCan, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";
import { PROSPECT_STATUSES } from "@/lib/constants";
import { parseISTDate } from "@/lib/time";
import { syncProspectFollowUp } from "@/lib/follow-up-sync";

/** GET /api/prospects/[id] — full prospect detail. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("prospects.view");
    const { id } = await params;

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            analysis: true,
            recommendation: true,
            leadIntelligence: true,
            decisionMakers: true,
          },
        },
        assignedTo: { select: userCardSelect },
        followUps: { include: { user: { select: userCardSelect } }, orderBy: { dueAt: "asc" } },
        tasks: true,
      },
    });

    if (!prospect) throw new ApiError(404, "Prospect not found");
    return { prospect };
  });
}

const patchSchema = z.object({
  status: z.enum(PROSPECT_STATUSES as unknown as [string, ...string[]]).optional(),
  assignedToId: z.string().nullable().optional(),
  proposalValue: z.number().nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
  probability: z.number().nullable().optional(),
  nextFollowUpDate: z.string().nullable().optional(),
  lastContactDate: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
});

/** PATCH /api/prospects/[id] — update pipeline fields. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("prospects.edit");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.prospect.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Prospect not found");

    // Changing the assignee is a manager-level action (prospects.assign). We
    // gate on an actual change so normal pipeline edits by SALES — which resend
    // the unchanged assignedToId in the same payload — are not blocked.
    if (
      body.assignedToId !== undefined &&
      body.assignedToId !== existing.assignedToId &&
      !roleCan(user.role, "prospects.assign")
    ) {
      throw new ApiError(403, "Missing permission: prospects.assign");
    }

    // Parse date-only inputs as IST midnight; reject unparseable strings with a
    // clean 400 rather than letting an Invalid Date reach Prisma as a 500.
    const toDate = (s: string | null): Date | null => {
      if (!s) return null;
      const d = parseISTDate(s);
      if (!d) throw new ApiError(400, "Invalid date value.");
      return d;
    };

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId;
    if (body.proposalValue !== undefined) data.proposalValue = body.proposalValue;
    if (body.probability !== undefined) data.probability = body.probability;
    if (body.lostReason !== undefined) data.lostReason = body.lostReason;
    if (body.expectedCloseDate !== undefined) data.expectedCloseDate = toDate(body.expectedCloseDate);
    if (body.nextFollowUpDate !== undefined) data.nextFollowUpDate = toDate(body.nextFollowUpDate);
    if (body.lastContactDate !== undefined) data.lastContactDate = toDate(body.lastContactDate);

    // Stamp the true close date on the transition into WON; clear it on the way out.
    const statusChanged = body.status !== undefined && body.status !== existing.status;
    if (statusChanged) {
      if (body.status === "WON") data.wonAt = new Date();
      else if (existing.status === "WON") data.wonAt = null;
    }

    // Update the prospect and mirror its follow-up date atomically so the two
    // can never drift apart on a partial failure.
    const prospect = await prisma.$transaction(async (tx) => {
      const p = await tx.prospect.update({
        where: { id },
        data,
        include: { company: true, assignedTo: { select: userCardSelect } },
      });
      if (body.nextFollowUpDate !== undefined) {
        await syncProspectFollowUp(
          tx,
          id,
          data.nextFollowUpDate as Date | null,
          (body.assignedToId ?? existing.assignedToId) ?? user.id
        );
      }
      return p;
    });

    if (statusChanged) {
      const type: ActivityType =
        body.status === "WON" ? "DEAL_WON" : body.status === "LOST" ? "DEAL_LOST" : "STATUS_CHANGED";
      const verb =
        body.status === "WON" ? "won" : body.status === "LOST" ? "marked lost" : "moved";
      await logActivity({
        type,
        message: `${user.name} ${verb} ${prospect.company.name} (${prospect.prospectId}) — ${body.status}`,
        userId: user.id,
        companyId: existing.companyId,
      });
    }

    return { prospect };
  });
}

/** DELETE /api/prospects/[id]. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("prospects.delete");
    const { id } = await params;
    await prisma.prospect.delete({ where: { id } });
    return { ok: true };
  });
}
