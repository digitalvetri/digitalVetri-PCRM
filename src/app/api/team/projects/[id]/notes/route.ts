import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { adminAddProjectNote } from "@/lib/hr";

const schema = z.object({ body: z.string().min(1).max(4000) });

/** POST /api/team/projects/[id]/notes — admin posts a note to a project. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser("hr.manage");
    const { id } = await params;
    const b = schema.parse(await req.json());
    const note = await adminAddProjectNote(me.id, id, b.body);
    return { ok: true, id: note.id };
  });
}
