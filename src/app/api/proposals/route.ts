import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { nextId } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { generateProposal } from "@/lib/ai/proposal";

/** GET /api/proposals — list proposals with company + user, newest first. */
export const maxDuration = 120;

export async function GET() {
  return withApi(async () => {
    await requireUser("proposals.view");
    const proposals = await prisma.proposal.findMany({
      include: { company: true, user: true },
      orderBy: { createdAt: "desc" },
    });
    return { proposals };
  });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().optional(),
});

/** POST /api/proposals — AI-generate a full proposal from company intelligence. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("proposals.manage");
    enforceRateLimit(`ai:proposal:${user.id}`, 20, 60_000);
    const { companyId, title } = createSchema.parse(await req.json());

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { analysis: true, recommendation: true, leadIntelligence: true },
    });
    if (!company) throw new ApiError(404, "Company not found");

    const context = {
      industry: company.industry,
      subIndustry: company.subIndustry,
      city: company.city,
      state: company.state,
      employeeEstimate: company.employeeEstimate,
      revenueEstimate: company.revenueEstimate,
      products: company.products,
      services: company.services,
      technologyStack: company.technologyStack,
      analysis: company.analysis
        ? {
            businessSummary: company.analysis.businessSummary,
            painPoints: company.analysis.painPoints,
            suggestedModules: company.analysis.suggestedModules,
            expectedBudget: company.analysis.expectedBudget,
            crmOpportunityScore: company.analysis.crmOpportunityScore,
            erpOpportunityScore: company.analysis.erpOpportunityScore,
            aiOpportunityScore: company.analysis.aiOpportunityScore,
          }
        : null,
      recommendation: company.recommendation
        ? {
            recommendedModules: company.recommendation.recommendedModules,
            estimatedHours: company.recommendation.estimatedHours,
            estimatedTimeline: company.recommendation.estimatedTimeline,
            estimatedTeamSize: company.recommendation.estimatedTeamSize,
            estimatedCost: company.recommendation.estimatedCost,
            costRange: company.recommendation.costRange,
            expectedRoi: company.recommendation.expectedRoi,
            annualSavings: company.recommendation.annualSavings,
          }
        : null,
    };

    const content = await generateProposal({
      companyName: company.name,
      industry: company.industry,
      context,
    });

    const proposalNo = await nextId("proposal", "DV-PR");
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const proposal = await prisma.proposal.create({
      data: {
        proposalNo,
        companyId: company.id,
        userId: user.id,
        title: title || content.coverPage?.title || `Proposal for ${company.name}`,
        status: "DRAFT",
        content: content as unknown as Prisma.InputJsonValue,
        totalValue: content.totalValue ?? 0,
        amcValue: content.amc?.annualValue ?? null,
        validUntil,
      },
      include: { company: true, user: true },
    });

    await logActivity({
      type: "PROPOSAL_CREATED",
      message: `${user.name} generated proposal ${proposalNo} for ${company.name}`,
      userId: user.id,
      companyId: company.id,
      metadata: { proposalNo, totalValue: proposal.totalValue },
    });

    return { proposal };
  });
}
