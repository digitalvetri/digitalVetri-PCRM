/**
 * Ethical public-data fetching for company research.
 *
 * Constraints enforced here:
 *  - robots.txt is checked before fetching any page
 *  - only public, unauthenticated pages are fetched
 *  - a clearly identified user agent is sent
 *  - responses are size-limited and stripped to text for AI analysis
 */

import dns from "node:dns";
import net from "node:net";

const USER_AGENT = "DigitalVetri-SalesIntelligence/1.0 (+https://digitalvetri.com; business research; info@digitalvetri.com)";
const MAX_BYTES = 500_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;

const robotsCache = new Map<string, { rules: string[]; fetchedAt: number }>();

// ---------------------------------------------------------------
// SSRF protection: refuse to fetch private/internal network targets.
// ---------------------------------------------------------------

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const addr = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded IPv4 to avoid a bypass.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (/^f[cd]/.test(addr)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
  return false;
}

/**
 * Reject non-http(s) URLs and any host that resolves to a private/internal
 * address. Resolving first (rather than trusting the hostname string) defeats
 * decimal/hex/IPv4-mapped encodings. Residual DNS-rebinding TOCTOU is accepted
 * for this internal-tool threat model.
 */
async function assertPublicUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new FetchBlockedError("Only http(s) URLs are supported");
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 literal brackets

  const literalFamily = net.isIP(host);
  if (literalFamily === 4) {
    if (ipv4IsPrivate(host)) throw new FetchBlockedError("Refusing to fetch a private/internal address");
    return;
  }
  if (literalFamily === 6) {
    if (ipv6IsPrivate(host)) throw new FetchBlockedError("Refusing to fetch a private/internal address");
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    throw new FetchBlockedError(`Cannot resolve host: ${host}`);
  }
  if (addresses.length === 0) throw new FetchBlockedError(`Cannot resolve host: ${host}`);
  for (const a of addresses) {
    const isPrivate = a.family === 4 ? ipv4IsPrivate(a.address) : ipv6IsPrivate(a.address);
    if (isPrivate) throw new FetchBlockedError("Refusing to fetch a host that resolves to a private/internal address");
  }
}

async function isAllowedByRobots(url: URL): Promise<boolean> {
  const origin = url.origin;
  let entry = robotsCache.get(origin);
  if (!entry || Date.now() - entry.fetchedAt > 60 * 60 * 1000) {
    try {
      // `redirect: "error"` so a robots.txt redirect can't be used to reach an
      // internal host; on throw we fall through to "no rules" (allowed).
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      const text = res.ok ? await res.text() : "";
      entry = { rules: parseDisallowRules(text), fetchedAt: Date.now() };
    } catch {
      entry = { rules: [], fetchedAt: Date.now() };
    }
    robotsCache.set(origin, entry);
  }
  return !entry.rules.some((rule) => rule !== "" && url.pathname.startsWith(rule));
}

/** Extract Disallow rules that apply to * user agents. */
function parseDisallowRules(robotsTxt: string): string[] {
  const rules: string[] = [];
  let appliesToUs = false;
  for (const rawLine of robotsTxt.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) {
      appliesToUs = value === "*";
    } else if (appliesToUs && /^disallow$/i.test(key) && value) {
      rules.push(value);
    }
  }
  return rules;
}

export class FetchBlockedError extends Error {}

/**
 * Fetch a public web page as plain text (HTML stripped), respecting
 * robots.txt. Throws FetchBlockedError when disallowed.
 */
export async function fetchPublicPageText(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);

  // Follow redirects manually so every hop is re-validated against the SSRF
  // guard. `redirect: "manual"` prevents fetch from silently following a
  // public URL into an internal one.
  let res: Response;
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    if (!(await isAllowedByRobots(url))) {
      throw new FetchBlockedError(`robots.txt disallows fetching ${url.pathname} on ${url.hostname}`);
    }

    res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
    });

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");
    // Opaque redirect (no readable target) — refuse rather than follow blind.
    if (res.type === "opaqueredirect" || (isRedirect && !location)) {
      throw new FetchBlockedError("Refusing to follow an opaque redirect");
    }
    if (isRedirect) {
      if (hop >= MAX_REDIRECTS) throw new FetchBlockedError("Too many redirects");
      url = new URL(location as string, url); // resolve relative Location, then re-validate on next loop
      continue;
    }
    break;
  }

  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url.hostname}`);

  const html = (await res.text()).slice(0, MAX_BYTES);
  return htmlToText(html);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 60_000);
}
