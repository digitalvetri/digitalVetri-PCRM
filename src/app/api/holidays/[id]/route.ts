import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { deleteHoliday } from "@/lib/holidays";

/** DELETE /api/holidays/[id] — remove a holiday (hr.manage). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    await deleteHoliday(id);
    return { ok: true };
  });
}
