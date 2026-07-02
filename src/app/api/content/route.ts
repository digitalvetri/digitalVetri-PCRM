import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/content — recent generated content for history lists.
 * Optional filters: ?channel=EMAIL|WHATSAPP, ?companyId=...
 */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("content.generate");
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const companyId = searchParams.get("companyId");

    const where: Prisma.GeneratedContentWhereInput = {};
    if (channel === "EMAIL" || channel === "WHATSAPP") where.channel = channel;
    if (companyId) where.companyId = companyId;

    const items = await prisma.generatedContent.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { items };
  });
}
