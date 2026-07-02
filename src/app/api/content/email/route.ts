import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { generateEmail, type ContentContext } from "@/lib/ai/content";

const bodySchema = z.object({
  companyId: z.string().min(1).optional(),
  category: z.enum([
    "COLD_OUTREACH",
    "FOLLOW_UP",
    "MEETING_REQUEST",
    "PROPOSAL_FOLLOW_UP",
    "THANK_YOU",
  ]),
  tone: z.string().optional(),
  language: z.string().optional(),
});

type PainPoint = { area: string; prediction: string; reasoning: string };

/**
 * POST /api/content/email — AI-generate a sales email. If a companyId is given,
 * the email is personalised from that company's analysis + decision makers.
 */
export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`ai:content:${user.id}`, 20, 60_000);
    const { companyId, category, tone, language } = bodySchema.parse(await req.json());

    const ctx: ContentContext = {
      senderName: user.name,
      tone: tone || "professional, warm",
      language: language || "English",
    };

    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { analysis: true, decisionMakers: true },
      });
      if (!company) throw new ApiError(404, "Company not found");

      const painPoints =
        (company.analysis?.painPoints as PainPoint[] | null)?.map(
          (p) => `${p.area}: ${p.prediction}`
        ) ?? [];
      const dm =
        company.decisionMakers.find((d) => d.isPrimary) ?? company.decisionMakers[0];

      ctx.companyName = company.name;
      ctx.industry = company.industry;
      ctx.city = company.city;
      ctx.contactName = dm?.name ?? null;
      ctx.contactDesignation = dm?.designation ?? null;
      ctx.painPoints = painPoints;
      ctx.suggestedModules = company.analysis?.suggestedModules ?? [];
    }

    const { subject, body } = await generateEmail(category, ctx);

    const record = await prisma.generatedContent.create({
      data: {
        companyId: companyId ?? null,
        channel: "EMAIL",
        category,
        subject,
        body,
        tone: ctx.tone,
        language: ctx.language,
      },
    });

    await logActivity({
      type: "EMAIL_GENERATED",
      message: `${user.name} generated a ${category.toLowerCase().replace(/_/g, " ")} email${
        ctx.companyName ? ` for ${ctx.companyName}` : ""
      }`,
      userId: user.id,
      companyId: companyId ?? null,
    });

    return { subject, body, id: record.id };
  });
}
