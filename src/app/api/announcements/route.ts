import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { listAnnouncements, createAnnouncement } from "@/lib/announcements";

/** GET /api/announcements — visible to any signed-in user. */
export async function GET() {
  return withApi(async () => {
    await requireUser();
    return { announcements: await listAnnouncements() };
  });
}

const schema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
  pinned: z.boolean().optional(),
});

/** POST /api/announcements — admins/HR only. */
export async function POST(req: Request) {
  return withApi(async () => {
    const me = await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const announcement = await createAnnouncement(me.id, b);
    return { announcement };
  });
}
