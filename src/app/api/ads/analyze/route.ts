import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateJSON } from "@/lib/ai/provider";

export const maxDuration = 60;

const bodySchema = z.object({
  campaigns: z
    .array(
      z.object({
        campaignName: z.string(),
        spend: z.number(),
        impressions: z.number(),
        clicks: z.number(),
        ctr: z.number(),
        cpc: z.number(),
        metaLeads: z.number(),
        crmLeads: z.number(),
        costPerCrmLead: z.number().nullable(),
      })
    )
    .min(1)
    .max(50),
  accountName: z.string().trim().max(120).optional(),
  currency: z.string().trim().max(8).optional(),
});

const analysisSchema = z.object({
  verdict: z.string().catch(""),
  actions: z.array(z.string()).catch([]),
});

/** POST /api/ads/analyze — AI read on live campaign numbers with next steps. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("commandCenter.manage");
    enforceRateLimit(`ads:analyze:${user.id}`, 4, 60_000);
    const { campaigns, accountName, currency } = bodySchema.parse(await req.json());

    const r = await generateJSON(
      `You are a performance-marketing expert advising DigitalVetri, a Coimbatore software & digital agency. They run Meta (Facebook/Instagram) ads for their own lead generation AND manage campaigns for clients.

This analysis is for the ad account: ${accountName ?? "DigitalVetri (own)"} (currency ${currency ?? "INR"}).

Last-30-day campaign data (crmLeads = enquiries that reached DigitalVetri's own CRM — only meaningful for their own campaigns; for client accounts rely on metaLeads):
${JSON.stringify(campaigns, null, 2)}

Benchmarks for Indian local-service lead-gen: CTR under 1% = weak creative; CPC above ₹30 = poor targeting/creative; a good cost per real lead is ₹150–₹500. If crmLeads is 0 while clicks are healthy, suspect the landing page, form friction, or missing UTM tagging.

Give a frank verdict (2-3 sentences) and 3-6 concrete next actions, most impactful first. Be specific to the data (name campaigns). No generic advice.`,
      `{ "verdict": string, "actions": string[] }`,
      { temperature: 0.4 },
      analysisSchema
    );

    return { verdict: r.verdict, actions: r.actions.slice(0, 6) };
  });
}
