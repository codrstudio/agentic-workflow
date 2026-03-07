import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FindingsSummary } from "@/hooks/use-reviews";

interface FindingsSummaryBadgeProps {
  summary: FindingsSummary;
  onClick?: () => void;
  className?: string;
}

export function FindingsSummaryBadge({
  summary,
  onClick,
  className,
}: FindingsSummaryBadgeProps) {
  if (summary.total === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        "hover:bg-muted/50 cursor-pointer",
        summary.critical > 0
          ? "border-red-500/30 bg-red-500/5"
          : summary.warning > 0
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-blue-500/30 bg-blue-500/5",
        className
      )}
    >
      {summary.critical > 0 && (
        <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <ShieldAlert className="h-3 w-3" />
          {summary.critical}
        </span>
      )}
      {summary.warning > 0 && (
        <span className="inline-flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          {summary.warning}
        </span>
      )}
      {summary.info > 0 && (
        <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
          <Info className="h-3 w-3" />
          {summary.info}
        </span>
      )}
    </button>
  );
}
