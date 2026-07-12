/**
 * Voice/text COMMANDS for Vetri — turning "we onboarded Sri Textiles" or
 * "payment received 50000 from Sri Textiles" into real records.
 *
 * Safety: extraction never writes. The route resolves + echoes the values and
 * the client requires an explicit Save tap before executeCommand() runs. Every
 * write re-checks the permission server-side.
 */
import { z } from "zod";
import { generateJSON } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { createCompanyShell } from "@/lib/import";
import { ApiError } from "@/lib/api-error";
import type { AssistantLang } from "@/lib/ai/assistant";

export interface CompanyFields {
  name: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface Interpreted {
  intent: "add_company" | "record_payment" | "none";
  name?: string | null; // company name (add_company)
  company?: string | null; // company name (record_payment)
  amount?: number | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  note?: string | null;
}

const schema = z.object({
  intent: z.enum(["add_company", "record_payment", "none"]).catch("none"),
  name: z.string().nullable().catch(null),
  company: z.string().nullable().catch(null),
  amount: z.coerce.number().nullable().catch(null),
  industry: z.string().nullable().catch(null),
  city: z.string().nullable().catch(null),
  state: z.string().nullable().catch(null),
  phone: z.string().nullable().catch(null),
  email: z.string().nullable().catch(null),
  website: z.string().nullable().catch(null),
  note: z.string().nullable().catch(null),
});

/** Extract a command + params from an utterance (handles English + Tamil). NEVER writes. */
export async function interpretCommand(message: string, lang: AssistantLang = "en"): Promise<Interpreted> {
  return generateJSON<Interpreted>(
    `The founder said (may be Tamil or English): "${message}"

Decide if this is a COMMAND to record data, and extract fields. Intents:
- "add_company": onboarding / adding a new company/client. Extract "name" and any of industry, city, state, phone, email, website mentioned.
- "record_payment": a payment received from a client. Extract "company" (the client name) and "amount" as a plain number in rupees (convert spoken Tamil/English number words, e.g. "ஐம்பதாயிரம்"/"fifty thousand" → 50000). Optional "note".
- "none": anything else (a question, chit-chat).

Only extract what is clearly stated. Use null for anything not mentioned.`,
    `{ "intent": "add_company"|"record_payment"|"none", "name": string|null, "company": string|null, "amount": number|null, "industry": string|null, "city": string|null, "state": string|null, "phone": string|null, "email": string|null, "website": string|null, "note": string|null }`,
    { temperature: 0.1 },
    schema
  );
}

export interface CompanyMatch {
  id: string;
  name: string;
  city: string | null;
}

/** Resolve a spoken company name to real companies (for payment readback). */
export async function matchCompanies(name: string): Promise<CompanyMatch[]> {
  const rows = await prisma.company.findMany({
    where: { name: { contains: name.trim(), mode: "insensitive" } },
    select: { id: true, name: true, city: true },
    take: 5,
    orderBy: { name: "asc" },
  });
  return rows;
}

// ---------------------------------------------------------------
// Execute (called only after the user taps Save; permission-gated at the route)
// ---------------------------------------------------------------

export async function executeAddCompany(fields: CompanyFields) {
  if (!fields.name?.trim()) throw new ApiError(400, "A company name is required.");
  const company = await createCompanyShell(
    {
      name: fields.name,
      industry: fields.industry ?? undefined,
      city: fields.city ?? undefined,
      state: fields.state ?? undefined,
      phone: fields.phone ?? undefined,
      publicEmail: fields.email ?? undefined,
      website: fields.website ?? undefined,
    },
    "MANUAL"
  );
  return { id: company.id, name: company.name };
}

export async function executeRecordPayment(input: { companyId: string; amount: number; note?: string | null; userId: string }) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true, name: true } });
  if (!company) throw new ApiError(404, "Company not found.");
  if (!(input.amount > 0)) throw new ApiError(400, "Amount must be greater than zero.");
  await prisma.revenueEntry.create({
    data: {
      companyId: company.id,
      date: new Date(),
      kind: "PROJECT",
      amount: input.amount,
      status: "PAID",
      paidAt: new Date(),
      note: input.note || undefined,
      createdById: input.userId,
    },
  });
  return { company: company.name, amount: input.amount };
}
