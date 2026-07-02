import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendWhatsAppViaApi, isWhatsAppApiConfigured } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity";

export const maxDuration = 30;

const schema = z.object({
  to: z.string().trim().min(6).max(20),
  message: z.string().trim().min(1).max(4096),
  companyId: z.string().optional().nullable(),
});

/** GET — whether the Cloud API path is available (UI shows the API button). */
export async function GET() {
  return withApi(async () => {
    await requireUser("content.generate");
    return { configured: isWhatsAppApiConfigured() };
  });
}

/** POST /api/content/whatsapp/send — send via the Meta WhatsApp Cloud API. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`wa:send:${user.id}`, 30, 60_000);
    const { to, message, companyId } = schema.parse(await req.json());

    const result = await sendWhatsAppViaApi(to, message);

    await logActivity({
      type: "WHATSAPP_SENT",
      message: `${user.name} sent a WhatsApp message to ${to}`,
      userId: user.id,
      companyId: companyId ?? undefined,
    });

    return { ok: true, id: result.id };
  });
}
