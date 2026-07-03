import { prisma } from "@/lib/prisma";

/**
 * Buyer-Intent Radar — finds people who are ACTIVELY asking to buy software
 * services right now (posted projects with budgets), rather than businesses
 * that merely exist on a map. Current source: Freelancer.com's public projects
 * API (no key needed). Architected so more intent sources can be added later.
 *
 * These hits are not AI-scored: posting a paid project IS the qualification.
 * A fast heuristic scores them instead (no AI-quota dependency).
 */

interface IntentQuery {
  query: string;
  service: string; // matching DigitalVetri service (from SERVICES)
}

/** What we scan for, mapped to the service we'd pitch. */
export const INTENT_QUERIES: IntentQuery[] = [
  { query: "website development", service: "Website Development" },
  { query: "digital marketing", service: "Digital Marketing (SEO, Social Media, Paid Ads)" },
  { query: "CRM software", service: "Custom CRM Development" },
  { query: "mobile app development", service: "Mobile App Development" },
  { query: "whatsapp chatbot", service: "WhatsApp Business Automation" },
  { query: "AI automation", service: "AI Automation & Chatbots" },
  { query: "web application", service: "SaaS / Web App Development" },
];

export interface IntentHit {
  title: string;
  description: string;
  url: string;
  budget: string | null;
  currency: string | null;
  service: string;
}

interface FreelancerResponse {
  result?: {
    projects?: {
      title?: string;
      preview_description?: string;
      description?: string;
      seo_url?: string;
      budget?: { minimum?: number; maximum?: number };
      currency?: { code?: string };
    }[];
  };
}

/** Fetch live posted projects for one query (public API, no key). */
async function fetchFreelancerProjects(q: IntentQuery, limit: number): Promise<IntentHit[]> {
  const res = await fetch(
    `https://www.freelancer.com/api/projects/0.1/projects/active/?query=${encodeURIComponent(q.query)}` +
      `&limit=${limit}&compact=true&full_description=true`,
    {
      headers: { "User-Agent": "DigitalVetri-CRM/1.0" },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as FreelancerResponse | null;
  return (data?.result?.projects ?? [])
    .filter((p) => p.title && p.seo_url)
    .map((p) => {
      const b = p.budget ?? {};
      const cur = p.currency?.code ?? null;
      const budget =
        b.minimum != null || b.maximum != null
          ? `${b.minimum ?? "?"}–${b.maximum ?? "?"} ${cur ?? ""}`.trim()
          : null;
      return {
        title: p.title!.slice(0, 120),
        description: (p.description ?? p.preview_description ?? "").slice(0, 1500),
        url: `https://www.freelancer.com/projects/${p.seo_url}`,
        budget,
        currency: cur,
        service: q.service,
      };
    });
}

/** Heuristic scoring — actively-hiring posts start high; INR/size add fit. */
function scoreHit(h: IntentHit): { needScore: number; fitScore: number; totalScore: number } {
  const needScore = 85; // they are literally asking to buy right now
  let fitScore = 65;
  if (h.currency === "INR") fitScore += 20; // Indian buyer — ideal for DigitalVetri
  if (h.budget && /\d{4,}/.test(h.budget)) fitScore += 5; // non-trivial budget
  fitScore = Math.min(100, fitScore);
  return { needScore, fitScore, totalScore: Math.round(needScore * 0.6 + fitScore * 0.4) };
}

/**
 * Scan intent sources and store fresh hits as QUALIFIED DiscoveredLeads
 * (source=INTENT, website=the live post URL to respond on). Dedupes by URL.
 */
export async function scanBuyerIntent(maxCreate = 10): Promise<{ created: number; scanned: number }> {
  // Rotate a slice of queries per run so the whole portfolio gets covered
  // across runs without hammering the source.
  const start = new Date().getDate() % INTENT_QUERIES.length;
  const rotation = [...INTENT_QUERIES.slice(start), ...INTENT_QUERIES.slice(0, start)].slice(0, 4);

  let created = 0;
  let scanned = 0;
  for (const q of rotation) {
    if (created >= maxCreate) break;
    let hits: IntentHit[] = [];
    try {
      hits = await fetchFreelancerProjects(q, 8);
    } catch {
      continue; // one source/query failing must not sink the scan
    }
    for (const h of hits) {
      if (created >= maxCreate) break;
      scanned++;
      const dup = await prisma.discoveredLead.findFirst({ where: { website: h.url } });
      if (dup) continue;
      const s = scoreHit(h);
      await prisma.discoveredLead.create({
        data: {
          name: h.title,
          website: h.url,
          source: "INTENT",
          signals: [
            "Actively hiring right now",
            "Posted a paid project",
            ...(h.budget ? [`Budget: ${h.budget}`] : []),
            ...(h.currency === "INR" ? ["Indian buyer (INR)"] : []),
          ],
          recommendedService: h.service,
          summary: `Live project on Freelancer: “${h.title}”${h.budget ? ` — budget ${h.budget}` : ""}. ${h.description.slice(0, 240)}`,
          needScore: s.needScore,
          fitScore: s.fitScore,
          totalScore: s.totalScore,
          status: "QUALIFIED",
        },
      });
      created++;
    }
  }
  return { created, scanned };
}
