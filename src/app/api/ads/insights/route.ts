import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { isMetaAdsConfigured, fetchCampaignInsights } from "@/lib/meta-ads";

/**
 * GET /api/ads/insights[?accountId=<AdConnection id>] — live Meta campaign
 * performance for the selected connection (or the env-configured own account
 * when no accountId is given), joined with the CRM's OWN lead counts
 * (attributed via utm_campaign) so cost-per-lead reflects leads that actually
 * reached the funnel.
 */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("commandCenter.manage");
    const accountId = new URL(req.url).searchParams.get("accountId");
    const pixelConfigured = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);

    let creds: { adAccountId: string; accessToken: string; currency: string } | null = null;
    if (accountId) {
      const conn = await prisma.adConnection.findUnique({ where: { id: accountId } });
      if (!conn) throw new ApiError(404, "Ad account not found");
      creds = { adAccountId: conn.adAccountId, accessToken: conn.accessToken, currency: conn.currency ?? "INR" };
    } else if (isMetaAdsConfigured()) {
      creds = {
        adAccountId: process.env.META_AD_ACCOUNT_ID!,
        accessToken: process.env.META_ACCESS_TOKEN!,
        currency: "INR",
      };
    }

    if (!creds) return { configured: false, pixelConfigured, currency: "INR", campaigns: [] };

    const insights = await fetchCampaignInsights(creds.adAccountId, creds.accessToken, "last_30d");

    // CRM-side attribution: inbound leads from the last 30 days per campaign
    // (only meaningful for campaigns pointing at OUR /enquiry funnel).
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const crmCounts = await prisma.discoveredLead.groupBy({
      by: ["utmCampaign"],
      where: { source: "INBOUND", utmCampaign: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const byCampaign = new Map(crmCounts.map((c) => [c.utmCampaign!.toLowerCase(), c._count._all]));

    const campaigns = insights.map((i) => {
      const crmLeads = byCampaign.get(i.campaignName.toLowerCase()) ?? 0;
      const leadBasis = crmLeads > 0 ? crmLeads : i.metaLeads;
      return {
        ...i,
        crmLeads,
        costPerCrmLead: crmLeads > 0 ? Math.round(i.spend / crmLeads) : null,
        costPerLead: leadBasis > 0 ? Math.round(i.spend / leadBasis) : null,
      };
    });

    return { configured: true, pixelConfigured, currency: creds.currency, campaigns };
  });
}
