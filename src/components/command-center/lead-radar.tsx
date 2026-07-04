"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Radar, Sparkles, Search, X, ArrowUpRight, Globe, Mail, MessageCircle, Phone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export interface DiscoveredLeadItem {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  industry: string | null;
  signals: string[];
  recommendedService: string | null;
  summary: string | null;
  needScore: number;
  fitScore: number;
  totalScore: number;
  status: string;
  source: string;
  utmCampaign: string | null;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function LeadRadar({
  leads,
  placesConfigured,
}: {
  leads: DiscoveredLeadItem[];
  placesConfigured: boolean;
}) {
  const router = useRouter();
  const [pasted, setPasted] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [discovering, setDiscovering] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function discover(usePlaces: boolean) {
    setDiscovering(true);
    try {
      let body: Record<string, unknown>;
      if (usePlaces) {
        body = { industry, city };
      } else {
        const list = pasted
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [name, website] = l.split(",").map((s) => s.trim());
            return { name, website: website || null };
          });
        if (list.length === 0) {
          toast.error("Paste at least one business (one per line).");
          setDiscovering(false);
          return;
        }
        body = { leads: list, industry: industry || undefined, city: city || undefined };
      }
      const res = await fetch("/api/leads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      toast.success(`Qualified ${data.created} lead${data.created === 1 ? "" : "s"}.`);
      setPasted("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  async function scanIntent() {
    setDiscovering(true);
    try {
      const res = await fetch("/api/leads/intent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Intent scan failed");
      toast.success(
        data.created > 0
          ? `Found ${data.created} live project${data.created === 1 ? "" : "s"} asking to buy right now.`
          : "No new buyer-intent posts since the last scan — try again later."
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Intent scan failed");
    } finally {
      setDiscovering(false);
    }
  }

  async function promote(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}/promote`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to promote");
      toast.success("Promoted to Companies & Prospects.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to promote");
      setBusyId(null);
    }
  }

  async function dismiss(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to dismiss");
      setBusyId(null);
    }
  }

  async function draft(id: string, channel: "EMAIL" | "WHATSAPP") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to draft");
      toast.success(`${channel === "WHATSAPP" ? "WhatsApp" : "Email"} drafted — see the Outreach tab.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to draft");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Discover / qualify */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" /> Lead Radar
          </CardTitle>
          <CardDescription>
            Two ways in: scan live marketplace posts from buyers who are hiring for software work
            right now, or qualify local businesses — the AI reads their public presence, detects the
            gap and scores them. Promote the best into your pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Industry (e.g. Textiles)" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry" />
            <Input placeholder="City (e.g. Coimbatore)" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" />
          </div>
          <Textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            aria-label="Businesses to qualify"
            placeholder={"Paste businesses, one per line — “Name” or “Name, website”:\nSri Ganesh Textiles, sriganesh.com\nMRS Traders"}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={scanIntent} disabled={discovering}>
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Scan buyers hiring now
            </Button>
            <Button type="button" variant="outline" onClick={() => discover(false)} disabled={discovering}>
              <Sparkles className="h-4 w-4" />
              Qualify pasted list
            </Button>
            {placesConfigured && (
              <Button
                type="button"
                variant="outline"
                onClick={() => discover(true)}
                disabled={discovering || !industry.trim() || !city.trim()}
              >
                <Search className="h-4 w-4" /> Search Google Places
              </Button>
            )}
          </div>
          {!placesConfigured && (
            <p className="text-xs text-muted-foreground">
              Tip: add <code className="rounded bg-muted px-1">GOOGLE_PLACES_API_KEY</code> to auto-discover
              businesses by industry + city. For now, paste names/websites above — the AI qualifies them for free.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Board */}
      {leads.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No leads on the radar yet"
          description="Qualify a list of businesses above — the best ones will show here, ready to promote."
        />
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{l.name}</p>
                    {l.source === "INBOUND" && (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">🔥 Inbound enquiry</Badge>
                    )}
                    {l.source === "INTENT" && (
                      <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400">💼 Hiring now</Badge>
                    )}
                    {l.utmCampaign && (
                      <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400">📣 Ad: {l.utmCampaign}</Badge>
                    )}
                    {l.status === "QUALIFIED" && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Qualified</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {[l.industry, l.city].filter(Boolean).join(" · ") || "—"}
                    {l.website && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Globe className="h-3 w-3 shrink-0" /> <span className="break-all">{l.website}</span>
                      </span>
                    )}
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className="inline-flex min-w-0 items-center gap-1 hover:text-primary">
                        <Phone className="h-3 w-3 shrink-0" /> <span className="break-all">{l.phone}</span>
                      </a>
                    )}
                    {l.email && (
                      <a href={`mailto:${l.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-primary">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="break-all">{l.email}</span>
                      </a>
                    )}
                  </p>
                  {l.summary && <p className="mt-1.5 text-sm">{l.summary}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.recommendedService && <Badge variant="secondary">{l.recommendedService}</Badge>}
                    {l.signals.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-center">
                  <div className={cn("text-2xl font-bold tabular-nums", scoreColor(l.totalScore))}>{l.totalScore}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">score</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Button type="button" size="sm" variant="ghost" onClick={() => dismiss(l.id)} disabled={busyId === l.id}>
                  <X className="h-4 w-4" /> Dismiss
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => draft(l.id, "WHATSAPP")} disabled={busyId === l.id}>
                  <MessageCircle className="h-4 w-4" /> Draft WA
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => draft(l.id, "EMAIL")} disabled={busyId === l.id}>
                  <Mail className="h-4 w-4" /> Draft email
                </Button>
                <Button type="button" size="sm" onClick={() => promote(l.id)} disabled={busyId === l.id}>
                  {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  Promote
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
