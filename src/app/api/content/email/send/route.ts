import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { logActivity } from "@/lib/activity";

export const maxDuration = 30;

const schema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  companyId: z.string().optional().nullable(),
});

/** GET — lets the UI know whether in-app sending is available. */
export async function GET() {
  return withApi(async () => {
    await requireUser("content.generate");
    return { configured: isEmailConfigured() };
  });
}

/** POST /api/content/email/send — send a generated email to the client via SMTP. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`email:send:${user.id}`, 30, 60_000);
    const { to, subject, body, companyId } = schema.parse(await req.json());

    await sendEmail({ to, subject, text: body, replyTo: user.email });

    await logActivity({
      type: "EMAIL_SENT",
      message: `${user.name} sent an email to ${to}`,
      userId: user.id,
      companyId: companyId ?? undefined,
    });

    return { ok: true, to };
  });
}
