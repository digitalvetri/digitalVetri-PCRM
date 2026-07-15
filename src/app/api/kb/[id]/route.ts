import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { getArticle, updateArticle, deleteArticle } from "@/lib/kb";

/** GET /api/kb/[id] — full article (any signed-in user). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser();
    const { id } = await params;
    return { article: await getArticle(id) };
  });
}

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  category: z.string().max(60).optional().nullable(),
});

/** PATCH /api/kb/[id] — edit (hr.manage). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    const b = schema.parse(await req.json());
    const article = await updateArticle(id, b);
    return { article };
  });
}

/** DELETE /api/kb/[id] — remove (hr.manage). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    await deleteArticle(id);
    return { ok: true };
  });
}
