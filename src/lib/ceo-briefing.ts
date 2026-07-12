import { prisma } from "@/lib/prisma";
import { getCommandCenterSnapshot, targetFunnel } from "@/lib/command-center";
import { generateCeoBriefing, type CeoBriefing } from "@/lib/ai/ceo-os";
import { getLatestDeptReports } from "@/lib/ai/departments";
import { istDateInputValue } from "@/lib/time";

/**
 * The AI CEO's morning briefing, cached once per IST day in AppSetting so
 * opening the app (or hitting the endpoint repeatedly) doesn't re-bill AI.
 * The overnight agent refreshes it so it's ready when the founder wakes.
 */

const CACHE_KEY = "ceoBriefing";

interface CachedBriefing {
  date: string; // IST yyyy-MM-dd this briefing was generated for
  generatedAt: string; // ISO
  briefing: CeoBriefing;
}

/** Compute a fresh briefing from the live snapshot (no caching). */
export async function computeCeoBriefing(): Promise<CeoBriefing> {
  const [snapshot, departmentReports] = await Promise.all([
    getCommandCenterSnapshot(),
    getLatestDeptReports(),
  ]);
  const funnel = targetFunnel(snapshot.monthlyTarget, snapshot.revenueClosedThisMonth);
  // Only fold reports from the last 3 days into the CEO's synthesis — a stale
  // advisory report (run once, days ago) shouldn't be narrated as if it's today's.
  const RECENT_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return generateCeoBriefing({
    context: snapshot,
    funnel: funnel as unknown as Record<string, unknown> | null,
    departmentReports: departmentReports
      .filter((r) => now - new Date(r.createdAt).getTime() < RECENT_MS)
      .map((r) => ({
      department: r.deptTitle,
      headline: r.report.headline,
      summary: r.report.summary,
      risks: r.report.risks,
      topActions: r.report.actions.slice(0, 2),
    })),
    date: istDateInputValue(new Date()),
  });
}

/** Persist a briefing as today's cached value. */
export async function storeCeoBriefing(briefing: CeoBriefing): Promise<CachedBriefing> {
  const payload: CachedBriefing = {
    date: istDateInputValue(new Date()),
    generatedAt: new Date().toISOString(),
    briefing,
  };
  await prisma.appSetting.upsert({
    where: { key: CACHE_KEY },
    create: { key: CACHE_KEY, value: payload as object },
    update: { value: payload as object },
  });
  return payload;
}

/**
 * Return today's briefing — from cache when it was generated for the current
 * IST day, otherwise generate a fresh one and cache it. `force` regenerates
 * regardless (used by the "refresh" action and the overnight agent).
 */
export async function getTodaysBriefing(force = false): Promise<CachedBriefing> {
  const today = istDateInputValue(new Date());
  if (!force) {
    const row = await prisma.appSetting.findUnique({ where: { key: CACHE_KEY } });
    const cached = row?.value as CachedBriefing | undefined;
    if (cached && cached.date === today && cached.briefing) return cached;
  }
  const briefing = await computeCeoBriefing();
  return storeCeoBriefing(briefing);
}
