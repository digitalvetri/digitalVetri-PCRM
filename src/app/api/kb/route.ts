import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { listArticles, createArticle } from "@/lib/kb";

/** GET /api/kb — list articles (any signed-in user). */
export async function GET() {
  return withApi(async () => {
    await requireUser();
    return { articles: await listArticles() };
  });
}

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  category: z.string().max(60).optional().nullable(),
});

/** POST /api/kb — create an article (hr.manage). */
export async function POST(req: Request) {
  return withApi(async () => {
    const me = await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const article = await createArticle(me.id, b);
    return { article };
  });
}
