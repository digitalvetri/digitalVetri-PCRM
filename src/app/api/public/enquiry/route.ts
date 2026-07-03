import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { SERVICES } from "@/lib/constants";
import { notifyInstant } from "@/lib/notify";
import { draftOutreachForLead } from "@/lib/ai/outreach";

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
  // Ad attribution (hidden fields fed from the landing URL's UTM params).
  utmSource: z.string().trim().max(80).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(120).optional().or(z.literal("")),
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

    const lead = await prisma.discoveredLead.create({
      data: {
        name: body.businessName?.trim() || body.name,
        phone: body.phone,
        email: body.email || undefined,
        city: body.city || undefined,
        source: "INBOUND",
        recommendedService: body.service,
        summary: `Inbound enquiry from ${body.name}. ${contactBits}`,
        signals: [
          "Inbound enquiry",
          "Actively looking to buy",
          ...(body.utmCampaign ? [`Via ad campaign: ${body.utmCampaign}`] : []),
        ],
        utmSource: body.utmSource || undefined,
        utmCampaign: body.utmCampaign || undefined,
        // Inbound = high intent: qualify it and score it high so it surfaces first.
        needScore: 90,
        fitScore: 80,
        totalScore: 86,
        status: "QUALIFIED",
      },
    });

    // Speed-to-lead: ping the owner instantly (never fails the form).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dv-crm.online";
    await notifyInstant(
      `🔥 New enquiry: ${lead.name}`,
      [
        `${body.name} wants ${body.service}.`,
        `Phone: ${body.phone}${body.email ? ` · Email: ${body.email}` : ""}${body.city ? ` · ${body.city}` : ""}`,
        body.message ? `“${body.message.slice(0, 300)}”` : null,
        `Respond now: ${appUrl}/command-center`,
      ]
        .filter(Boolean)
        .join("\n")
    );

    // Day-0 nurture: draft the first reply into the Outreach queue in the
    // background so it's waiting, ready to send, when the owner opens the app.
    void (async () => {
      try {
        const channel = body.email ? "EMAIL" : "WHATSAPP";
        const d = await draftOutreachForLead(
          {
            name: lead.name,
            city: lead.city,
            signals: ["Inbound enquiry — they contacted us", `Wants: ${body.service}`],
            recommendedService: body.service,
            phone: lead.phone,
            email: lead.email,
          },
          channel
        );
        await prisma.outreachDraft.create({
          data: {
            discoveredLeadId: lead.id,
            leadName: lead.name,
            channel,
            toContact: d.toContact,
            subject: d.subject,
            body: d.body,
          },
        });
      } catch (err) {
        console.error("[enquiry] day-0 draft failed", err);
      }
    })();

    return { ok: true };
  });
}
