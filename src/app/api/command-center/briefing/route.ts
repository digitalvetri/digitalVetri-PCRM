import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getTodaysBriefing } from "@/lib/ceo-briefing";

export const maxDuration = 120;

/** GET /api/command-center/briefing — today's AI CEO briefing (cached per IST day). */
export async function GET() {
  return withApi(async () => {
    await requireUser("content.generate");
    const { date, generatedAt, briefing } = await getTodaysBriefing(false);
    return { date, generatedAt, briefing };
  });
}

/** POST /api/command-center/briefing — force a fresh briefing (re-bills AI, rate-limited). */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`ceo:briefing:${user.id}`, 6, 60_000);
    const { date, generatedAt, briefing } = await getTodaysBriefing(true);
    return { date, generatedAt, briefing };
  });
}
