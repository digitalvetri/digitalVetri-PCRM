import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { isMetaAdsConfigured, fetchCampaignInsights } from "@/lib/meta-ads";

/**
 * GET /api/ads/insights — live Meta campaign performance joined with the CRM's
 * OWN lead counts (attributed via utm_campaign), so cost-per-lead reflects
 * leads that actually reached your funnel, not just Meta's claimed events.
 */
export async function GET() {
  return withApi(async () => {
    await requireUser("commandCenter.manage");
    const pixelConfigured = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
    if (!isMetaAdsConfigured()) {
      return { configured: false, pixelConfigured, campaigns: [] };
    }

    const insights = await fetchCampaignInsights("last_30d");

    // CRM-side attribution: inbound leads from the last 30 days per campaign.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const crmCounts = await prisma.discoveredLead.groupBy({
      by: ["utmCampaign"],
      where: { source: "INBOUND", utmCampaign: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const byCampaign = new Map(
      crmCounts.map((c) => [c.utmCampaign!.toLowerCase(), c._count._all])
    );

    const campaigns = insights.map((i) => {
      const crmLeads = byCampaign.get(i.campaignName.toLowerCase()) ?? 0;
      return {
        ...i,
        crmLeads,
        costPerCrmLead: crmLeads > 0 ? Math.round(i.spend / crmLeads) : null,
      };
    });

    return { configured: true, pixelConfigured, campaigns };
  });
}
