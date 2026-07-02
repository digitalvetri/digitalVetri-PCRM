import type { ImportSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { fetchPublicPageText } from "@/lib/fetch-public";

export interface RawCompanyInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  publicEmail?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
  employeeEstimate?: number | null;
  revenueEstimate?: string | null;
  googleRating?: number | null;
  sourceUrl?: string | null;
}

/** Create a company shell record from raw input, deduped by slug. */
export async function createCompanyShell(
  input: RawCompanyInput,
  source: ImportSource,
  raw?: Record<string, unknown>
) {
  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let n = 1;
  while (await prisma.company.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  const domain = input.website ? safeHostname(input.website) : null;

  return prisma.company.create({
    data: {
      name: input.name.trim(),
      slug,
      domain,
      website: input.website ?? undefined,
      industry: input.industry ?? undefined,
      city: input.city ?? undefined,
      state: input.state ?? undefined,
      phone: input.phone ?? undefined,
      publicEmail: input.publicEmail ?? undefined,
      address: input.address ?? undefined,
      linkedinUrl: input.linkedinUrl ?? undefined,
      linkedinPresence: Boolean(input.linkedinUrl),
      employeeEstimate: input.employeeEstimate ?? undefined,
      employeeConfidence: input.employeeEstimate ? "ESTIMATED" : "UNKNOWN",
      revenueEstimate: input.revenueEstimate ?? undefined,
      revenueConfidence: input.revenueEstimate ? "ESTIMATED" : "UNKNOWN",
      googleRating: input.googleRating ?? undefined,
      importSource: source,
      sourceUrl: input.sourceUrl ?? input.website ?? undefined,
      rawImportData: raw as object,
    },
  });
}

/** Best-effort public text gathering for AI enrichment (respects robots.txt). */
export async function gatherPublicText(website?: string | null): Promise<string | null> {
  if (!website) return null;
  try {
    return await fetchPublicPageText(website);
  } catch {
    return null;
  }
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Map a spreadsheet row (arbitrary headers) to RawCompanyInput. */
export function mapExcelRow(row: Record<string, string>): RawCompanyInput | null {
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const found = Object.entries(row).find(
        ([h]) => h.toLowerCase().replace(/[^a-z]/g, "") === key.toLowerCase().replace(/[^a-z]/g, "")
      );
      if (found && found[1]) return found[1].trim();
    }
    return undefined;
  };

  const name = get("name", "companyname", "company", "organisation", "organization");
  if (!name) return null;

  const employees = get("employees", "employeeestimate", "employeecount", "staff", "headcount");
  const rating = get("googlerating", "rating");

  return {
    name,
    website: get("website", "url", "web") ?? null,
    industry: get("industry", "sector") ?? null,
    city: get("city", "location") ?? null,
    state: get("state", "region") ?? null,
    phone: get("phone", "mobile", "contact", "phonenumber") ?? null,
    publicEmail: get("email", "publicemail", "emailaddress") ?? null,
    address: get("address", "fulladdress") ?? null,
    linkedinUrl: get("linkedin", "linkedinurl") ?? null,
    employeeEstimate: employees ? parseInt(employees.replace(/\D/g, ""), 10) || null : null,
    revenueEstimate: get("revenue", "revenueestimate", "turnover") ?? null,
    googleRating: rating ? parseFloat(rating) || null : null,
  };
}
