import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { toggleMilestone, deleteMilestone } from "@/lib/hr";

/** PATCH /api/team/milestones/[id] — toggle done (hr.manage). */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    const m = await toggleMilestone(id);
    return { ok: true, done: m.done };
  });
}

/** DELETE /api/team/milestones/[id] — remove (hr.manage). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    await deleteMilestone(id);
    return { ok: true };
  });
}
