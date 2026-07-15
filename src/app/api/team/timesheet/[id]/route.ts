import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { reviewTimesheet } from "@/lib/timesheet";
import { notify } from "@/lib/notifications";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

/** PATCH /api/team/timesheet/[id] — approve/reject a timesheet entry (hr.manage). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const { id } = await params;
    const { status } = schema.parse(await req.json());
    const entry = await reviewTimesheet(id, status);
    const owner = await prisma.timesheetEntry.findUnique({ where: { id }, select: { userId: true, hours: true } });
    if (owner) {
      await notify(owner.userId, {
        type: "GENERAL",
        title: `Timesheet ${status.toLowerCase()}`,
        body: `Your ${owner.hours}h entry was ${status.toLowerCase()}.`,
        link: "timesheet",
      });
    }
    return { ok: true, status: entry.status };
  });
}
