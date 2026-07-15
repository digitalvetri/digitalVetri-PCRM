import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { toggleSubtask, deleteSubtask } from "@/lib/hr";

/** PATCH /api/me/subtasks/[id] — toggle a checklist item. */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    const s = await toggleSubtask(me.id, id);
    return { ok: true, done: s.done };
  });
}

/** DELETE /api/me/subtasks/[id] — remove a checklist item. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    await deleteSubtask(me.id, id);
    return { ok: true };
  });
}
