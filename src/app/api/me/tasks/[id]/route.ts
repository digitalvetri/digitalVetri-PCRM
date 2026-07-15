import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { setEmployeeTaskStatus } from "@/lib/hr";

const schema = z.object({ status: z.enum(["TODO", "IN_PROGRESS", "DONE"]) });

/** PATCH /api/me/tasks/[id] — the employee moves their own task through the flow. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { status } = schema.parse(await req.json());
    const t = await setEmployeeTaskStatus(user.id, id, status);
    return { ok: true, status: t.status };
  });
}
