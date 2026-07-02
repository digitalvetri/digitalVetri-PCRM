import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { assessLead, type LeadInput } from "@/lib/ai/lead-discovery";
import { discoverPlaces, isPlacesConfigured } from "@/lib/places";
import { logActivity } from "@/lib/activity";

export const maxDuration = 300;

const leadSchema = z.object({
  name: z.string().trim().min(1),
  website: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
});

const bodySchema = z.object({
  leads: z.array(leadSchema).max(50).optional(),
  city: z.string().trim().optional(),
  industry: z.string().trim().optional(),
});

const MAX_PER_RUN = 12;

/** GET — reports whether the optional Google Places source is available. */
export async function GET() {
  return withApi(async () => {
    await requireUser("companies.create");
    return { placesConfigured: isPlacesConfigured() };
  });
}

/**
 * POST /api/leads/discover — qualify a batch of businesses. Sources: a pasted
 * list (`leads`) and/or Google Places (`industry` + `city`, if configured).
 * Each is assessed (need signals + best-fit service + score) and stored as a
 * DiscoveredLead. Capped per run to control AI cost.
 */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("companies.create");
    enforceRateLimit(`leads:discover:${user.id}`, 6, 60_000);
    const body = bodySchema.parse(await req.json());

    let candidates: LeadInput[] = body.leads ?? [];
    let source = "MANUAL";

    if (candidates.length === 0 && body.industry && body.city) {
      if (!isPlacesConfigured()) {
        throw new ApiError(
          400,
          "Google Places isn’t configured. Add GOOGLE_PLACES_API_KEY, or paste business names/websites to qualify."
        );
      }
      candidates = await discoverPlaces(`${body.industry} in ${body.city}`, MAX_PER_RUN);
      source = "PLACES";
      if (candidates.length === 0) throw new ApiError(404, "Google Places returned no businesses for that search.");
    }

    if (candidates.length === 0) {
      throw new ApiError(400, "Nothing to assess — paste business names/websites, or enable Google Places.");
    }
    candidates = candidates.slice(0, MAX_PER_RUN);

    let created = 0;
    const failed: string[] = [];
    for (const c of candidates) {
      try {
        const a = await assessLead({
          ...c,
          city: c.city ?? body.city ?? null,
          industry: c.industry ?? body.industry ?? null,
        });
        await prisma.discoveredLead.create({
          data: {
            name: c.name,
            website: c.website ?? undefined,
            phone: c.phone ?? undefined,
            city: c.city ?? body.city ?? undefined,
            industry: c.industry ?? body.industry ?? undefined,
            source,
            signals: a.signals,
            recommendedService: a.recommendedService,
            summary: a.summary,
            needScore: a.needScore,
            fitScore: a.fitScore,
            totalScore: a.totalScore,
            status: a.totalScore >= 60 ? "QUALIFIED" : "NEW",
            createdById: user.id,
          },
        });
        created += 1;
      } catch (err) {
        console.error("[leads discover] assess failed", c.name, err);
        failed.push(c.name);
      }
    }

    await logActivity({
      type: "COMPANY_IMPORTED",
      message: `${user.name} discovered & qualified ${created} lead(s)`,
      userId: user.id,
    });

    return { created, failed };
  });
}
