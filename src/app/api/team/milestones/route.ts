import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { addMilestone } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  dueDate: z.string().optional().nullable(),
});

/** POST /api/team/milestones — add a milestone to a project (hr.manage). */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const milestone = await addMilestone(b.projectId, { title: b.title, dueDate: b.dueDate ? parseISTDate(b.dueDate) : null });
    return { milestone };
  });
}
