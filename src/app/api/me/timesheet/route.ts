import { z } from "zod";
import { withApi } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { requireUser } from "@/lib/rbac";
import { addTimesheet } from "@/lib/timesheet";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  date: z.string(),
  hours: z.number().positive().max(24),
  projectId: z.string().optional().nullable(),
  note: z.string().max(300).optional().nullable(),
});

/** POST /api/me/timesheet — log hours for a day. */
export async function POST(req: Request) {
  return withApi(async () => {
    const me = await requireUser();
    const b = schema.parse(await req.json());
    const date = parseISTDate(b.date);
    if (!date) throw new ApiError(400, "Invalid date.");
    const entry = await addTimesheet(me.id, { date, hours: b.hours, projectId: b.projectId, note: b.note });
    return { entry };
  });
}
