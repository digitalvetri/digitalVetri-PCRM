import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createCompanyShell } from "@/lib/import";
import { logActivity } from "@/lib/activity";

/** GET /api/companies — filtered, paginated list. */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("companies.view");
    const sp = new URL(req.url).searchParams;

    const where: Prisma.CompanyWhereInput = {};
    const industry = sp.get("industry");
    const city = sp.get("city");
    const state = sp.get("state");
    const grade = sp.get("grade");
    const search = sp.get("q");
    const minEmp = sp.get("minEmployees");
    const maxEmp = sp.get("maxEmployees");

    if (industry) where.industry = industry;
    if (city) where.city = city;
    if (state) where.state = state;
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (minEmp || maxEmp) {
      where.employeeEstimate = {
        gte: minEmp ? Number(minEmp) : undefined,
        lte: maxEmp ? Number(maxEmp) : undefined,
      };
    }
    if (grade) where.analysis = { leadGrade: grade as never };

    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(100, Number(sp.get("pageSize") ?? 25));

    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: { analysis: true, decisionMakers: { where: { isPrimary: true }, take: 1 }, prospect: true },
        orderBy: [{ analysis: { leadScore: "desc" } }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.company.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  publicEmail: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  employeeEstimate: z.number().optional().nullable(),
});

/** POST /api/companies — manual entry. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("companies.create");
    const data = createSchema.parse(await req.json());
    const company = await createCompanyShell(data, "MANUAL");
    await logActivity({
      type: "COMPANY_IMPORTED",
      message: `${user.name} added ${company.name} manually`,
      userId: user.id,
      companyId: company.id,
    });
    return { company };
  });
}
