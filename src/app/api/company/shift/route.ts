import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runDepartmentShift, DEPARTMENTS } from "@/lib/ai/departments";

const schema = z.object({
  department: z.enum(["sales", "marketing", "finance", "operations"]),
});

export const maxDuration = 120;

/** POST /api/company/shift — run one department head's shift now. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`company:shift:${user.id}`, 12, 60_000);
    const { department } = schema.parse(await req.json());
    const report = await runDepartmentShift(department);
    return { department, title: DEPARTMENTS[department].title, report };
  });
}
