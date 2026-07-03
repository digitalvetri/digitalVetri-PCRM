"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SERVICES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Tag a company with the DigitalVetri service(s) we are pursuing them for.
 * Toggling a chip saves immediately (optimistic; reverts on failure).
 */
export function ServicePicker({
  companyId,
  initial,
  editable = true,
}: {
  companyId: string;
  initial: string[];
  editable?: boolean;
}) {
  const [selected, setSelected] = React.useState<string[]>(initial);
  const [saving, setSaving] = React.useState(false);

  async function toggle(service: string) {
    if (!editable || saving) return;
    const next = selected.includes(service)
      ? selected.filter((s) => s !== service)
      : [...selected, service];
    const prev = selected;
    setSelected(next); // optimistic
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetServices: next }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setSelected(prev); // revert
      toast.error("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editable && selected.length === 0) {
    return <p className="text-sm text-muted-foreground">No services tagged.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SERVICES.map((service) => {
        const on = selected.includes(service);
        if (!editable && !on) return null;
        return (
          <button
            key={service}
            type="button"
            onClick={() => toggle(service)}
            disabled={!editable || saving}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
              editable ? "cursor-pointer" : "cursor-default"
            )}
          >
            {on && <Check className="h-3 w-3" aria-hidden="true" />}
            {service}
          </button>
        );
      })}
    </div>
  );
}
