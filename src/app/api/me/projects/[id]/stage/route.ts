import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { setProjectStage } from "@/lib/hr";

const schema = z.object({ stage: z.enum(["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"]) });

/** PATCH /api/me/projects/[id]/stage — advance the project stage (assigned members). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    const b = schema.parse(await req.json());
    const project = await setProjectStage(me.id, id, b.stage);
    return { ok: true, stage: project.stage };
  });
}
