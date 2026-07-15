import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { createGoal } from "@/lib/goals";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).optional().nullable(),
  target: z.number().positive().optional(),
  unit: z.string().max(20).optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

/** POST /api/me/goals — employee sets a goal for themselves. */
export async function POST(req: Request) {
  return withApi(async () => {
    const me = await requireUser();
    const b = schema.parse(await req.json());
    const goal = await createGoal(me.id, me.id, { title: b.title, detail: b.detail, target: b.target, unit: b.unit, dueDate: b.dueDate ? parseISTDate(b.dueDate) : null });
    return { goal };
  });
}
