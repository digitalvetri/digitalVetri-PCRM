import { z } from "zod";
import { generateJSON } from "@/lib/ai/provider";
import { ANALYST_SYSTEM, KNOWN_MODULES } from "@/lib/ai/prompts";

// AI output is untrusted — coerce + default so a partial/hallucinated proposal
// still renders (and the PDF builder never hits an undefined field).
const proposalSchema = z.object({
  coverPage: z
    .object({ title: z.string().catch(""), subtitle: z.string().catch("") })
    .catch({ title: "", subtitle: "" }),
  companyOverview: z.string().catch(""),
  currentProblems: z
    .array(z.object({ title: z.string().catch(""), description: z.string().catch("") }))
    .catch([]),
  recommendedSolution: z.string().catch(""),
  scope: z.array(z.string()).catch([]),
  modules: z.array(z.object({ name: z.string().catch(""), description: z.string().catch("") })).catch([]),
  timeline: z
    .array(
      z.object({
        phase: z.string().catch(""),
        duration: z.string().catch(""),
        deliverables: z.string().catch(""),
      })
    )
    .catch([]),
  deliverables: z.array(z.string()).catch([]),
  technology: z.array(z.string()).catch([]),
  pricing: z
    .array(
      z.object({
        item: z.string().catch(""),
        description: z.string().catch(""),
        amount: z.coerce.number().catch(0),
      })
    )
    .catch([]),
  totalValue: z.coerce.number().catch(0),
  milestones: z.array(z.object({ milestone: z.string().catch(""), payment: z.string().catch("") })).catch([]),
  amc: z
    .object({ description: z.string().catch(""), annualValue: z.coerce.number().catch(0) })
    .catch({ description: "", annualValue: 0 }),
  support: z.string().catch(""),
  terms: z.array(z.string()).catch([]),
  signature: z
    .object({ company: z.string().catch(""), contact: z.string().catch(""), email: z.string().catch("") })
    .catch({ company: "", contact: "", email: "" }),
});

export type ProposalContent = z.infer<typeof proposalSchema>;

export async function generateProposal(input: {
  companyName: string;
  industry?: string | null;
  context: Record<string, unknown>;
}): Promise<ProposalContent> {
  const prompt = `Generate a complete, professional software development proposal from DigitalVetri to "${input.companyName}"${
    input.industry ? ` (${input.industry} industry)` : ""
  }.

Use the company analysis and recommendation context below. Pricing must be realistic Indian market pricing in INR (numbers only, no currency symbols in amount fields). Recommend modules ONLY from: ${KNOWN_MODULES}.

Context:
${JSON.stringify(input.context, null, 2)}

Make it specific to this company's problems and industry. Provide a phased timeline, milestone-based payments, an AMC (annual maintenance) plan, support terms, and standard commercial terms.`;

  const schema = `{
    "coverPage": { "title": string, "subtitle": string },
    "companyOverview": string,
    "currentProblems": [{ "title": string, "description": string }],
    "recommendedSolution": string,
    "scope": string[],
    "modules": [{ "name": string, "description": string }],
    "timeline": [{ "phase": string, "duration": string, "deliverables": string }],
    "deliverables": string[],
    "technology": string[],
    "pricing": [{ "item": string, "description": string, "amount": number }],
    "totalValue": number,
    "milestones": [{ "milestone": string, "payment": string }],
    "amc": { "description": string, "annualValue": number },
    "support": string,
    "terms": string[],
    "signature": { "company": string, "contact": string, "email": string }
  }`;

  return generateJSON<ProposalContent>(
    prompt,
    schema,
    { system: ANALYST_SYSTEM, temperature: 0.5, maxTokens: 8000 },
    proposalSchema
  );
}
