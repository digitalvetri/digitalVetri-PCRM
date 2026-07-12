import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { getLatestDeptReports } from "@/lib/ai/departments";
import { getTodaysBriefing } from "@/lib/ceo-briefing";

export const maxDuration = 120;

/**
 * GET /api/company/reports — the org-chart data: today's CEO briefing plus the
 * latest shift report from each department head.
 */
export async function GET() {
  return withApi(async () => {
    await requireUser("content.generate");
    const [reports, briefing] = await Promise.all([getLatestDeptReports(), getTodaysBriefing(false)]);
    return { reports, briefing: briefing.briefing, briefingDate: briefing.date };
  });
}
