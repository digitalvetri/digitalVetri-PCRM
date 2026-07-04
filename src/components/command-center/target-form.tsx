"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";

/**
 * Inline editor for the CEO OS monthly revenue target
 * (PATCH /api/settings { monthlyRevenueTarget }).
 */
export function TargetForm({ current }: { current: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(current?.toString() ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n) || n < 0) {
      toast.error("Enter a valid target amount in ₹");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyRevenueTarget: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save the target");
      toast.success(`Monthly target set to ${formatINR(n)}`);
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the target");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm shadow-sm">
        <Target className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Monthly target:</span>
        <span className="font-semibold">{current != null ? formatINR(current) : "Not set"}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => {
            setValue(current?.toString() ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit monthly target</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
      <Target className="h-4 w-4 shrink-0 text-primary" />
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Monthly revenue target (₹)"
        className="h-8 w-full min-w-0 sm:w-48"
        autoFocus
      />
      <Button type="button" size="sm" className="h-8" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => setEditing(false)}
        disabled={saving}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Cancel</span>
      </Button>
    </div>
  );
}
