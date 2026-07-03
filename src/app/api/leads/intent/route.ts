import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scanBuyerIntent } from "@/lib/intent";

export const maxDuration = 120;

/** POST /api/leads/intent — scan buyer-intent sources for live "hiring now" posts. */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser("companies.create");
    enforceRateLimit(`intent:scan:${user.id}`, 4, 60_000);
    const result = await scanBuyerIntent(10);
    return { ok: true, ...result };
  });
}
