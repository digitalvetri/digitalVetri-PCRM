import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  status: z.enum(["DRAFT", "SENT", "DISMISSED"]).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
});

/** PATCH /api/outreach/[id] — edit a draft's body or mark it sent/dismissed. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("content.generate");
    const { id } = await params;
    const data = schema.parse(await req.json());
    const draft = await prisma.outreachDraft.update({ where: { id }, data });
    return { draft };
  });
}
