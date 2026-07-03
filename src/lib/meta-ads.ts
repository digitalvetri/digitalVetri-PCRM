/**
 * Meta (Facebook/Instagram) Marketing API — read-only campaign insights for
 * the owner's own ad account. Needs:
 *   META_AD_ACCOUNT_ID  — e.g. "act_1234567890" (Ads Manager → account id)
 *   META_ACCESS_TOKEN   — a Business-Manager system-user token with ads_read
 * Both are free to create; no app review needed for reading your own account.
 */

export function isMetaAdsConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export interface CampaignInsight {
  campaignId: string;
  campaignName: string;
  spend: number; // account currency (INR)
  impressions: number;
  clicks: number;
  ctr: number; // %
  cpc: number;
  metaLeads: number; // leads as counted by Meta (pixel/lead-form events)
}

interface RawInsight {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type?: string; value?: string }[];
}

const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "leadgen_grouped",
]);

export async function fetchCampaignInsights(
  datePreset: string = "last_30d"
): Promise<CampaignInsight[]> {
  const token = process.env.META_ACCESS_TOKEN!;
  let account = process.env.META_AD_ACCOUNT_ID!.trim();
  if (!account.startsWith("act_")) account = `act_${account}`;

  const params = new URLSearchParams({
    level: "campaign",
    date_preset: datePreset,
    fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions",
    limit: "50",
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/${account}/insights?${params}`, {
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as
    | { data?: RawInsight[]; error?: { message?: string } }
    | null;
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error?.message ?? `Meta API error (HTTP ${res.status})`);
  }

  return (data.data ?? []).map((r) => {
    const metaLeads = (r.actions ?? [])
      .filter((a) => a.action_type && LEAD_ACTION_TYPES.has(a.action_type))
      .reduce((s, a) => s + Number(a.value ?? 0), 0);
    return {
      campaignId: r.campaign_id ?? "",
      campaignName: r.campaign_name ?? "Unnamed campaign",
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
      cpc: Number(r.cpc ?? 0),
      metaLeads,
    };
  });
}
