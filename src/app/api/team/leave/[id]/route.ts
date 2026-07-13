import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { reviewLeave } from "@/lib/hr";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional().nullable(),
});

/** PATCH /api/team/leave/[id] — approve or reject a leave request. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("hr.manage");
    const { id } = await params;
    const b = schema.parse(await req.json());
    await reviewLeave(id, user.id, b.status, b.note);
    return { ok: true };
  });
}
