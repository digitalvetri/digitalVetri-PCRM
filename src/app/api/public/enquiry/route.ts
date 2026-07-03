import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { SERVICES } from "@/lib/constants";

/**
 * PUBLIC (no auth) inbound-enquiry intake. A prospect who actually wants to buy
 * fills the /enquiry form; we store it as a high-intent DiscoveredLead so it
 * lands in the Command Center's Lead Radar with their own contact details.
 * Clerk-exempt via the middleware matcher; gated only by rate-limit + honeypot.
 */
const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  businessName: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().min(7, "Please enter a phone number").max(20),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  service: z.string().refine((s) => (SERVICES as readonly string[]).includes(s), "Pick a service"),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot: real users leave this empty; bots fill it.
  company_website: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  return withApi(async () => {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    enforceRateLimit(`enquiry:${ip}`, 5, 60_000);

    const body = schema.parse(await req.json());

    // Honeypot tripped → pretend success, create nothing.
    if (body.company_website) return { ok: true };

    const contactBits = [
      body.businessName && `Business: ${body.businessName}`,
      `Wants: ${body.service}`,
      body.message && `— ${body.message}`,
    ]
      .filter(Boolean)
      .join(" · ");

    await prisma.discoveredLead.create({
      data: {
        name: body.businessName?.trim() || body.name,
        phone: body.phone,
        email: body.email || undefined,
        city: body.city || undefined,
        source: "INBOUND",
        recommendedService: body.service,
        summary: `Inbound enquiry from ${body.name}. ${contactBits}`,
        signals: ["Inbound enquiry", "Actively looking to buy"],
        // Inbound = high intent: qualify it and score it high so it surfaces first.
        needScore: 90,
        fitScore: 80,
        totalScore: 86,
        status: "QUALIFIED",
      },
    });

    return { ok: true };
  });
}
