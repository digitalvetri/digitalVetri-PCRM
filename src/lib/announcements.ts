import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

/** Company announcements — posted by admins, visible to the whole company. */

const SELECT = {
  id: true,
  title: true,
  body: true,
  pinned: true,
  createdAt: true,
  author: { select: { name: true } },
} as const;

export async function listAnnouncements(limit = 20) {
  return prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: Math.min(limit, 50),
    select: SELECT,
  });
}

export async function createAnnouncement(authorId: string, input: { title: string; body: string; pinned?: boolean }) {
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title) throw new ApiError(400, "An announcement needs a title.");
  if (!body) throw new ApiError(400, "An announcement needs a message.");
  return prisma.announcement.create({ data: { authorId, title, body, pinned: input.pinned ?? false }, select: SELECT });
}

export async function deleteAnnouncement(id: string) {
  await prisma.announcement.delete({ where: { id } });
}
