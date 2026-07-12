import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runDepartmentShift, DEPARTMENTS, DEPT_KEYS, type DeptKey } from "@/lib/ai/departments";

const schema = z.object({
  department: z.enum(DEPT_KEYS as unknown as [string, ...string[]]),
});

export const maxDuration = 120;

/** POST /api/company/shift — run one department head's shift now. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`company:shift:${user.id}`, 12, 60_000);
    const { department } = schema.parse(await req.json());
    const key = department as DeptKey;
    const report = await runDepartmentShift(key);
    return { department: key, title: DEPARTMENTS[key].title, report };
  });
}
