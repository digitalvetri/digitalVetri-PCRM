import { generateText } from "@/lib/ai/provider";
import { ANALYST_SYSTEM } from "@/lib/ai/prompts";
import { BRAND } from "@/lib/constants";

export type EmailCategory =
  | "COLD_OUTREACH"
  | "FOLLOW_UP"
  | "MEETING_REQUEST"
  | "PROPOSAL_FOLLOW_UP"
  | "THANK_YOU";

export type WhatsAppCategory =
  | "FIRST_CONTACT"
  | "FOLLOW_UP"
  | "MEETING_REMINDER"
  | "PROPOSAL_REMINDER"
  | "FESTIVAL_GREETING"
  | "REVIEW_REQUEST"
  | "REFERRAL_REQUEST";

const EMAIL_INTENT: Record<EmailCategory, string> = {
  COLD_OUTREACH:
    "a first-touch cold email introducing DigitalVetri and how a custom CRM/automation solution could help their specific business. Lead with a relevant insight about their industry, not a generic pitch.",
  FOLLOW_UP: "a polite follow-up email after no response, adding a new angle or value, keeping it short.",
  MEETING_REQUEST: "an email requesting a 30-minute discovery meeting, proposing two time options.",
  PROPOSAL_FOLLOW_UP: "a follow-up on a proposal already sent, offering to clarify scope/pricing and answer questions.",
  THANK_YOU: "a warm thank-you email after a meeting, summarising next steps.",
};

const WHATSAPP_INTENT: Record<WhatsAppCategory, string> = {
  FIRST_CONTACT: "a professional first-contact WhatsApp message introducing DigitalVetri briefly and asking to connect.",
  FOLLOW_UP: "a short, friendly follow-up WhatsApp message.",
  MEETING_REMINDER: "a courteous meeting reminder WhatsApp message with date/time placeholder.",
  PROPOSAL_REMINDER: "a gentle proposal reminder WhatsApp message.",
  FESTIVAL_GREETING: "a warm festival greeting WhatsApp message that keeps the relationship alive without hard selling.",
  REVIEW_REQUEST: "a polite WhatsApp message requesting a Google review after successful delivery.",
  REFERRAL_REQUEST: "a friendly WhatsApp message asking for a referral to other businesses who might benefit.",
};

export interface ContentContext {
  companyName?: string;
  industry?: string | null;
  city?: string | null;
  contactName?: string | null;
  contactDesignation?: string | null;
  painPoints?: string[];
  suggestedModules?: string[];
  senderName?: string;
  tone?: string;
  language?: string;
}

export async function generateEmail(
  category: EmailCategory,
  ctx: ContentContext
): Promise<{ subject: string; body: string }> {
  const raw = await generateText(
    `Write ${EMAIL_INTENT[category]}

Sender: ${ctx.senderName ?? "the DigitalVetri sales team"} at ${BRAND.name} (${BRAND.website}, ${BRAND.email}).
Recipient company: ${ctx.companyName ?? "the prospect"}${ctx.industry ? `, industry: ${ctx.industry}` : ""}${ctx.city ? `, city: ${ctx.city}` : ""}.
Contact: ${ctx.contactName ?? "there"}${ctx.contactDesignation ? ` (${ctx.contactDesignation})` : ""}.
Known pain points: ${(ctx.painPoints ?? []).join("; ") || "unknown"}.
Relevant modules: ${(ctx.suggestedModules ?? []).join(", ") || "custom CRM / automation"}.
Tone: ${ctx.tone ?? "professional, warm, concise"}. Language: ${ctx.language ?? "English"}.

Return in this exact format:
Subject: <one line subject>
<blank line>
<email body with a greeting, 2-3 short paragraphs, a clear CTA, and a signature block>`,
    { system: ANALYST_SYSTEM, temperature: 0.7 }
  );
  return splitSubjectBody(raw);
}

export async function generateWhatsApp(category: WhatsAppCategory, ctx: ContentContext): Promise<string> {
  return generateText(
    `Write ${WHATSAPP_INTENT[category]}

Company: ${ctx.companyName ?? "the prospect"}${ctx.industry ? ` (${ctx.industry})` : ""}.
Contact: ${ctx.contactName ?? "there"}.
Sender: ${ctx.senderName ?? "DigitalVetri"} (${BRAND.name}).
Tone: ${ctx.tone ?? "professional but friendly"}. Language: ${ctx.language ?? "English"}.

Rules: keep it under 90 words, WhatsApp-appropriate, use line breaks, no markdown, may include 1-2 tasteful emojis. Return only the message text.`,
    { system: ANALYST_SYSTEM, temperature: 0.75 }
  );
}

function splitSubjectBody(raw: string): { subject: string; body: string } {
  const match = raw.match(/subject\s*:\s*(.+)/i);
  const subject = match ? match[1].trim() : "Let's explore a custom solution for your business";
  const body = raw.replace(/subject\s*:\s*.+/i, "").trim();
  return { subject, body: body || raw.trim() };
}
