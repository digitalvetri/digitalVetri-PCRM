import { z } from "zod";
import type { ActivityType } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, roleCan, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { PROSPECT_STATUSES } from "@/lib/constants";

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
        assignedTo: true,
        followUps: { include: { user: true }, orderBy: { dueAt: "asc" } },
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

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId;
    if (body.proposalValue !== undefined) data.proposalValue = body.proposalValue;
    if (body.probability !== undefined) data.probability = body.probability;
    if (body.lostReason !== undefined) data.lostReason = body.lostReason;
    if (body.expectedCloseDate !== undefined)
      data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
    if (body.nextFollowUpDate !== undefined)
      data.nextFollowUpDate = body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null;
    if (body.lastContactDate !== undefined)
      data.lastContactDate = body.lastContactDate ? new Date(body.lastContactDate) : null;

    const prospect = await prisma.prospect.update({
      where: { id },
      data,
      include: { company: true, assignedTo: true },
    });

    // Keep a FollowUp record in sync with the prospect's nextFollowUpDate so the
    // date shows in the Follow-up Manager and Calendar (which read FollowUp rows,
    // not the prospect field). Best-effort — never fails the pipeline save.
    if (body.nextFollowUpDate !== undefined) {
      try {
        const newDue = body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null;
        const oldDue = existing.nextFollowUpDate;
        if (newDue?.getTime() !== oldDue?.getTime()) {
          const prior = oldDue
            ? await prisma.followUp.findFirst({ where: { prospectId: id, status: "PENDING", dueAt: oldDue } })
            : null;
          if (newDue) {
            if (prior) {
              await prisma.followUp.update({ where: { id: prior.id }, data: { dueAt: newDue } });
            } else {
              const dupe = await prisma.followUp.findFirst({
                where: { prospectId: id, status: "PENDING", dueAt: newDue },
              });
              if (!dupe) {
                await prisma.followUp.create({
                  data: {
                    prospectId: id,
                    userId: existing.assignedToId ?? user.id,
                    dueAt: newDue,
                    channel: "CALL",
                    notes: "Auto-scheduled from the pipeline follow-up date",
                  },
                });
              }
            }
          } else if (prior) {
            // Date cleared → drop the auto-synced pending follow-up.
            await prisma.followUp.delete({ where: { id: prior.id } });
          }
        }
      } catch (err) {
        console.error("[prospect follow-up sync]", err);
      }
    }

    if (body.status !== undefined && body.status !== existing.status) {
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
