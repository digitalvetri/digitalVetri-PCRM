import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { generateQuestionnaire } from "@/lib/ai/questionnaire";

const schema = z.object({
  companyId: z.string().min(1),
  meetingId: z.string().optional(),
});

/**
 * POST /api/meetings/generate-questions — AI-generate an industry-tailored
 * discovery questionnaire (80+ questions for Manufacturing). Slow by design.
 * If meetingId is supplied the questionnaire is persisted onto that meeting.
 */
export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("meetings.manage");
    enforceRateLimit(`ai:questions:${user.id}`, 20, 60_000);
    const { companyId, meetingId } = schema.parse(await req.json());

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new ApiError(404, "Company not found");

    const industry = company.industry ?? "General";

    const questionnaire = await generateQuestionnaire({
      companyName: company.name,
      industry,
      subIndustry: company.subIndustry,
      context: {
        city: company.city,
        state: company.state,
        products: company.products,
        services: company.services,
        manufacturingType: company.manufacturingType,
        technologyStack: company.technologyStack,
      },
    });

    if (meetingId) {
      const updated = await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          questionnaire: questionnaire as unknown as Prisma.InputJsonValue,
          questionnaireIndustry: industry,
        },
        include: { company: true, user: { select: userCardSelect } },
      });
      return { meeting: updated, questionnaire, industry };
    }

    return { questionnaire, industry };
  });
}
