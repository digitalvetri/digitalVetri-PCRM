import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { deleteProjectNote } from "@/lib/hr";

/** DELETE /api/me/project-notes/[id] — delete your own project note. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    await deleteProjectNote(me.id, id);
    return { ok: true };
  });
}
