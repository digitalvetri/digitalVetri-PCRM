import type { LeadInput } from "@/lib/ai/lead-discovery";

/**
 * Optional Google Places (v1) discovery — pulls real local businesses by
 * "industry in city". Activates only when GOOGLE_PLACES_API_KEY is set (a
 * server key with the Places API enabled + billing). Degrades to [] otherwise,
 * so the rest of the engine works without it.
 */
export function isPlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

interface PlacesResponse {
  places?: {
    displayName?: { text?: string };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    formattedAddress?: string;
  }[];
}

export async function discoverPlaces(query: string, limit = 10): Promise<LeadInput[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

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
  const data = (await res.json().catch(() => null)) as PlacesResponse | null;
  return (data?.places ?? []).slice(0, limit).map((p) => ({
    name: p.displayName?.text ?? "Unknown business",
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    city: p.formattedAddress ?? null,
  }));
}
