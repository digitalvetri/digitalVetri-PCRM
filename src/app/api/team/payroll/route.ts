import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { getPayrollForMonth, generatePayrollRun, markPayrollPaid } from "@/lib/hr";

const monthRe = /^\d{4}-\d{2}$/;

/** GET /api/team/payroll?month=yyyy-MM — payroll for a month (hr.manage). */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const month = new URL(req.url).searchParams.get("month") ?? "";
    if (!monthRe.test(month)) throw new Error("month=yyyy-MM required");
    return getPayrollForMonth(month);
  });
}

const schema = z.object({ month: z.string().regex(monthRe), action: z.enum(["generate", "markPaid"]) });

/** POST /api/team/payroll — generate the run or mark all paid (hr.manage). */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const result = b.action === "generate" ? await generatePayrollRun(b.month) : await markPayrollPaid(b.month);
    return { ok: true, ...result, ...(await getPayrollForMonth(b.month)) };
  });
}
