import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { createSelfTask } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  projectId: z.string().optional().nullable(),
});

/** POST /api/me/tasks — the employee adds a personal to-do. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser();
    const b = schema.parse(await req.json());
    const t = await createSelfTask(user.id, { title: b.title, dueDate: b.dueDate ? parseISTDate(b.dueDate) : null, priority: b.priority, projectId: b.projectId });
    return { ok: true, id: t.id };
  });
}
