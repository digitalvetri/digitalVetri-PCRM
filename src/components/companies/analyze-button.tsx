"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

export function AnalyzeButton({
  companyId,
  companyName,
  label = "Run AI Analysis",
  variant = "default",
  size = "default",
  className,
}: {
  companyId: string;
  companyName: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function run() {
    setLoading(true);
    const toastId = toast.loading(`Running AI analysis on ${companyName}…`);
    try {
      const res = await fetch(`/api/companies/${companyId}/analyze`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      toast.success(`Analysis complete for ${companyName}.`, { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} variant={variant} size={size} className={className}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {loading ? "Analysing…" : label}
    </Button>
  );
}

export function AddToProspectsButton({
  companyId,
  companyName,
  isProspect = false,
  allowMultiple = false,
  label,
  variant = "outline",
  size = "default",
  className,
}: {
  companyId: string;
  companyName: string;
  isProspect?: boolean;
  /** Allow creating an additional deal even if the company already has one. */
  allowMultiple?: boolean;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function add() {
    setLoading(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, allowMultiple }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add prospect");
      toast.success(
        json.created ? `New deal added for ${companyName}.` : `${companyName} is already in the pipeline.`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add prospect");
    } finally {
      setLoading(false);
    }
  }

  // With allowMultiple the button is always actionable (a "New deal"); otherwise
  // it disables once the company is already a prospect.
  return (
    <Button
      onClick={add}
      disabled={loading || (isProspect && !allowMultiple)}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      {label ?? (isProspect ? "In Pipeline" : "Add to Prospects")}
    </Button>
  );
}
