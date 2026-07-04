import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser, roleCan, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { nextId } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { gradeParam, optionalIntParam, pagination, prospectStatusParam } from "@/lib/query";

/** Build the Prisma `where` for the prospect list from query params. */
function buildProspectWhere(sp: URLSearchParams): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {};

  const status = prospectStatusParam(sp.get("status"));
  const assignedTo = sp.get("assignedTo");
  if (status) where.status = status;
  if (assignedTo) where.assignedToId = assignedTo;

  const industry = sp.get("industry");
  const grade = gradeParam(sp.get("grade"));
  const search = sp.get("q");
  const minEmp = optionalIntParam(sp.get("minEmployees"));
  const maxEmp = optionalIntParam(sp.get("maxEmployees"));

  const companyWhere: Prisma.CompanyWhereInput = {};
  if (industry) companyWhere.industry = industry;
  if (search) companyWhere.name = { contains: search, mode: "insensitive" };
  if (grade) companyWhere.analysis = { leadGrade: grade };
  if (minEmp !== undefined || maxEmp !== undefined) {
    companyWhere.employeeEstimate = { gte: minEmp, lte: maxEmp };
  }
  if (Object.keys(companyWhere).length > 0) where.company = companyWhere;

  return where;
}

/** GET /api/prospects — filtered, paginated list. */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("prospects.view");
    const sp = new URL(req.url).searchParams;
    const where = buildProspectWhere(sp);

    const { page, pageSize, skip, take } = pagination(sp);

    const [items, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        include: {
          company: {
            include: {
              analysis: true,
              decisionMakers: { where: { isPrimary: true }, take: 1 },
            },
          },
          assignedTo: { select: userCardSelect },
        },
        orderBy: [
          { nextFollowUpDate: { sort: "asc", nulls: "last" } },
          { company: { analysis: { leadScore: "desc" } } },
        ],
        skip,
        take,
      }),
      prisma.prospect.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  assignedToId: z.string().optional().nullable(),
  allowMultiple: z.boolean().optional(),
});

/** POST /api/prospects — qualify a company into a prospect. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("prospects.edit");
    const { companyId, assignedToId, allowMultiple } = createSchema.parse(await req.json());

    // Assigning to a specific user is a manager-level action.
    if (assignedToId && !roleCan(user.role, "prospects.assign")) {
      throw new ApiError(403, "Missing permission: prospects.assign");
    }

    // A company can hold many deals. "Add to Prospects" (qualify once) returns
    // the existing deal; "New deal" (allowMultiple) always creates another.
    if (!allowMultiple) {
      const existing = await prisma.prospect.findFirst({
        where: { companyId },
        include: { company: true, assignedTo: { select: userCardSelect } },
      });
      if (existing) return { prospect: existing, created: false };
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new ApiError(404, "Company not found");

    const prospectId = await nextId("prospect", "DV-P");
    const prospect = await prisma.prospect.create({
      data: {
        prospectId,
        companyId,
        status: "QUALIFIED",
        assignedToId: assignedToId ?? undefined,
      },
      include: { company: true, assignedTo: { select: userCardSelect } },
    });

    await logActivity({
      type: "PROSPECT_CREATED",
      message: `${user.name} qualified ${company.name} as a prospect (${prospectId})`,
      userId: user.id,
      companyId,
    });

    return { prospect, created: true };
  });
}
