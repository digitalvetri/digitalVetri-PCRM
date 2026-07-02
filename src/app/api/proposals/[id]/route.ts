import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("proposals.view");
    const { id } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { company: true, user: { select: userCardSelect } },
    });
    if (!proposal) throw new ApiError(404, "Proposal not found");
    return { proposal };
  });
}

const updateSchema = z.object({
  title: z.string().optional(),
  status: z
    .enum(["DRAFT", "SENT", "VIEWED", "UNDER_DISCUSSION", "ACCEPTED", "REJECTED", "EXPIRED"])
    .optional(),
  content: z.any().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("proposals.manage");
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const data: Prisma.ProposalUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.status !== undefined) data.status = body.status;
    if (body.content !== undefined) data.content = body.content as Prisma.InputJsonValue;
    if (body.status === "SENT") data.sentAt = new Date();

    const proposal = await prisma.proposal.update({
      where: { id },
      data,
      include: { company: true, user: { select: userCardSelect } },
    });

    if (body.status === "SENT") {
      await logActivity({
        type: "PROPOSAL_SENT",
        message: `${user.name} sent proposal ${proposal.proposalNo} to ${proposal.company.name}`,
        userId: user.id,
        companyId: proposal.companyId,
      });
    }

    return { proposal };
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("proposals.manage");
    const { id } = await params;
    await prisma.proposal.delete({ where: { id } });
    return { ok: true };
  });
}
