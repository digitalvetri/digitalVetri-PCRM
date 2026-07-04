import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { parseISTDate } from "@/lib/time";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "INVOICED", "PAID", "OVERDUE"]).optional(),
  amount: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  invoiceNo: z.string().max(60).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

/** PATCH /api/revenue/[id] — update an entry (e.g. mark paid). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("prospects.edit");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.revenueEntry.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Entry not found");

    const data: Record<string, unknown> = {};
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.cost !== undefined) data.cost = body.cost;
    if (body.invoiceNo !== undefined) data.invoiceNo = body.invoiceNo;
    if (body.note !== undefined) data.note = body.note;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? parseISTDate(body.dueDate) : null;
    if (body.status !== undefined) {
      data.status = body.status;
      // Stamp/clear the collected timestamp as it moves in/out of PAID.
      if (body.status === "PAID" && existing.status !== "PAID") data.paidAt = new Date();
      if (body.status !== "PAID") data.paidAt = null;
    }

    const entry = await prisma.revenueEntry.update({ where: { id }, data });
    return { entry };
  });
}

/** DELETE /api/revenue/[id]. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("prospects.delete");
    const { id } = await params;
    await prisma.revenueEntry.delete({ where: { id } });
    return { ok: true };
  });
}
