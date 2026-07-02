import type { Transporter } from "nodemailer";
import { ApiError } from "@/lib/api-error";

/**
 * SMTP email sending. Configured entirely via env so mail is sent from the
 * business address (e.g. info@digitalvetri.com):
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
 *   SMTP_FROM (defaults to SMTP_USER), SMTP_SECURE ("true" for port 465).
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let cachedTransport: Transporter | null = null;

async function getTransport(): Promise<Transporter> {
  if (cachedTransport) return cachedTransport;
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT ?? 587);
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransport;
}

/** Render plain text as simple, safe HTML (escaped, newlines → <br>). */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">${escaped.replace(/\n/g, "<br>")}</div>`;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  if (!isEmailConfigured()) {
    throw new ApiError(
      500,
      "Email sending isn’t configured. Add SMTP_HOST / SMTP_USER / SMTP_PASS to your .env, then restart."
    );
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const transport = await getTransport();
  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: textToHtml(input.text),
      replyTo: input.replyTo,
    });
    return { messageId: info.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/auth|credential|535|username|password/i.test(msg)) {
      throw new ApiError(401, "SMTP rejected the login. Check SMTP_USER / SMTP_PASS (use an app password for Gmail/Workspace).");
    }
    console.error("[email] send failed", err);
    throw new ApiError(502, "Could not send the email via SMTP. Please check your mail settings and try again.");
  }
}
