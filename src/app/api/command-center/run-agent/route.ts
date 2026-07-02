import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runDailyAgent } from "@/lib/automation";

export const maxDuration = 300;

/** POST /api/command-center/run-agent — run the daily agent now (manual trigger). */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`agent:run:${user.id}`, 4, 60_000);
    return { ok: true, ...(await runDailyAgent()) };
  });
}
