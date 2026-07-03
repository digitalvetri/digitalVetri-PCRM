"use client";

import * as React from "react";
import { Loader2, Megaphone, Sparkles, Copy, RefreshCw, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { SERVICES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";

interface CampaignRow {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  metaLeads: number;
  crmLeads: number;
  costPerCrmLead: number | null;
}

interface InsightsResponse {
  configured: boolean;
  pixelConfigured: boolean;
  campaigns: CampaignRow[];
  error?: string;
}

interface AdVariant {
  primaryText: string;
  headline: string;
  description: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function AdsPanel() {
  const [data, setData] = React.useState<InsightsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [analysis, setAnalysis] = React.useState<{ verdict: string; actions: string[] } | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);

  const [service, setService] = React.useState<string>(SERVICES[2]); // Website Development
  const [angle, setAngle] = React.useState("");
  const [variants, setVariants] = React.useState<AdVariant[]>([]);
  const [targeting, setTargeting] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ads/insights");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load ad insights");
      setData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ad insights");
      setData({ configured: false, pixelConfigured: false, campaigns: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function analyze() {
    if (!data || data.campaigns.length === 0) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns: data.campaigns }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setAnalysis(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateCopy() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ads/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, angle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setVariants(json.variants);
      setTargeting(json.targeting);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function copyText(text: string, what: string) {
    void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied.`));
  }

  const adUrl = `https://dv-crm.online/enquiry?service=${encodeURIComponent(service)}&utm_source=meta&utm_campaign=${slugify(service)}`;

  return (
    <div className="space-y-4">
      {/* Status / setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Meta Ads
          </CardTitle>
          <CardDescription>
            Run Facebook/Instagram ads into your own funnel — every lead lands in Lead Radar tagged
            with its campaign, so you see the true cost per lead, not Meta&apos;s version of it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={data?.pixelConfigured ? "default" : "outline"} className="gap-1">
              {data?.pixelConfigured ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              Pixel {data?.pixelConfigured ? "installed" : "not set"}
            </Badge>
            <Badge variant={data?.configured ? "default" : "outline"} className="gap-1">
              {data?.configured ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              Insights {data?.configured ? "connected" : "not connected"}
            </Badge>
          </div>

          {/* Ad destination URL builder — works with zero setup */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-semibold">1 · Your ad&apos;s destination URL</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this as the website URL in Ads Manager. It pre-selects the service and tags every
              lead with the campaign. Name your Meta campaign{" "}
              <code className="rounded bg-muted px-1">{slugify(service)}</code> so reporting matches
              automatically.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="sm:w-72" aria-label="Service to advertise">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => copyText(adUrl, "Ad URL")}>
                <Copy className="h-4 w-4" /> Copy ad URL
              </Button>
            </div>
            <p className="mt-2 break-all rounded bg-muted px-2 py-1.5 text-xs">{adUrl}</p>
          </div>

          {!data?.pixelConfigured && (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-semibold">2 · Install the Meta Pixel (recommended before spending)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Events Manager → Connect data → Web → create a Pixel → copy its ID → send the ID to
                your developer to set <code className="rounded bg-muted px-1">NEXT_PUBLIC_META_PIXEL_ID</code>.
                The site then reports every enquiry back to Meta as a Lead, so Meta learns to find
                you cheaper leads over time.
              </p>
            </div>
          )}

          {!data?.configured && (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-semibold">3 · Connect live campaign analysis (optional)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Business Settings → Users → System users → create one → generate token with{" "}
                <code className="rounded bg-muted px-1">ads_read</code> → assign your ad account.
                Send the token + ad account id to set{" "}
                <code className="rounded bg-muted px-1">META_ACCESS_TOKEN</code> and{" "}
                <code className="rounded bg-muted px-1">META_AD_ACCOUNT_ID</code>. Spend, clicks and
                cost-per-lead then appear here automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live performance */}
      {data?.configured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Last 30 days</span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                <Button type="button" size="sm" onClick={analyze} disabled={analyzing || data.campaigns.length === 0}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  AI analysis
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaign data yet — once your first campaign runs, spend and cost-per-lead show here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Campaign</th>
                      <th className="py-2 pr-3">Spend</th>
                      <th className="py-2 pr-3">Clicks</th>
                      <th className="py-2 pr-3">CTR</th>
                      <th className="py-2 pr-3">CPC</th>
                      <th className="py-2 pr-3">Meta leads</th>
                      <th className="py-2 pr-3">CRM leads</th>
                      <th className="py-2">₹ / CRM lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.campaignId} className="border-b last:border-0">
                        <td className="max-w-[220px] truncate py-2 pr-3 font-medium">{c.campaignName}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatINR(c.spend, true)}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.clicks}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.ctr.toFixed(2)}%</td>
                        <td className="py-2 pr-3 tabular-nums">{formatINR(c.cpc, true)}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.metaLeads}</td>
                        <td className="py-2 pr-3 font-semibold tabular-nums">{c.crmLeads}</td>
                        <td className="py-2 font-semibold tabular-nums">
                          {c.costPerCrmLead != null ? formatINR(c.costPerCrmLead, true) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analysis && (
              <div className="mt-4 rounded-lg border bg-muted/40 p-4">
                <p className="text-sm font-semibold">AI verdict</p>
                <p className="mt-1 text-sm">{analysis.verdict}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {analysis.actions.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold text-primary">{i + 1}.</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ad copy generator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ad copy generator</CardTitle>
          <CardDescription>
            Three ready-to-paste creatives per service, written for Indian SME owners — plus a
            targeting recommendation for a ₹300–500/day budget.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="Optional angle/offer — e.g. “free consultation this month”"
              aria-label="Ad angle or offer"
            />
            <Button type="button" onClick={generateCopy} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate for {service.split(" (")[0]}
            </Button>
          </div>

          {variants.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-3">
              {variants.map((v, i) => (
                <div key={i} className="flex flex-col rounded-lg border p-4">
                  <p className="whitespace-pre-wrap text-sm">{v.primaryText}</p>
                  <p className="mt-3 text-sm font-semibold">{v.headline}</p>
                  <p className="text-xs text-muted-foreground">{v.description}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 self-start"
                    onClick={() =>
                      copyText(`${v.primaryText}\n\nHeadline: ${v.headline}\nDescription: ${v.description}`, "Ad variant")
                    }
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
              ))}
            </div>
          )}

          {targeting && (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-semibold">Recommended targeting</p>
              <p className="mt-1">{targeting}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
