import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { checkOut } from "@/lib/hr";

/** POST /api/me/checkout — the signed-in employee marks their attendance out. */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser();
    const record = await checkOut(user.id);
    return { ok: true, checkOut: record.checkOut };
  });
}
