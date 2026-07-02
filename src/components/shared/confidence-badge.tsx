import { Info, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/misc";

/**
 * Visually distinguishes AI ESTIMATES from VERIFIED data — a core platform
 * requirement. Use next to any employee count, revenue, or score.
 */
export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: "VERIFIED" | "ESTIMATED" | "UNKNOWN";
  className?: string;
}) {
  if (confidence === "UNKNOWN") return null;

  const config = {
    VERIFIED: {
      icon: CheckCircle2,
      label: "Verified",
      tip: "Confirmed from an authoritative public source.",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    ESTIMATED: {
      icon: Sparkles,
      label: "AI estimate",
      tip: "AI-generated estimate from public signals — not a verified figure.",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  }[confidence];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
            config.cls,
            className
          )}
        >
          <config.icon className="h-3 w-3" />
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] bg-foreground text-background">{config.tip}</TooltipContent>
    </Tooltip>
  );
}

export function EstimateNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Info className="h-3.5 w-3.5 shrink-0" />
      Employee counts, revenue, budgets and scores are AI estimates derived from public information, not verified
      figures.
    </p>
  );
}
