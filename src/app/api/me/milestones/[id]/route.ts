import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { toggleMilestoneAsMember } from "@/lib/hr";

/** PATCH /api/me/milestones/[id] — toggle a milestone on a project you're on. */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    const m = await toggleMilestoneAsMember(me.id, id);
    return { ok: true, done: m.done };
  });
}
