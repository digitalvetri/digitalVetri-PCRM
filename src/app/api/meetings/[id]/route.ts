import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("meetings.view");
    const { id } = await params;
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { company: true, user: { select: userCardSelect } },
    });
    if (!meeting) throw new ApiError(404, "Meeting not found");
    return { meeting };
  });
}

const updateSchema = z.object({
  title: z.string().optional(),
  status: z
    .enum(["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"])
    .optional(),
  type: z
    .enum(["DISCOVERY", "DEMO", "PROPOSAL_REVIEW", "NEGOTIATION", "KICKOFF", "FOLLOW_UP"])
    .optional(),
  scheduledAt: z.coerce.date().optional(),
  duration: z.number().int().positive().optional(),
  location: z.string().nullable().optional(),
  agenda: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  // Questionnaire answers/notes are saved back onto the meeting.
  questionnaire: z.any().optional(),
  questionnaireIndustry: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("meetings.manage");
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const data: Prisma.MeetingUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.status !== undefined) data.status = body.status;
    if (body.type !== undefined) data.type = body.type;
    if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt;
    if (body.duration !== undefined) data.duration = body.duration;
    if (body.location !== undefined) data.location = body.location ?? null;
    if (body.agenda !== undefined) data.agenda = body.agenda ?? null;
    if (body.outcome !== undefined) data.outcome = body.outcome ?? null;
    if (body.questionnaire !== undefined)
      data.questionnaire = body.questionnaire as Prisma.InputJsonValue;
    if (body.questionnaireIndustry !== undefined)
      data.questionnaireIndustry = body.questionnaireIndustry ?? null;

    const meeting = await prisma.meeting.update({
      where: { id },
      data,
      include: { company: true, user: { select: userCardSelect } },
    });

    if (body.status === "COMPLETED") {
      await logActivity({
        type: "MEETING_COMPLETED",
        message: `${user.name} completed "${meeting.title}" with ${meeting.company.name}`,
        userId: user.id,
        companyId: meeting.companyId,
      });
    }

    return { meeting };
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("meetings.manage");
    const { id } = await params;
    await prisma.meeting.delete({ where: { id } });
    return { ok: true };
  });
}
