import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { checkIn } from "@/lib/hr";

/** POST /api/me/checkin — the signed-in employee marks their attendance in. */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser();
    const record = await checkIn(user.id);
    return { ok: true, checkIn: record.checkIn };
  });
}
