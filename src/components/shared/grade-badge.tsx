import { cn } from "@/lib/utils";
import { LEAD_GRADE_COLORS, LEAD_GRADE_LABELS, STATUS_COLORS } from "@/lib/constants";
import { enumLabel } from "@/lib/utils";

export function GradeBadge({ grade, className }: { grade: string | null | undefined; className?: string }) {
  if (!grade) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold",
        LEAD_GRADE_COLORS[grade] ?? "",
        className
      )}
    >
      {LEAD_GRADE_LABELS[grade] ?? grade}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {enumLabel(status)}
    </span>
  );
}
