import { isEmailConfigured, sendEmail } from "@/lib/email";
import { isWhatsAppApiConfigured, sendWhatsAppViaApi } from "@/lib/whatsapp";

/**
 * Speed-to-lead: instant owner notifications the moment a lead arrives.
 * Responding within minutes (not hours) is the single biggest conversion
 * lever, so this fans out to every configured channel and never throws —
 * a failed ping must not fail the lead itself.
 *
 * Channels (all optional, best-effort):
 *  - ntfy.sh push (NTFY_TOPIC env) — free, no account: subscribe to the topic
 *    in the ntfy mobile app / browser and pushes arrive instantly.
 *  - Email (SMTP_* envs) to NOTIFY_EMAIL (falls back to SMTP_USER).
 *  - WhatsApp Cloud API (WHATSAPP_* envs) to NOTIFY_WHATSAPP.
 */
export async function notifyInstant(title: string, message: string): Promise<void> {
  await Promise.allSettled([notifyNtfy(title, message), notifyEmail(title, message), notifyWhatsApp(title, message)]);
}

async function notifyNtfy(title: string, message: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    // JSON publish (not headers) — HTTP headers are latin-1 only and would
    // reject emoji in the title.
    await fetch("https://ntfy.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, title, message, priority: 4, tags: ["moneybag"] }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("[notify] ntfy failed", err);
  }
}

async function notifyEmail(title: string, message: string): Promise<void> {
  if (!isEmailConfigured()) return;
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!to) return;
  try {
    await sendEmail({ to, subject: title, text: message });
  } catch (err) {
    console.error("[notify] email failed", err);
  }
}

async function notifyWhatsApp(title: string, message: string): Promise<void> {
  if (!isWhatsAppApiConfigured()) return;
  const to = process.env.NOTIFY_WHATSAPP;
  if (!to) return;
  try {
    await sendWhatsAppViaApi(to, `${title}\n\n${message}`);
  } catch (err) {
    console.error("[notify] whatsapp failed", err);
  }
}
