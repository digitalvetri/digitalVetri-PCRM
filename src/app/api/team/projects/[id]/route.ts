import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { adminSetProjectStage } from "@/lib/hr";

const schema = z.object({ stage: z.enum(["PLANNING", "IN_PROGRESS", "REVIEW", "COMPLETED"]) });

/** PATCH /api/team/projects/[id] — set the project stage (hr.manage). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    const b = schema.parse(await req.json());
    const project = await adminSetProjectStage(id, b.stage);
    return { ok: true, stage: project.stage };
  });
}
