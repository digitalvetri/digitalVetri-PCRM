import { z } from "zod";
import { generateJSON } from "@/lib/ai/provider";
import { gatherPublicText } from "@/lib/import";
import { extractContacts } from "@/lib/enrich";
import { ANALYST_SYSTEM, KNOWN_SERVICES } from "@/lib/ai/prompts";

export interface LeadInput {
  name: string;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  industry?: string | null;
}

const assessmentSchema = z.object({
  signals: z.array(z.string()).catch([]),
  recommendedService: z.string().catch(""),
  summary: z.string().catch(""),
  needScore: z.coerce.number().catch(0),
  fitScore: z.coerce.number().catch(0),
});

export interface LeadAssessment {
  signals: string[];
  recommendedService: string;
  summary: string;
  needScore: number; // 0-100 how strongly they need a DigitalVetri service
  fitScore: number; // 0-100 ICP match
  totalScore: number; // blended
  hasWebsite: boolean;
  email: string | null; // scraped from the public site (best-effort)
  phone: string | null; // scraped from the public site (best-effort)
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));

/**
 * Assess a business as a prospect: read its public website (if any), detect
 * concrete "need" signals, recommend the best-fit DigitalVetri service and
 * score need + fit. Zero external dependencies beyond the AI provider —
 * a missing/weak website is itself the strongest "needs Website Development"
 * signal, so this works even when the business has no site at all.
 */
export async function assessLead(input: LeadInput): Promise<LeadAssessment> {
  // Resilient scrape: a fetch failure must not sink the whole assessment (a
  // missing site is itself the strongest "needs a website" signal).
  let publicText: string | null = null;
  if (input.website) {
    try {
      publicText = await gatherPublicText(input.website);
    } catch {
      publicText = null;
    }
  }
  const hasWebsite = Boolean(publicText && publicText.length > 200);
  const contacts = publicText ? extractContacts(publicText) : { email: null, phone: null };

  const prompt = `You are prospecting for DigitalVetri, an Indian tech company offering: ${KNOWN_SERVICES}.
Assess this business as a potential client — identify which service(s) they most need, backed by evidence.

Business:
- Name: ${input.name}
- Website: ${input.website ?? "NONE PROVIDED"}
- City: ${input.city ?? "unknown"}
- Industry: ${input.industry ?? "unknown"}
${
  publicText
    ? `\nPublic website text (may be truncated):\n"""\n${publicText.slice(0, 6000)}\n"""`
    : "\nNo usable public website content was found — treat this as a strong signal they need Website Development / a proper online presence."
}

Identify concrete NEED signals from the evidence, e.g.: "No website", "Not mobile-friendly", "No online enquiry/booking", "No WhatsApp chat", "No e-commerce / product catalogue", "Weak SEO / few reviews", "Manual/legacy processes", "Growth/hiring signals". Recommend the SINGLE best-fit service from the portfolio. Score: needScore 0-100 (how strongly they need a DigitalVetri service), fitScore 0-100 (how well they match an ideal Indian SME/mid-market client). Keep the summary to 1-2 sentences.`;

  const r = await generateJSON(
    prompt,
    `{ "signals": string[], "recommendedService": string, "summary": string, "needScore": number, "fitScore": number }`,
    { system: ANALYST_SYSTEM, temperature: 0.3 },
    assessmentSchema
  );

  const needScore = clamp(r.needScore);
  const fitScore = clamp(r.fitScore);
  // Need weighted higher — we want businesses with a real, addressable gap.
  const totalScore = Math.round(needScore * 0.6 + fitScore * 0.4);

  return {
    signals: r.signals.slice(0, 8),
    recommendedService: r.recommendedService,
    summary: r.summary,
    needScore,
    fitScore,
    totalScore,
    hasWebsite,
    email: contacts.email,
    phone: contacts.phone,
  };
}
