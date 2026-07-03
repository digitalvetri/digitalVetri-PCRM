import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";
import { SERVICES } from "@/lib/constants";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("companies.view");
    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        analysis: true,
        leadIntelligence: true,
        recommendation: true,
        decisionMakers: true,
        prospect: { include: { assignedTo: { select: userCardSelect } } },
        notes: { include: { author: { select: userCardSelect } }, orderBy: { createdAt: "desc" } },
        meetings: { orderBy: { scheduledAt: "desc" } },
        proposals: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!company) throw new ApiError(404, "Company not found");
    return { company };
  });
}

const updateSchema = z.object({
  name: z.string().optional(),
  website: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  subIndustry: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  publicEmail: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  gstNumber: z.string().nullable().optional(),
  employeeEstimate: z.number().nullable().optional(),
  revenueEstimate: z.string().nullable().optional(),
  targetServices: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("companies.edit");
    const { id } = await params;
    const data = updateSchema.parse(await req.json());
    // Keep only recognised services (guards against arbitrary values).
    if (data.targetServices) {
      data.targetServices = data.targetServices.filter((s) => (SERVICES as readonly string[]).includes(s));
    }
    const company = await prisma.company.update({ where: { id }, data });
    return { company };
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("companies.delete");
    const { id } = await params;
    const company = await prisma.company.delete({ where: { id } });
    await logActivity({
      type: "COMPANY_IMPORTED",
      message: `${user.name} deleted ${company.name}`,
      userId: user.id,
    });
    return { ok: true };
  });
}
