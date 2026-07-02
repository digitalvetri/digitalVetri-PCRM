import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/**
 * Global search across companies (name, phone, email, industry, city, state)
 * and prospects (by human ID). Returns a unified result list.
 */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return { results: [] };

    const like = { contains: q, mode: "insensitive" as const };
    const [companies, prospects] = await Promise.all([
      prisma.company.findMany({
        where: {
          OR: [
            { name: like },
            { phone: like },
            { publicEmail: like },
            { industry: like },
            { subIndustry: like },
            { city: like },
            { state: like },
          ],
        },
        include: { analysis: { select: { leadGrade: true } } },
        take: 8,
      }),
      prisma.prospect.findMany({
        where: { prospectId: like },
        include: { company: true },
        take: 4,
      }),
    ]);

    const results = [
      ...companies.map((c) => ({
        type: "company" as const,
        id: c.id,
        title: c.name,
        subtitle: [c.industry, c.city].filter(Boolean).join(" · ") || "Company",
        href: `/companies/${c.id}`,
        grade: c.analysis?.leadGrade ?? null,
      })),
      ...prospects.map((p) => ({
        type: "prospect" as const,
        id: p.id,
        title: p.company.name,
        subtitle: `${p.prospectId} · ${p.status}`,
        href: `/prospects/${p.id}`,
        grade: null,
      })),
    ];

    return { results };
  });
}
