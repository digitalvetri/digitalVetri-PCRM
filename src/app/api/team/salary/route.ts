import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { upsertSalary } from "@/lib/hr";

const schema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be yyyy-MM"),
  baseSalary: z.coerce.number().min(0),
  allowances: z.coerce.number().min(0).optional(),
  deductions: z.coerce.number().min(0).optional(),
  status: z.enum(["DRAFT", "PAID"]).optional(),
  note: z.string().max(500).optional().nullable(),
});

/** POST /api/team/salary — create/update an employee's monthly salary record. */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const rec = await upsertSalary(b);
    return { ok: true, id: rec.id, netPay: rec.netPay };
  });
}
