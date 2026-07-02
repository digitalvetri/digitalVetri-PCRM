import { generateEmail, generateWhatsApp, type ContentContext } from "@/lib/ai/content";

export type OutreachChannel = "EMAIL" | "WHATSAPP";

export interface LeadForDraft {
  name: string;
  industry?: string | null;
  city?: string | null;
  signals?: string[];
  recommendedService?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface OutreachDraftResult {
  subject: string | null;
  body: string;
  toContact: string | null;
}

/**
 * Draft a first-touch outreach message for a discovered lead. Reuses the
 * existing content generators, mapping the lead's detected needs → the message
 * context (signals become pain points, the recommended service is the hook).
 */
export async function draftOutreachForLead(
  lead: LeadForDraft,
  channel: OutreachChannel
): Promise<OutreachDraftResult> {
  const ctx: ContentContext = {
    companyName: lead.name,
    industry: lead.industry ?? undefined,
    city: lead.city ?? undefined,
    painPoints: lead.signals ?? [],
    suggestedModules: lead.recommendedService ? [lead.recommendedService] : [],
    senderName: "the DigitalVetri team",
  };

  if (channel === "EMAIL") {
    const { subject, body } = await generateEmail("COLD_OUTREACH", ctx);
    return { subject, body, toContact: lead.email ?? null };
  }
  const body = await generateWhatsApp("FIRST_CONTACT", ctx);
  return { subject: null, body, toContact: lead.phone ?? null };
}
