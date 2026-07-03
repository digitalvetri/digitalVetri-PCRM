import type { LeadInput } from "@/lib/ai/lead-discovery";

/**
 * Local-business discovery for the autonomous agent — pulls real businesses by
 * "industry in city". Two interchangeable providers:
 *   - Google Places (v1) — best coverage, needs GOOGLE_PLACES_API_KEY (billing).
 *   - Geoapify Places (v2) — free tier, no card, needs GEOAPIFY_API_KEY.
 * Google wins if both are set. Degrades to [] when neither is, so the rest of
 * the engine (morning briefing etc.) still works.
 */
export function isPlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GEOAPIFY_API_KEY);
}

/** Route a "Industry in City" query to whichever provider is configured. */
export async function discoverPlaces(query: string, limit = 10): Promise<LeadInput[]> {
  if (process.env.GOOGLE_PLACES_API_KEY) return discoverGoogle(query, limit);
  if (process.env.GEOAPIFY_API_KEY) return discoverGeoapify(query, limit);
  return [];
}

// ---------------------------------------------------------------------------
// Google Places (v1)
// ---------------------------------------------------------------------------

interface GooglePlacesResponse {
  places?: {
    displayName?: { text?: string };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    formattedAddress?: string;
  }[];
}

async function discoverGoogle(query: string, limit: number): Promise<LeadInput[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY!;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(20, limit), regionCode: "IN" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as GooglePlacesResponse | null;
  return (data?.places ?? []).slice(0, limit).map((p) => ({
    name: p.displayName?.text ?? "Unknown business",
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    city: p.formattedAddress ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Geoapify Places (v2) — free, no billing card
// ---------------------------------------------------------------------------

/** Split "Manufacturing in Coimbatore" → { industry, city }. */
function splitQuery(query: string): { industry: string; city: string } {
  const idx = query.toLowerCase().lastIndexOf(" in ");
  if (idx === -1) return { industry: query.trim(), city: "" };
  return { industry: query.slice(0, idx).trim(), city: query.slice(idx + 4).trim() };
}

/** Map a free-text industry to Geoapify's category taxonomy (best-effort). */
function geoapifyCategories(industry: string): string {
  const s = industry.toLowerCase();
  // `production` = factories/industrial (verified: returns LMW, Roots, mills…);
  // `office` = firms/agencies; `commercial` = retail/shops. Only valid top-level
  // Geoapify categories (subcategories like commercial.industrial 400).
  if (/manufactur|factory|industr|production|engineer|textile|machin|fabricat|mill|foundry|plant/.test(s))
    return "production";
  if (/market|agenc|media|advertis|design|software|\bit\b|tech|web|digital|consult|service/.test(s))
    return "office";
  if (/retail|shop|store|trade|wholesale|distribut|export|import/.test(s)) return "commercial";
  if (/hospital|clinic|health|pharma|medical|diagnostic/.test(s)) return "healthcare";
  if (/hotel|restaurant|catering|food|resort/.test(s)) return "catering,accommodation";
  if (/education|school|college|coaching|institute|academy|training/.test(s)) return "education";
  return "production,office,commercial";
}

interface GeoapifyGeocode {
  results?: { lon?: number; lat?: number }[];
}
interface GeoapifyPlaces {
  features?: {
    properties?: {
      name?: string;
      formatted?: string;
      address_line2?: string;
      website?: string;
      contact?: { phone?: string };
      datasource?: { raw?: Record<string, string> };
    };
  }[];
}

async function discoverGeoapify(query: string, limit: number): Promise<LeadInput[]> {
  const key = process.env.GEOAPIFY_API_KEY!;
  const { industry, city } = splitQuery(query);
  if (!city) return [];

  // 1) Geocode the city to a centre point (restricted to India).
  const geoRes = await fetch(
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}` +
      `&type=city&filter=countrycode:in&format=json&limit=1&apiKey=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!geoRes.ok) return [];
  const geo = (await geoRes.json().catch(() => null)) as GeoapifyGeocode | null;
  const centre = geo?.results?.[0];
  if (centre?.lon == null || centre?.lat == null) return [];

  // 2) Search businesses of the mapped categories within ~25km of the centre.
  const categories = geoapifyCategories(industry);
  const placesRes = await fetch(
    `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(categories)}` +
      `&filter=circle:${centre.lon},${centre.lat},25000` +
      `&bias=proximity:${centre.lon},${centre.lat}` +
      `&limit=${Math.min(50, Math.max(limit * 3, limit))}&apiKey=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!placesRes.ok) return [];
  const data = (await placesRes.json().catch(() => null)) as GeoapifyPlaces | null;

  const leads: LeadInput[] = [];
  for (const f of data?.features ?? []) {
    const p = f.properties;
    const name = p?.name?.trim();
    if (!name) continue; // skip unnamed map features
    const raw = p?.datasource?.raw ?? {};
    leads.push({
      name,
      website: p?.website ?? raw.website ?? null,
      phone: p?.contact?.phone ?? raw["contact:phone"] ?? raw.phone ?? null,
      city: p?.formatted ?? p?.address_line2 ?? city,
      industry: industry || null,
    });
    if (leads.length >= limit) break;
  }
  return leads;
}
