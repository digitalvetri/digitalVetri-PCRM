import { withApi } from "@/lib/api";
import { assertCron, runDailyAgent } from "@/lib/automation";

export const maxDuration = 300;

/**
 * The daily autonomous run — triggered by a scheduler (Vercel Cron / cron-job.org
 * / a VPS cron) presenting the CRON_SECRET (Bearer header or ?secret=). This route
 * is excluded from Clerk auth in middleware; the secret is its only gate.
 */
async function run(req: Request) {
  return withApi(async () => {
    assertCron(req);
    return { ok: true, ...(await runDailyAgent()) };
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
