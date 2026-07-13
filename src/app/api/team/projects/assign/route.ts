import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { assignEmployeeToProject, unassignEmployee } from "@/lib/hr";

const schema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().max(80).optional().nullable(),
  remove: z.boolean().optional(),
});

/** POST /api/team/projects/assign — assign (or remove) an employee on a project. */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    if (b.remove) {
      await unassignEmployee(b.projectId, b.userId);
      return { ok: true, removed: true };
    }
    await assignEmployeeToProject(b.projectId, b.userId, b.role);
    return { ok: true };
  });
}
