import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { addProjectNote } from "@/lib/hr";

const schema = z.object({ body: z.string().min(1).max(4000) });

/** POST /api/me/projects/[id]/notes — post a note to a project you're on. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    const b = schema.parse(await req.json());
    const note = await addProjectNote(me.id, id, b.body);
    return { note };
  });
}
