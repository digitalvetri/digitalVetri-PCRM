import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { dayStart, getCommandCenterSnapshot } from "@/lib/command-center";
import { generateDailyPlan } from "@/lib/ai/ceo-os";

/** GET /api/command-center/plan — today's plan (if any). */
export const maxDuration = 120;

export async function GET() {
  return withApi(async () => {
    await requireUser();
    const plan = await prisma.dailyPlan.findUnique({ where: { date: dayStart() } });
    return { plan };
  });
}

const objectivesSchema = z.object({
  revenueTarget: z.number().nullable().optional(),
  meetings: z.number().nullable().optional(),
  coldCalls: z.number().nullable().optional(),
  followUps: z.number().nullable().optional(),
  proposals: z.number().nullable().optional(),
  bniActivity: z.string().nullable().optional(),
  clientDeliveries: z.string().nullable().optional(),
  blockedTasks: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** POST /api/command-center/plan — generate + save today's hourly plan. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`ai:plan:${user.id}`, 20, 60_000);
    const objectives = objectivesSchema.parse(await req.json());

    const snapshot = await getCommandCenterSnapshot();
    const date = dayStart();
    const { briefing, schedule } = await generateDailyPlan({
      objectives,
      context: snapshot as unknown as Record<string, unknown>,
      date: date.toDateString(),
    });

    const scheduleJson = schedule as unknown as Prisma.InputJsonValue;
    const plan = await prisma.dailyPlan.upsert({
      where: { date },
      create: { date, objectives, schedule: scheduleJson, briefing },
      update: { objectives, schedule: scheduleJson, briefing },
    });
    return { plan };
  });
}
