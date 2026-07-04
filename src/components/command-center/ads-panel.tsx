"use client";

import * as React from "react";
import {
  Loader2,
  Megaphone,
  Sparkles,
  Copy,
  RefreshCw,
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { SERVICES } from "@/lib/constants";
import { useRole } from "@/components/layout/app-shell";
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
  costPerLead: number | null;
}

interface InsightsResponse {
  configured: boolean;
  pixelConfigured: boolean;
  currency: string;
  campaigns: CampaignRow[];
  error?: string;
}

interface AdAccount {
  id: string;
  name: string;
  adAccountId: string;
  currency: string | null;
  tokenHint: string;
}

interface AdVariant {
  primaryText: string;
  headline: string;
  description: string;
}

const OWN = "__own__";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function AdsPanel() {
  const role = useRole();
  const canManageAccounts = role === "ADMIN";

  const [accounts, setAccounts] = React.useState<AdAccount[]>([]);
  const [source, setSource] = React.useState<string>(OWN);
  const [data, setData] = React.useState<InsightsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [analysis, setAnalysis] = React.useState<{ verdict: string; actions: string[] } | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);

  // Connect-account form
  const [newName, setNewName] = React.useState("");
  const [newAccountId, setNewAccountId] = React.useState("");
  const [newToken, setNewToken] = React.useState("");
  const [connecting, setConnecting] = React.useState(false);

  // Ad copy generator
  const [service, setService] = React.useState<string>(SERVICES[2]);
  const [angle, setAngle] = React.useState("");
  const [variants, setVariants] = React.useState<AdVariant[]>([]);
  const [targeting, setTargeting] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const loadAccounts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/ads/accounts");
      const json = await res.json();
      if (res.ok) setAccounts(json.accounts ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadInsights = React.useCallback(async (src: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const qs = src === OWN ? "" : `?accountId=${encodeURIComponent(src)}`;
      const res = await fetch(`/api/ads/insights${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load ad insights");
      setData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ad insights");
      setData({ configured: false, pixelConfigured: false, currency: "INR", campaigns: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  React.useEffect(() => {
    void loadInsights(source);
  }, [source, loadInsights]);

  const currency = data?.currency ?? "INR";
  const money = (v: number) => (currency === "INR" ? formatINR(v, true) : `${currency} ${Math.round(v).toLocaleString()}`);

  async function connectAccount() {
    if (!newName.trim() || !newAccountId.trim() || !newToken.trim()) {
      toast.error("Fill the client name, ad account ID and access token.");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, adAccountId: newAccountId, accessToken: newToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not connect the account");
      toast.success(`${json.account.name} connected.`);
      setNewName("");
      setNewAccountId("");
      setNewToken("");
      await loadAccounts();
      setSource(json.account.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect the account");
    } finally {
      setConnecting(false);
    }
  }

  async function removeAccount(a: AdAccount) {
    if (!window.confirm(`Disconnect “${a.name}” (${a.adAccountId})?`)) return;
    try {
      const res = await fetch(`/api/ads/accounts/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success(`${a.name} disconnected.`);
      if (source === a.id) setSource(OWN);
      await loadAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect");
    }
  }

  async function analyze() {
    if (!data || data.campaigns.length === 0) return;
    setAnalyzing(true);
    try {
      const accountName = source === OWN ? "DigitalVetri (own account)" : accounts.find((a) => a.id === source)?.name;
      const res = await fetch("/api/ads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns: data.campaigns, accountName, currency }),
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
  const hasAnySource = Boolean(data?.configured) || accounts.length > 0;

  return (
    <div className="space-y-4">
      {/* Overview / setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Meta Ads
          </CardTitle>
          <CardDescription>
            Run Facebook/Instagram campaigns for your own funnel or manage your clients&apos; ad
            accounts — connect each account below and analyse its reports right here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={data?.pixelConfigured ? "default" : "outline"} className="gap-1">
              {data?.pixelConfigured ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              Pixel {data?.pixelConfigured ? "installed" : "not set"}
            </Badge>
            <Badge variant={hasAnySource ? "default" : "outline"} className="gap-1">
              {hasAnySource ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {accounts.length > 0
                ? `${accounts.length} ad account${accounts.length === 1 ? "" : "s"} connected`
                : data?.configured
                  ? "Own account connected"
                  : "No ad account connected"}
            </Badge>
          </div>

          {/* Ad destination URL builder — works with zero setup */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-semibold">Your ad&apos;s destination URL (for DigitalVetri campaigns)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use as the website URL in Ads Manager. It pre-selects the service and tags every lead
              with the campaign. Name the Meta campaign{" "}
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
              <p className="font-semibold">Install the Meta Pixel (before spending on your own ads)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Events Manager → Connect data → Web → create a Pixel → set its ID as{" "}
                <code className="rounded bg-muted px-1">NEXT_PUBLIC_META_PIXEL_ID</code>. The site
                then reports every enquiry to Meta as a Lead, so delivery optimizes toward real leads.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ad accounts</CardTitle>
          <CardDescription>
            Connect your own account and every client account you manage. Per account you need its
            ad account ID (Ads Manager → account dropdown) and a Business-Manager system-user token
            with <code className="rounded bg-muted px-1">ads_read</code> access to that account.
            Tokens are stored server-side and never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length > 0 && (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.adAccountId} · token {a.tokenHint}
                      {a.currency ? ` · ${a.currency}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setSource(a.id)}>
                      View report
                    </Button>
                    {canManageAccounts && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Disconnect ${a.name}`}
                        onClick={() => removeAccount(a)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canManageAccounts ? (
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm font-semibold">Connect an account</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Client / account name (e.g. Sri Textiles)"
                  aria-label="Account name"
                />
                <Input
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                  placeholder="Ad account ID (e.g. act_1234567890)"
                  aria-label="Ad account ID"
                />
                <Input
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  type="password"
                  placeholder="Access token (ads_read)"
                  aria-label="Access token"
                  className="sm:col-span-2"
                />
              </div>
              <Button type="button" size="sm" className="mt-3" onClick={connectAccount} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Validate &amp; connect
              </Button>
            </div>
          ) : (
            accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">An admin can connect ad accounts here.</p>
            )
          )}
        </CardContent>
      </Card>

      {/* Live performance */}
      {hasAnySource && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="flex min-w-0 items-center gap-2">
                Last 30 days
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="h-8 w-full min-w-0 sm:w-56" aria-label="Ad account to report on">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OWN}>DigitalVetri (own)</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void loadInsights(source)} disabled={loading}>
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                <Button type="button" size="sm" onClick={analyze} disabled={analyzing || !data || data.campaigns.length === 0}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  AI analysis
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading campaign data…
              </p>
            ) : !data?.configured ? (
              <p className="text-sm text-muted-foreground">
                This source isn&apos;t connected — pick a connected account above.
              </p>
            ) : data.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaign data in the last 30 days for this account.
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
                      <th className="py-2">Cost / lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.campaignId} className="border-b last:border-0">
                        <td className="max-w-[220px] truncate py-2 pr-3 font-medium">{c.campaignName}</td>
                        <td className="py-2 pr-3 tabular-nums">{money(c.spend)}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.clicks}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.ctr.toFixed(2)}%</td>
                        <td className="py-2 pr-3 tabular-nums">{money(c.cpc)}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.metaLeads}</td>
                        <td className="py-2 pr-3 tabular-nums">{c.crmLeads > 0 ? <b>{c.crmLeads}</b> : "—"}</td>
                        <td className="py-2 font-semibold tabular-nums">
                          {c.costPerLead != null ? money(c.costPerLead) : "—"}
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
            targeting recommendation for a ₹300–500/day budget. Works for client campaigns too.
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
