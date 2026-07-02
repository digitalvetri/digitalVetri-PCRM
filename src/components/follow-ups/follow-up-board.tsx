"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Check,
  CalendarClock,
  Phone,
  Mail,
  MessageCircle,
  Linkedin,
  Users,
  MoreHorizontal,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime, enumLabel, cn } from "@/lib/utils";

const CHANNELS = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "LINKEDIN", "OTHER"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_ICON: Record<Channel, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  LINKEDIN: Linkedin,
  OTHER: MoreHorizontal,
};

export interface FollowUpItem {
  id: string;
  dueAt: string;
  channel: Channel;
  status: string;
  notes: string | null;
  companyName: string;
  prospectId: string;
}

export interface ProspectOption {
  id: string;
  companyName: string;
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = CHANNEL_ICON[channel] ?? MoreHorizontal;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Icon className="h-3 w-3" /> {enumLabel(channel)}
    </span>
  );
}

function FollowUpCard({ item, onChanged }: { item: FollowUpItem; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [rescheduleAt, setRescheduleAt] = React.useState("");
  const [showReschedule, setShowReschedule] = React.useState(false);

  async function patch(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/follow-ups/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success(successMsg);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {item.companyName}
          </p>
          <ChannelBadge channel={item.channel} />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> {formatDateTime(item.dueAt)}
        </p>

        {item.notes && <p className="line-clamp-3 text-sm text-muted-foreground">{item.notes}</p>}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ status: "DONE" }, "Marked done")}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Mark Done
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setShowReschedule((v) => !v)}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Reschedule
          </Button>
        </div>

        {showReschedule && (
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
              className="h-8"
            />
            <Button
              size="sm"
              disabled={busy || !rescheduleAt}
              onClick={() =>
                patch(
                  { status: "RESCHEDULED", dueAt: new Date(rescheduleAt).toISOString() },
                  "Rescheduled"
                )
              }
            >
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddFollowUpDialog({ prospects, onCreated }: { prospects: ProspectOption[]; onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [prospectId, setProspectId] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [channel, setChannel] = React.useState<Channel>("CALL");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const prospectFieldId = React.useId();
  const dueAtId = React.useId();
  const channelId = React.useId();
  const notesId = React.useId();

  async function submit() {
    if (!prospectId || !dueAt) {
      toast.error("Prospect and due date are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId,
          dueAt: new Date(dueAt).toISOString(),
          channel,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create follow-up");
      toast.success("Follow-up scheduled");
      setOpen(false);
      setProspectId("");
      setDueAt("");
      setChannel("CALL");
      setNotes("");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add Follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Follow-up</DialogTitle>
          <DialogDescription>Schedule a follow-up touchpoint for a prospect.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={prospectFieldId}>Prospect</Label>
            <Select value={prospectId} onValueChange={setProspectId}>
              <SelectTrigger id={prospectFieldId}>
                <SelectValue placeholder="Select a prospect" />
              </SelectTrigger>
              <SelectContent>
                {prospects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={dueAtId}>Due Date &amp; Time</Label>
              <Input id={dueAtId} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={channelId}>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger id={channelId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {enumLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={notesId}>Notes (optional)</Label>
            <Textarea id={notesId} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Context for this touchpoint…" />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Schedule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Column({
  title,
  accent,
  items,
  onChanged,
}: {
  title: string;
  accent: string;
  items: FollowUpItem[];
  onChanged: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
          Nothing here
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <FollowUpCard key={it.id} item={it} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FollowUpBoard({
  overdue,
  today,
  upcoming,
  completed,
  prospects,
}: {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  upcoming: FollowUpItem[];
  completed: FollowUpItem[];
  prospects: ProspectOption[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const hasAny = overdue.length + today.length + upcoming.length + completed.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AddFollowUpDialog prospects={prospects} onCreated={refresh} />
      </div>

      {!hasAny ? (
        <EmptyState
          icon={CalendarClock}
          title="No follow-ups yet"
          description="Schedule your first follow-up to keep your pipeline moving."
          action={<AddFollowUpDialog prospects={prospects} onCreated={refresh} />}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Column title="Overdue" accent="bg-red-500" items={overdue} onChanged={refresh} />
          <Column title="Today" accent="bg-primary" items={today} onChanged={refresh} />
          <Column title="Upcoming" accent="bg-cyan-500" items={upcoming} onChanged={refresh} />
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Recently Completed</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((it) => (
              <Card key={it.id} className="opacity-70">
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{it.companyName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(it.dueAt)}</p>
                  </div>
                  <ChannelBadge channel={it.channel} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
