import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { assignTask } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  employeeId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
});

/** POST /api/team/tasks — admin assigns a task to an employee. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const task = await assignTask(user.id, b.employeeId, {
      title: b.title,
      description: b.description,
      dueDate: b.dueDate ? parseISTDate(b.dueDate) : null,
      priority: b.priority,
    });
    return { ok: true, id: task.id };
  });
}
