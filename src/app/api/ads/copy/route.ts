import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateJSON } from "@/lib/ai/provider";
import { SERVICES } from "@/lib/constants";

export const maxDuration = 60;

const bodySchema = z.object({
  service: z.string().refine((s) => (SERVICES as readonly string[]).includes(s), "Pick a service"),
  angle: z.string().trim().max(300).optional().or(z.literal("")),
});

const copySchema = z.object({
  variants: z
    .array(
      z.object({
        primaryText: z.string().catch(""),
        headline: z.string().catch(""),
        description: z.string().catch(""),
      })
    )
    .catch([]),
  targeting: z.string().catch(""),
});

/** POST /api/ads/copy — generate Meta ad creative variants for a service. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`ads:copy:${user.id}`, 6, 60_000);
    const { service, angle } = bodySchema.parse(await req.json());

    const r = await generateJSON(
      `Write Meta (Facebook/Instagram) ad creatives for DigitalVetri, a Coimbatore agency, selling "${service}" to small & mid-size Indian business owners (manufacturers, traders, clinics, shops, service businesses).
${angle ? `Angle/offer to emphasise: ${angle}` : ""}

Rules:
- Speak to the OWNER's business pain, not tech jargon ("customers can't find you online", "enquiries going to competitors", "hours lost in Excel").
- Indian tone, simple English; a light Tamil word is fine if natural.
- Each variant must differ in angle: e.g. pain-led, proof/outcome-led, offer-led.
- primaryText: 80-125 words max, short punchy lines, may use 1-2 emojis, end with a clear CTA to get a free consultation.
- headline: max 40 characters. description: max 30 characters.
- The ad clicks through to a form where they leave their number for a same-day callback.

Return 3 variants plus one "targeting" paragraph: recommended audience for this service in Meta Ads Manager (location radius, age, interests/behaviours, placement advice) for a ₹300-500/day budget.`,
      `{ "variants": [{ "primaryText": string, "headline": string, "description": string }], "targeting": string }`,
      { temperature: 0.7 },
      copySchema
    );

    return { variants: r.variants.slice(0, 3), targeting: r.targeting };
  });
}
