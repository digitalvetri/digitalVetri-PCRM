import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { dayStart, getCommandCenterSnapshot } from "@/lib/command-center";
import { generateEodReview, type DailyObjectives } from "@/lib/ai/ceo-os";

const answersSchema = z.object({
  revenueClosed: z.number().nullable().optional(),
  meetingsConducted: z.number().nullable().optional(),
  proposalsSent: z.number().nullable().optional(),
  leadsAdded: z.number().nullable().optional(),
  callsCompleted: z.number().nullable().optional(),
  followUpsMissed: z.number().nullable().optional(),
  biggestLearning: z.string().nullable().optional(),
  tomorrowPriority: z.string().nullable().optional(),
});

/** POST /api/command-center/review — end-of-day accountability review. */
export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`ai:review:${user.id}`, 20, 60_000);
    const answers = answersSchema.parse(await req.json());

    const date = dayStart();
    const existing = await prisma.dailyPlan.findUnique({ where: { date } });
    if (!existing) {
      throw new ApiError(400, "No plan exists for today yet — run your morning planning first.");
    }

    const snapshot = await getCommandCenterSnapshot();
    const review = await generateEodReview({
      answers,
      objectives: existing.objectives as DailyObjectives | null,
      context: snapshot as unknown as Record<string, unknown>,
    });

    const plan = await prisma.dailyPlan.update({
      where: { date },
      data: {
        eodReview: { answers, ...review },
        performanceScore: Math.max(0, Math.min(100, Math.round(review.performanceScore))),
        eodSummary: review.summary,
      },
    });
    return { plan, review };
  });
}
