import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-500";
  if (score >= 70) return "text-blue-500";
  if (score >= 50) return "text-amber-500";
  return "text-slate-400";
}
function scoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-slate-400";
}

/** Compact inline score bar with numeric value. */
export function ScoreBar({ score, label, className }: { score: number; label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>}
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", scoreBg(score))} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("w-8 shrink-0 text-right text-xs font-semibold tabular-nums", scoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

/** Circular score ring for hero/detail displays. */
export function ScoreRing({ score, size = 88, label }: { score: number; size?: number; label?: string }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colorMap =
    score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 50 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={colorMap}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums" style={{ color: colorMap }}>
          {score}
        </span>
        {label && <span className="text-[9px] uppercase text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
