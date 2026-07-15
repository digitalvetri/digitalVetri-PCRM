import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { listNotifications, markAllRead } from "@/lib/notifications";

/** GET /api/me/notifications — your notifications. */
export async function GET() {
  return withApi(async () => {
    const me = await requireUser();
    const notifications = await listNotifications(me.id);
    return { notifications, unread: notifications.filter((n) => !n.read).length };
  });
}

/** POST /api/me/notifications — mark all as read. */
export async function POST() {
  return withApi(async () => {
    const me = await requireUser();
    await markAllRead(me.id);
    return { ok: true };
  });
}
