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
  // Engagement / recurring (Phase 1)
  dealType: z.enum(["ONE_TIME", "AMC", "RETAINER"]).optional(),
  recurringAmount: z.number().nullable().optional(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).nullable().optional(),
  contractStart: z.string().nullable().optional(),
  contractEnd: z.string().nullable().optional(),
  renewalDate: z.string().nullable().optional(),
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
    // Engagement / recurring fields
    if (body.dealType !== undefined) data.dealType = body.dealType;
    if (body.recurringAmount !== undefined) data.recurringAmount = body.recurringAmount;
    if (body.billingCycle !== undefined) data.billingCycle = body.billingCycle;
    if (body.contractStart !== undefined) data.contractStart = toDate(body.contractStart);
    if (body.contractEnd !== undefined) data.contractEnd = toDate(body.contractEnd);
    if (body.renewalDate !== undefined) data.renewalDate = toDate(body.renewalDate);

    // Stamp the true close date on the transition into WON; clear it on the way out.
    const statusChanged = body.status !== undefined && body.status !== existing.status;
    if (statusChanged) {
      if (body.status === "WON") data.wonAt = new Date();
      else if (existing.status === "WON") data.wonAt = null;
    }

    // A won recurring deal makes the company an AMC client; a one-time win makes
    // them ACTIVE. Applied inside the transaction below.
    const wonType = (body.dealType ?? existing.dealType) as string;
    const wonNow = statusChanged && body.status === "WON";

    // The edit form resends nextFollowUpDate on every save, so only touch the
    // follow-up bridge when the date VALUE actually changed — otherwise an
    // unrelated field edit would spawn a duplicate follow-up.
    const newFollowUp = data.nextFollowUpDate as Date | null | undefined;
    const oldTime = existing.nextFollowUpDate?.getTime() ?? null;
    const newTime = newFollowUp?.getTime() ?? null;
    const followUpChanged = body.nextFollowUpDate !== undefined && oldTime !== newTime;
    const assigneeChanged = body.assignedToId !== undefined && body.assignedToId !== existing.assignedToId;

    // Update the prospect and mirror its follow-up date atomically so the two
    // can never drift apart on a partial failure.
    const prospect = await prisma.$transaction(async (tx) => {
      const p = await tx.prospect.update({
        where: { id },
        data,
        include: { company: true, assignedTo: { select: userCardSelect } },
      });
      if (wonNow) {
        await tx.company.update({
          where: { id: existing.companyId },
          data: { relationship: wonType === "ONE_TIME" ? "ACTIVE" : "AMC" },
        });
        // Stamp clientSince only on the FIRST win (leave earlier value intact).
        await tx.company.updateMany({
          where: { id: existing.companyId, clientSince: null },
          data: { clientSince: new Date() },
        });
      }
      if (followUpChanged) {
        await syncProspectFollowUp(
          tx,
          id,
          newFollowUp ?? null,
          (body.assignedToId ?? existing.assignedToId) ?? user.id
        );
      }
      // Reassignment: move the auto-synced follow-up to the new owner so it shows
      // in their Follow-up Manager (which filters by userId).
      if (assigneeChanged && body.assignedToId) {
        await tx.followUp.updateMany({
          where: { prospectId: id, autoSynced: true, status: { in: ["PENDING", "RESCHEDULED"] } },
          data: { userId: body.assignedToId },
        });
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
