import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { adminDeleteProjectNote } from "@/lib/hr";

/** DELETE /api/team/project-notes/[id] — admin removes any project note (hr.manage). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    await adminDeleteProjectNote(id);
    return { ok: true };
  });
}
