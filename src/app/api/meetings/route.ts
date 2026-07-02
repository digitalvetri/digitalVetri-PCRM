import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";

/** GET /api/meetings — list meetings with company + user, newest first. */
export async function GET() {
  return withApi(async () => {
    await requireUser("meetings.view");
    const meetings = await prisma.meeting.findMany({
      include: { company: true, user: { select: userCardSelect } },
      orderBy: { scheduledAt: "desc" },
    });
    return { meetings };
  });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1),
  type: z
    .enum(["DISCOVERY", "DEMO", "PROPOSAL_REVIEW", "NEGOTIATION", "KICKOFF", "FOLLOW_UP"])
    .default("DISCOVERY"),
  scheduledAt: z.coerce.date(),
  duration: z.number().int().positive().optional(),
  location: z.string().nullable().optional(),
  agenda: z.string().nullable().optional(),
});

/** POST /api/meetings — schedule a new meeting. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("meetings.manage");
    const data = createSchema.parse(await req.json());

    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) throw new ApiError(404, "Company not found");

    const meeting = await prisma.meeting.create({
      data: {
        companyId: data.companyId,
        userId: user.id,
        title: data.title,
        type: data.type,
        scheduledAt: data.scheduledAt,
        duration: data.duration ?? 60,
        location: data.location ?? undefined,
        agenda: data.agenda ?? undefined,
      },
      include: { company: true, user: { select: userCardSelect } },
    });

    await logActivity({
      type: "MEETING_SCHEDULED",
      message: `${user.name} scheduled "${meeting.title}" with ${company.name}`,
      userId: user.id,
      companyId: company.id,
    });

    return { meeting };
  });
}
