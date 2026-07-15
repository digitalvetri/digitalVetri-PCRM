import { z } from "zod";
import { withApi } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { requireUser } from "@/lib/rbac";
import { listHolidays, addHoliday } from "@/lib/holidays";
import { parseISTDate } from "@/lib/time";

/** GET /api/holidays — company holidays this year (any signed-in user). */
export async function GET() {
  return withApi(async () => {
    await requireUser();
    return { holidays: await listHolidays() };
  });
}

const schema = z.object({ date: z.string(), name: z.string().min(1).max(120) });

/** POST /api/holidays — add/update a holiday (hr.manage). */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const date = parseISTDate(b.date);
    if (!date) throw new ApiError(400, "Invalid date.");
    const holiday = await addHoliday({ date, name: b.name });
    return { holiday };
  });
}
