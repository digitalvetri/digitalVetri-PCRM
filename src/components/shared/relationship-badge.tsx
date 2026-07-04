import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active client", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  AMC: { label: "AMC client", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  DORMANT: { label: "Dormant", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  CHURNED: { label: "Churned", cls: "bg-destructive/10 text-destructive" },
  PROSPECT: { label: "Prospect", cls: "bg-muted text-muted-foreground" },
};

/** Client lifecycle chip. Hidden for plain prospects unless `showProspect`. */
export function RelationshipBadge({
  status,
  showProspect = false,
  className,
}: {
  status: string;
  showProspect?: boolean;
  className?: string;
}) {
  if (status === "PROSPECT" && !showProspect) return null;
  const m = MAP[status] ?? MAP.PROSPECT;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        m.cls,
        className
      )}
    >
      {m.label}
    </span>
  );
}
