import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import {
  generateSalesCoachPack,
  generateColdCallPack,
  generateContentPack,
  generateBniPack,
} from "@/lib/ai/ceo-os";

const schema = z.object({
  type: z.enum(["sales", "cold-call", "content", "bni"]),
  companyId: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  theme: z.string().nullable().optional(), // content pack
  focus: z.string().nullable().optional(), // bni pack
});

/**
 * POST /api/command-center/coach — generate a coaching pack.
 * Sales/cold-call packs ground themselves in the selected company's real
 * data (never fabricated contacts).
 */
export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`ai:coach:${user.id}`, 20, 60_000);
    const body = schema.parse(await req.json());

    async function loadCompany() {
      if (!body.companyId) return null;
      const company = await prisma.company.findUnique({
        where: { id: body.companyId },
        include: {
          analysis: true,
          leadIntelligence: true,
          recommendation: true,
          decisionMakers: true,
          prospects: { select: { status: true, proposalValue: true, probability: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!company) throw new ApiError(404, "Company not found");
      return company as unknown as Record<string, unknown>;
    }

    switch (body.type) {
      case "sales": {
        const company = await loadCompany();
        if (!company) throw new ApiError(400, "companyId is required for the sales coach");
        return { type: "sales", pack: await generateSalesCoachPack(company) };
      }
      case "cold-call": {
        const company = await loadCompany();
        return { type: "cold-call", pack: await generateColdCallPack({ company, industry: body.industry }) };
      }
      case "content":
        return { type: "content", pack: await generateContentPack(body.theme) };
      case "bni":
        return { type: "bni", pack: await generateBniPack(body.focus) };
    }
  });
}
