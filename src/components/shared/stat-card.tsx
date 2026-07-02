import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Server-compatible stat card (no client boundary) so pages can pass Lucide
 * icon components directly. Entrance animation is CSS (animate-fade-in)
 * staggered via animationDelay.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  accent = "primary",
  index = 0,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  trend?: { value: number; label?: string };
  accent?: "primary" | "success" | "warning" | "violet" | "cyan";
  index?: number;
}) {
  const accents: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    violet: "bg-violet-500/10 text-violet-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
  };

  return (
    <Card
      className="group relative animate-fade-in overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* subtle accent wash in the corner */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70",
          accents[accent]
        )}
        aria-hidden
      />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accents[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="relative mt-3 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              trend.value >= 0 ? "text-emerald-500" : "text-red-500"
            )}
          >
            {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend.value)}%
          </span>
          {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
        </div>
      )}
    </Card>
  );
}
