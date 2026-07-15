import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { deleteTimesheet } from "@/lib/timesheet";

/** DELETE /api/me/timesheet/[id] — remove one of your own entries. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    await deleteTimesheet(me.id, id);
    return { ok: true };
  });
}
