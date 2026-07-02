import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createCompanyShell, gatherPublicText, mapExcelRow, type RawCompanyInput } from "@/lib/import";
import { enrichCompany, applyEnrichment } from "@/lib/ai/analyze";
import { parseWorkbook } from "@/lib/excel";
import { logActivity } from "@/lib/activity";
import type { ImportSource } from "@prisma/client";

/**
 * POST /api/companies/import
 * Handles two modes:
 *  - multipart/form-data with an .xlsx/.csv file  -> bulk import + AI enrich
 *  - application/json { source, entries[], enrich } -> URL / maps / manual bulk
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("companies.import");
    enforceRateLimit(`ai:import:${user.id}`, 5, 60_000);
    const contentType = req.headers.get("content-type") ?? "";

    let rawInputs: RawCompanyInput[] = [];
    let source: ImportSource = "MANUAL";
    let enrich = true;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      enrich = form.get("enrich") !== "false";
      source = file?.name.toLowerCase().endsWith(".csv") ? "CSV" : "EXCEL";
      if (!file) return { imported: 0, errors: ["No file provided"] };
      const buffer = Buffer.from(await file.arrayBuffer());
      const rows = await parseWorkbook(buffer, file.name);
      rawInputs = rows.map(mapExcelRow).filter((x): x is RawCompanyInput => x !== null);
    } else {
      const body = z
        .object({
          source: z.enum(["MANUAL", "GOOGLE_MAPS", "LINKEDIN", "WEBSITE"]).default("WEBSITE"),
          enrich: z.boolean().default(true),
          entries: z
            .array(
              z.object({
                name: z.string().min(1),
                website: z.string().nullable().optional(),
                sourceUrl: z.string().nullable().optional(),
                city: z.string().nullable().optional(),
                state: z.string().nullable().optional(),
                industry: z.string().nullable().optional(),
                phone: z.string().nullable().optional(),
                publicEmail: z.string().nullable().optional(),
                linkedinUrl: z.string().nullable().optional(),
              })
            )
            .min(1),
        })
        .parse(await req.json());
      source = body.source;
      enrich = body.enrich;
      rawInputs = body.entries;
    }

    const errors: string[] = [];
    let imported = 0;
    const createdIds: string[] = [];

    // Cap synchronous enrichment to keep the request responsive.
    const ENRICH_LIMIT = 15;

    for (const input of rawInputs) {
      try {
        const company = await createCompanyShell(input, source, input as unknown as Record<string, unknown>);
        createdIds.push(company.id);
        imported++;

        if (enrich && imported <= ENRICH_LIMIT) {
          const publicText = await gatherPublicText(company.website);
          const enrichment = await enrichCompany({
            name: company.name,
            website: company.website,
            publicText,
            hints: { city: company.city, state: company.state, industry: company.industry },
          });
          await applyEnrichment(company.id, enrichment);
        }
      } catch (err) {
        errors.push(`${input.name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await logActivity({
      type: "COMPANY_IMPORTED",
      message: `${user.name} imported ${imported} companies via ${source}`,
      userId: user.id,
      metadata: { imported, source },
    });

    return {
      imported,
      enriched: enrich ? Math.min(imported, ENRICH_LIMIT) : 0,
      createdIds,
      errors,
      note:
        enrich && imported > ENRICH_LIMIT
          ? `AI-enriched the first ${ENRICH_LIMIT}. Analyse the rest individually from each company page.`
          : undefined,
    };
  });
}
