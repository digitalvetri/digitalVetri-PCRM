import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { createProject } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  name: z.string().min(1).max(160),
  companyId: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  value: z.coerce.number().min(0).optional().nullable(),
});

/** POST /api/team/projects — create a project. */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const project = await createProject({
      name: b.name,
      companyId: b.companyId,
      description: b.description,
      status: b.status,
      startDate: b.startDate ? parseISTDate(b.startDate) : null,
      dueDate: b.dueDate ? parseISTDate(b.dueDate) : null,
      value: b.value,
    });
    return { ok: true, id: project.id };
  });
}
