import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** In-app notifications for employees. Best-effort — emitting must never break the triggering action. */

const SELECT = { id: true, type: true, title: true, body: true, link: true, read: true, createdAt: true } as const;

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, select: SELECT });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function notify(userId: string, input: { type?: NotificationType; title: string; body?: string | null; link?: string | null }) {
  try {
    await prisma.notification.create({ data: { userId, type: input.type ?? "GENERAL", title: input.title, body: input.body ?? null, link: input.link ?? null } });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

export async function notifyMany(userIds: string[], input: { type?: NotificationType; title: string; body?: string | null; link?: string | null }) {
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type: input.type ?? "GENERAL", title: input.title, body: input.body ?? null, link: input.link ?? null })),
    });
  } catch (err) {
    console.error("[notifyMany] failed", err);
  }
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
