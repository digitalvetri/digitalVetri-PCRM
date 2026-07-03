import { prisma } from "@/lib/prisma";
import { extractContacts } from "@/lib/enrich";

/**
 * Buyer-Intent Radar — finds people ACTIVELY asking to hire for software work
 * right now, restricted to sources where the buyer can be contacted DIRECTLY
 * and FREE (no pay-to-bid marketplaces):
 *
 *  - HackerNews "SEEKING FREELANCER" posts (Algolia API, keyless) — contact via
 *    the email in the post or a direct reply.
 *  - Reddit r/forhire "[Hiring]" posts (free app credentials via
 *    REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET) — contact via free Reddit DM.
 *
 * Hits are heuristically scored (posting a hiring request IS the
 * qualification), stored as QUALIFIED DiscoveredLeads (source=INTENT,
 * website=the live post URL). Deduped by URL.
 */

const UA = "DigitalVetri-CRM/1.0";

const SOFTWARE_KEYWORDS =
  /website|web\s?app|\bapp\b|developer|development|software|\bCRM\b|automation|chatbot|marketing|\bSEO\b|wordpress|shopify|e-?commerce|dashboard|\bAPI\b|\bAI\b|full[- ]?stack|frontend|backend/i;

/** Map post text to the closest DigitalVetri service. */
function serviceFor(text: string): string {
  const s = text.toLowerCase();
  if (/marketing|seo|social media|ads|instagram|facebook/.test(s))
    return "Digital Marketing (SEO, Social Media, Paid Ads)";
  if (/whatsapp/.test(s)) return "WhatsApp Business Automation";
  if (/chatbot|\bai\b|automation|llm|gpt/.test(s)) return "AI Automation & Chatbots";
  if (/mobile|android|ios|flutter|react native/.test(s)) return "Mobile App Development";
  if (/\bcrm\b/.test(s)) return "Custom CRM Development";
  if (/\berp\b/.test(s)) return "ERP Development";
  if (/saas|web ?app|platform|full[- ]?stack|api|dashboard/.test(s))
    return "SaaS / Web App Development";
  return "Website Development";
}

export interface IntentHit {
  platform: "HackerNews" | "Reddit";
  title: string;
  description: string;
  url: string;
  contactHint: string; // how to reach them, always free
}

/** Minimal HTML entity/tag cleanup for HN comment text. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// HackerNews — "SEEKING FREELANCER" posts (keyless)
// ---------------------------------------------------------------------------

interface HnResponse {
  hits?: { objectID?: string; comment_text?: string }[];
}

async function fetchHackerNews(): Promise<IntentHit[]> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search_by_date?query=%22SEEKING%20FREELANCER%22&tags=comment&hitsPerPage=30",
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) }
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as HnResponse | null;
  const out: IntentHit[] = [];
  for (const h of data?.hits ?? []) {
    if (!h.objectID || !h.comment_text) continue;
    const text = stripHtml(h.comment_text);
    // Only actual hiring posts (the thread convention), not replies about them.
    if (!/^seeking freelancer/i.test(text)) continue;
    if (!SOFTWARE_KEYWORDS.test(text)) continue;
    out.push({
      platform: "HackerNews",
      title: text.slice(0, 110),
      description: text.slice(0, 1500),
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      contactHint: "Email in post or reply directly on the thread (free)",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reddit — r/forhire "[Hiring]" posts (free app credentials, app-only OAuth)
// ---------------------------------------------------------------------------

let redditToken: { token: string; exp: number } | null = null;

async function redditAuth(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (redditToken && redditToken.exp > Date.now()) return redditToken.token;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const d = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!d?.access_token) return null;
  redditToken = { token: d.access_token, exp: Date.now() + ((d.expires_in ?? 3600) - 60) * 1000 };
  return redditToken.token;
}

interface RedditListing {
  data?: { children?: { data?: { title?: string; selftext?: string; permalink?: string } }[] };
}

async function fetchReddit(): Promise<IntentHit[]> {
  const token = await redditAuth();
  if (!token) return []; // not configured — skip silently
  const res = await fetch("https://oauth.reddit.com/r/forhire/new?limit=30", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as RedditListing | null;
  const out: IntentHit[] = [];
  for (const c of data?.data?.children ?? []) {
    const p = c.data;
    if (!p?.title || !p.permalink) continue;
    if (!/^\[hiring\]/i.test(p.title.trim())) continue; // buyers only, not job-seekers
    const full = `${p.title} ${p.selftext ?? ""}`;
    if (!SOFTWARE_KEYWORDS.test(full)) continue;
    out.push({
      platform: "Reddit",
      title: p.title.replace(/^\[hiring\]\s*/i, "").slice(0, 110),
      description: (p.selftext ?? p.title).slice(0, 1500),
      url: `https://www.reddit.com${p.permalink}`,
      contactHint: "Send a free Reddit DM or comment on the post",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

/** True when at least the optional Reddit source has credentials. */
export function isRedditConfigured(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

/**
 * Scan all direct-contact intent sources and store fresh hits as QUALIFIED
 * DiscoveredLeads. Returns per-source notes for the agent digest.
 */
export async function scanBuyerIntent(
  maxCreate = 10
): Promise<{ created: number; scanned: number; sources: string[] }> {
  const results = await Promise.allSettled([fetchHackerNews(), fetchReddit()]);
  const hits: IntentHit[] = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const sources = ["HackerNews", ...(isRedditConfigured() ? ["Reddit"] : [])];

  let created = 0;
  for (const h of hits) {
    if (created >= maxCreate) break;
    const dup = await prisma.discoveredLead.findFirst({ where: { website: h.url } });
    if (dup) continue;
    const contacts = extractContacts(h.description);
    const needScore = 85; // they are literally asking to hire right now
    const fitScore = Math.min(100, 60 + (contacts.email ? 15 : 0) + (contacts.phone ? 10 : 0));
    await prisma.discoveredLead.create({
      data: {
        name: h.title,
        website: h.url,
        email: contacts.email ?? undefined,
        phone: contacts.phone ?? undefined,
        source: "INTENT",
        signals: [
          "Actively hiring right now",
          `Posted on ${h.platform}`,
          contacts.email ? "Direct email in post" : h.contactHint,
        ],
        recommendedService: serviceFor(h.description),
        summary: `Live “hiring now” post on ${h.platform}: ${h.description.slice(0, 260)}`,
        needScore,
        fitScore,
        totalScore: Math.round(needScore * 0.6 + fitScore * 0.4),
        status: "QUALIFIED",
      },
    });
    created++;
  }
  return { created, scanned: hits.length, sources };
}
