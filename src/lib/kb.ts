import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

/** Internal knowledge base. Admins author; everyone reads. */

const LIST_SELECT = {
  id: true,
  title: true,
  category: true,
  updatedAt: true,
  author: { select: { name: true } },
} as const;

export async function listArticles() {
  return prisma.kbArticle.findMany({ orderBy: [{ category: "asc" }, { updatedAt: "desc" }], select: LIST_SELECT });
}

export async function getArticle(id: string) {
  const a = await prisma.kbArticle.findUnique({
    where: { id },
    select: { id: true, title: true, body: true, category: true, updatedAt: true, author: { select: { name: true } } },
  });
  if (!a) throw new ApiError(404, "Article not found.");
  return a;
}

export async function createArticle(authorId: string, input: { title: string; body: string; category?: string | null }) {
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title) throw new ApiError(400, "An article needs a title.");
  if (!body) throw new ApiError(400, "An article needs content.");
  return prisma.kbArticle.create({ data: { authorId, title, body, category: input.category?.trim() || null } });
}

export async function updateArticle(id: string, input: { title?: string; body?: string; category?: string | null }) {
  return prisma.kbArticle.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      body: input.body?.trim() || undefined,
      category: input.category === undefined ? undefined : input.category?.trim() || null,
    },
  });
}

export async function deleteArticle(id: string) {
  await prisma.kbArticle.delete({ where: { id } });
}
