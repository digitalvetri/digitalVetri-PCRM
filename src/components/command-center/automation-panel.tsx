"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Bot, Play, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/misc";
import { relativeTime } from "@/lib/utils";

export interface AutomationConfig {
  enabled: boolean;
  watchlists: { industry: string; city: string }[];
  digestChannel: "none" | "whatsapp" | "email";
  digestTo: string;
  batchSize: number;
  autoDraft: boolean;
}

export interface AgentRunItem {
  id: string;
  createdAt: string;
  leadsFound: number;
  sent: boolean;
  summary: string | null;
}

export function AutomationPanel({
  config,
  recentRuns,
  placesConfigured,
}: {
  config: AutomationConfig;
  recentRuns: AgentRunItem[];
  placesConfigured: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(config.enabled);
  const [watchlists, setWatchlists] = React.useState(
    config.watchlists.length ? config.watchlists : [{ industry: "", city: "" }]
  );
  const [digestChannel, setDigestChannel] = React.useState<AutomationConfig["digestChannel"]>(config.digestChannel);
  const [digestTo, setDigestTo] = React.useState(config.digestTo);
  const [batchSize, setBatchSize] = React.useState(String(config.batchSize));
  const [autoDraft, setAutoDraft] = React.useState(config.autoDraft);
  const [saving, setSaving] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const channelId = React.useId();
  const toId = React.useId();
  const batchId = React.useId();

  const setWl = (i: number, key: "industry" | "city", val: string) =>
    setWatchlists((w) => w.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const addWl = () => setWatchlists((w) => [...w, { industry: "", city: "" }]);
  const removeWl = (i: number) => setWatchlists((w) => w.filter((_, j) => j !== i));

  async function save() {
    setSaving(true);
    try {
      const wl = watchlists.filter((w) => w.industry.trim() && w.city.trim());
      const res = await fetch("/api/command-center/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          watchlists: wl,
          digestChannel,
          digestTo: digestTo.trim(),
          batchSize: Number(batchSize) || 5,
          autoDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Automation saved.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/command-center/run-agent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      toast.success(`Agent ran — ${data.leadsFound} new lead(s)${data.sent ? ", briefing sent" : ""}.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" /> Autonomous Agent
          </CardTitle>
          <CardDescription>
            Set watchlists and the agent discovers matching businesses and briefs you every morning.
            Deploy with a scheduler to run it 24/7 — or press “Run agent now” to test it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Daily auto-discovery</p>
              <p className="text-xs text-muted-foreground">Runs once a day when deployed with a scheduler.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Watchlists — the “industry in city” to scan</p>
            {watchlists.map((w, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label="Industry" placeholder="Industry (e.g. Textiles)" value={w.industry} onChange={(e) => setWl(i, "industry", e.target.value)} />
                <Input aria-label="City" placeholder="City (e.g. Coimbatore)" value={w.city} onChange={(e) => setWl(i, "city", e.target.value)} />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeWl(i)} aria-label="Remove watchlist">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addWl}>
              <Plus className="h-4 w-4" /> Add watchlist
            </Button>
            {!placesConfigured && (
              <p className="text-xs text-muted-foreground">
                Auto-discovery needs <code className="rounded bg-muted px-1">GOOGLE_PLACES_API_KEY</code>. Without it,
                the agent still sends your morning briefing.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={channelId}>Briefing via</Label>
              <Select value={digestChannel} onValueChange={(v) => setDigestChannel(v as AutomationConfig["digestChannel"])}>
                <SelectTrigger id={channelId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">In-app only</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={toId}>Send to</Label>
              <Input
                id={toId}
                placeholder={digestChannel === "whatsapp" ? "WhatsApp number (e.g. 9600759304)" : "you@digitalvetri.com"}
                value={digestTo}
                onChange={(e) => setDigestTo(e.target.value)}
                disabled={digestChannel === "none"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={batchId}>Leads per run</Label>
            <Input id={batchId} type="number" min={1} max={12} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} className="w-24" />
            <p className="text-[11px] text-muted-foreground">Keep small (≤ 5–8) to stay within serverless time limits.</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Auto-draft outreach</p>
              <p className="text-xs text-muted-foreground">
                Draft a WhatsApp message for the top new leads each run (in the Outreach tab, ready to send).
              </p>
            </div>
            <Switch checked={autoDraft} onCheckedChange={setAutoDraft} />
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
            <Button type="button" variant="outline" onClick={runNow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run agent now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent agent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No runs yet — press “Run agent now” to generate your first briefing.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentRuns.map((r) => (
                <li key={r.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{relativeTime(r.createdAt)}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.leadsFound} new lead{r.leadsFound === 1 ? "" : "s"}
                      {r.sent ? " · briefing sent" : ""}
                    </span>
                  </div>
                  {r.summary && (
                    <pre className="mt-1.5 line-clamp-6 whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                      {r.summary}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
