import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { deleteAnnouncement } from "@/lib/announcements";

/** DELETE /api/announcements/[id] — admins/HR only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    await deleteAnnouncement(id);
    return { ok: true };
  });
}
