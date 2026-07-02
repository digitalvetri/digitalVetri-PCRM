import { z } from "zod";
import { generateJSON } from "@/lib/ai/provider";
import { ANALYST_SYSTEM } from "@/lib/ai/prompts";

const questionnaireSectionSchema = z.object({
  section: z.string().catch(""),
  questions: z
    .array(
      z.object({
        q: z.string().catch(""),
        answer: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .catch([]),
});

const questionnaireSchema = z.object({
  sections: z.array(questionnaireSectionSchema).catch([]),
});

export type QuestionnaireSection = z.infer<typeof questionnaireSectionSchema>;

/**
 * Baseline discovery questionnaires per industry. The AI expands these to
 * meet the minimum question count and tailor to the specific company.
 * Manufacturing carries 80+ questions; other industries have their own sets.
 */
const MIN_QUESTIONS: Record<string, number> = {
  Manufacturing: 80,
  Construction: 55,
  Healthcare: 55,
  Education: 50,
  Logistics: 55,
  default: 45,
};

export function minQuestionsFor(industry: string): number {
  return MIN_QUESTIONS[industry] ?? MIN_QUESTIONS.default;
}

export async function generateQuestionnaire(input: {
  companyName: string;
  industry: string;
  subIndustry?: string | null;
  context?: Record<string, unknown>;
}): Promise<QuestionnaireSection[]> {
  const min = minQuestionsFor(input.industry);
  const prompt = `Create a comprehensive discovery-meeting questionnaire for a sales/requirements meeting with "${input.companyName}", a company in the ${input.industry}${
    input.subIndustry ? ` (${input.subIndustry})` : ""
  } industry.

The questionnaire must:
- Contain AT LEAST ${min} distinct, specific questions total.
- Be organised into logical sections (e.g. Company Overview, Current Systems & Tools, Sales & CRM, Procurement & Purchase, Inventory & Warehouse, Production & Operations, Quality, HR/Payroll/Attendance, Finance & Accounts, Dispatch & Logistics, Service & AMC, Reporting & Analytics, Communication & Approvals, Pain Points & Priorities, Budget & Timeline).
- Be tailored to the ${input.industry} industry with domain-specific questions.
- Focus on uncovering manual processes, Excel usage, bottlenecks, automation and software opportunities.

Extra context: ${JSON.stringify(input.context ?? {})}`;

  const result = await generateJSON<{ sections: QuestionnaireSection[] }>(
    prompt,
    `{ "sections": [{ "section": string, "questions": [{ "q": string }] }] }`,
    { system: ANALYST_SYSTEM, temperature: 0.5, maxTokens: 8000 },
    questionnaireSchema
  );
  return result.sections ?? [];
}
