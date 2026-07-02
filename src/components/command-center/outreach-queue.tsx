"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Mail, MessageCircle, X, Save, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export interface OutreachDraftItem {
  id: string;
  leadName: string;
  channel: "EMAIL" | "WHATSAPP";
  toContact: string | null;
  subject: string | null;
  body: string;
  createdAt: string;
}

function waNumber(raw: string): string {
  let d = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;
  return d;
}

export function OutreachQueue({ drafts }: { drafts: OutreachDraftItem[] }) {
  const router = useRouter();
  const [bodies, setBodies] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(drafts.map((d) => [d.id, d.body]))
  );
  const [busy, setBusy] = React.useState<string | null>(null);

  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/outreach/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  }

  async function markSent(id: string) {
    try {
      await patch(id, { status: "SENT" });
      router.refresh();
    } catch {
      /* the message still opened; refresh will re-show it if the update failed */
    }
  }

  async function dismiss(id: string) {
    setBusy(id);
    try {
      await patch(id, { status: "DISMISSED" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to dismiss");
      setBusy(null);
    }
  }

  async function saveEdit(id: string) {
    setBusy(id);
    try {
      await patch(id, { body: bodies[id] });
      toast.success("Saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  function send(d: OutreachDraftItem) {
    const body = bodies[d.id] ?? d.body;
    if (d.channel === "WHATSAPP") {
      const num = d.toContact ? waNumber(d.toContact) : "";
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(body)}`, "_blank", "noopener");
    } else {
      const to = d.toContact ?? "";
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
        d.subject ?? ""
      )}&body=${encodeURIComponent(body)}`;
    }
    markSent(d.id);
  }

  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="No outreach drafts"
        description="In the Lead Radar tab, use “Draft” on a lead — the ready-to-send message lands here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => (
        <Card key={d.id} className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {d.channel === "WHATSAPP" ? (
                <MessageCircle className="h-4 w-4 shrink-0 text-[#25d366]" />
              ) : (
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-semibold">{d.leadName}</span>
              <Badge variant="secondary">{d.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</Badge>
            </div>
            <span className="min-w-0 max-w-[45%] truncate text-xs text-muted-foreground">{d.toContact ?? "no contact"}</span>
          </div>

          {d.subject && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Subject:</span> {d.subject}
            </p>
          )}

          <Textarea
            value={bodies[d.id] ?? d.body}
            onChange={(e) => setBodies((b) => ({ ...b, [d.id]: e.target.value }))}
            rows={5}
            aria-label={`Message to ${d.leadName}`}
            className="mt-2"
          />

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => dismiss(d.id)} disabled={busy === d.id}>
              <X className="h-4 w-4" /> Dismiss
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => saveEdit(d.id)} disabled={busy === d.id}>
              <Save className="h-4 w-4" /> Save
            </Button>
            {d.channel === "WHATSAPP" ? (
              <Button type="button" size="sm" onClick={() => send(d)} className="bg-[#128C7E] text-white hover:bg-[#0e6f63]">
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => send(d)}>
                <ExternalLink className="h-4 w-4" /> Open email
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
