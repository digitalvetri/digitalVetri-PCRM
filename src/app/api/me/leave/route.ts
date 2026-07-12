import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { ApiError } from "@/lib/api-error";
import { requestLeave } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  type: z.enum(["CASUAL", "SICK", "EARNED", "UNPAID", "OTHER"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(500).optional(),
});

/** POST /api/me/leave — the signed-in employee submits a leave request. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const startDate = parseISTDate(body.startDate);
    const endDate = parseISTDate(body.endDate);
    if (!startDate || !endDate) throw new ApiError(400, "Invalid dates.");
    const leave = await requestLeave(user.id, { type: body.type, startDate, endDate, reason: body.reason });
    return { ok: true, id: leave.id };
  });
}
