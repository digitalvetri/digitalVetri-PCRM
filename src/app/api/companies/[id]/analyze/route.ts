import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { analyzeCompany, generateLeadIntelligence, generateCrmRecommendation } from "@/lib/ai/analyze";
import { logActivity } from "@/lib/activity";

/**
 * POST /api/companies/[id]/analyze — runs the full AI pipeline:
 * company analysis (scores + grade), lead intelligence, CRM recommendation.
 */
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("companies.analyze");
    enforceRateLimit(`ai:analyze:${user.id}`, 10, 60_000);
    const { id } = await params;
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new ApiError(404, "Company not found");

    const leadScore = await analyzeCompany(company);
    // These two enrich the profile; run sequentially to stay within rate limits.
    await generateLeadIntelligence(company);
    await generateCrmRecommendation(company);

    await logActivity({
      type: "COMPANY_ANALYZED",
      message: `${user.name} ran AI analysis on ${company.name} (lead score ${leadScore})`,
      userId: user.id,
      companyId: company.id,
      metadata: { leadScore },
    });

    const updated = await prisma.company.findUnique({
      where: { id },
      include: { analysis: true, leadIntelligence: true, recommendation: true, decisionMakers: true },
    });
    return { company: updated };
  });
}
