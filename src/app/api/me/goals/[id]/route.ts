import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { updateGoal, deleteGoal } from "@/lib/goals";

const schema = z.object({
  current: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

/** PATCH /api/me/goals/[id] — update progress/status of your own goal. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    const b = schema.parse(await req.json());
    const goal = await updateGoal(me.id, id, b);
    return { goal };
  });
}

/** DELETE /api/me/goals/[id] — remove your own goal. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    await deleteGoal(me.id, id);
    return { ok: true };
  });
}
