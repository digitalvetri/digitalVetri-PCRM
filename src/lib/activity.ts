import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Fire-and-forget activity logging; failures never break the main flow. */
export async function logActivity(params: {
  type: ActivityType;
  message: string;
  userId?: string | null;
  companyId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        type: params.type,
        message: params.message,
        userId: params.userId ?? undefined,
        companyId: params.companyId ?? undefined,
        metadata: params.metadata,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log", err);
  }
}
