import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { toggleEmployeeTask } from "@/lib/hr";

/** POST /api/me/tasks/[id]/toggle — the employee marks their own task done/undone. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const t = await toggleEmployeeTask(user.id, id);
    return { ok: true, status: t.status };
  });
}
