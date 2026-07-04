import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { parseISTDate } from "@/lib/time";

/** GET /api/revenue?companyId= — list ledger entries (optionally per client). */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("reports.view");
    const companyId = new URL(req.url).searchParams.get("companyId");
    const entries = await prisma.revenueEntry.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { date: "desc" },
      take: 200,
    });
    return { entries };
  });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  prospectId: z.string().optional().nullable(),
  date: z.string().min(1),
  kind: z.enum(["PROJECT", "AMC", "ADDON"]).default("PROJECT"),
  amount: z.number().nonnegative(),
  cost: z.number().nonnegative().default(0),
  status: z.enum(["DRAFT", "INVOICED", "PAID", "OVERDUE"]).default("INVOICED"),
  invoiceNo: z.string().max(60).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  gstAmount: z.number().nonnegative().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

/** POST /api/revenue — log a revenue entry for a client. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("prospects.edit");
    const body = createSchema.parse(await req.json());

    const date = parseISTDate(body.date);
    if (!date) throw new ApiError(400, "Invalid date.");
    const dueDate = body.dueDate ? parseISTDate(body.dueDate) : null;

    const company = await prisma.company.findUnique({ where: { id: body.companyId } });
    if (!company) throw new ApiError(404, "Company not found");

    const entry = await prisma.revenueEntry.create({
      data: {
        companyId: body.companyId,
        prospectId: body.prospectId || undefined,
        date,
        kind: body.kind,
        amount: body.amount,
        cost: body.cost,
        status: body.status,
        invoiceNo: body.invoiceNo || undefined,
        dueDate: dueDate || undefined,
        paidAt: body.status === "PAID" ? new Date() : undefined,
        gstAmount: body.gstAmount ?? undefined,
        note: body.note || undefined,
        createdById: user.id,
      },
    });
    return { entry };
  });
}
