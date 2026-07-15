import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

/**
 * Company-wide team chat — a single shared channel.
 * Near-real-time via client polling (no websocket infra needed).
 */

const CHAT_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, name: true, role: true, imageUrl: true } },
} as const;

/** Most recent messages, returned oldest → newest for display. */
export async function listMessages(limit = 60) {
  const rows = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    select: CHAT_SELECT,
  });
  return rows.reverse();
}

export async function sendMessage(userId: string, body: string) {
  const text = body.trim();
  if (!text) throw new ApiError(400, "Message can't be empty.");
  if (text.length > 2000) throw new ApiError(400, "Message is too long (2000 characters max).");
  return prisma.chatMessage.create({ data: { userId, body: text }, select: CHAT_SELECT });
}

/**
 * Post an automated message (e.g. Vetri's morning briefing) into the team
 * channel, attributed to the founder/admin account. Best-effort — returns null
 * if there's no admin to attribute it to.
 */
export async function postSystemMessage(body: string) {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) return null;
  const text = body.trim().slice(0, 2000);
  if (!text) return null;
  return prisma.chatMessage.create({ data: { userId: admin.id, body: text } });
}
