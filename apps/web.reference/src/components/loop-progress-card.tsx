import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  SkipForward,
  Circle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LoopMeta } from "@/hooks/use-harness";
import type { SprintFeature } from "@/hooks/use-sprints";

type FeatureStatus = "passing" | "failing" | "skipped" | "pending" | "in_progress" | "blocked";

const STATUS_CONFIG: Record<FeatureStatus, { color: string; bgColor: string; label: string }> = {
  passing: { color: "bg-green-500", bgColor: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30", label: "Passing" },
  failing: { color: "bg-red-500", bgColor: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", label: "Failing" },
  skipped: { color: "bg-yellow-500", bgColor: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30", label: "Skipped" },
  pending: { color: "bg-gray-400", bgColor: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/30", label: "Pending" },
  in_progress: { color: "bg-blue-500", bgColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30", label: "In Progress" },
  blocked: { color: "bg-orange-500", bgColor: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30", label: "Blocked" },
};

function StatusIcon({ status }: { status: FeatureStatus }) {
  switch (status) {
    case "passing":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case "failing":
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    case "skipped":
      return <SkipForward className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
    case "in_progress":
      return (
        <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
          <Loader2 className="relative h-3.5 w-3.5 text-blue-500 animate-spin" />
        </span>
      );
    case "blocked":
      return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
    case "pending":
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  }
}

function countByStatus(features: SprintFeature[]) {
  const counts: Record<string, number> = {
    passing: 0,
    failing: 0,
    skipped: 0,
    pending: 0,
    in_progress: 0,
    blocked: 0,
  };
  for (const f of features) {
    const s = f.status as string;
    if (s in counts) {
      counts[s]!++;
    }
  }
  return counts;
}

interface SegmentedProgressBarProps {
  counts: Record<string, number>;
  total: number;
}

function SegmentedProgressBar({ counts, total }: SegmentedProgressBarProps) {
  if (total === 0) return null;

  const segments: { status: FeatureStatus; count: number }[] = [
    { status: "passing", count: counts["passing"] ?? 0 },
    { status: "failing", count: counts["failing"] ?? 0 },
    { status: "in_progress", count: counts["in_progress"] ?? 0 },
    { status: "skipped", count: counts["skipped"] ?? 0 },
    { status: "blocked", count: counts["blocked"] ?? 0 },
    { status: "pending", count: counts["pending"] ?? 0 },
  ];

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      {segments.map(
        ({ status, count }) =>
          count > 0 && (
            <div
              key={status}
              className={cn("h-full transition-all", STATUS_CONFIG[status].color)}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${STATUS_CONFIG[status].label}: ${count}`}
            />
          )
      )}
    </div>
  );
}

export interface LoopProgressCardProps {
  loop: LoopMeta;
  features: SprintFeature[];
}

export function LoopProgressCard({ loop, features }: LoopProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const counts = countByStatus(features);
  const total = features.length;
  const currentFeature = features.find((f) => f.status === "in_progress");

  return (
    <div className="rounded-lg border bg-card">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent/50 transition-colors rounded-lg"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">Loop Progress</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Iteration {loop.iteration}/{loop.total}
            </Badge>
          </div>

          {/* Segmented progress bar */}
          <SegmentedProgressBar counts={counts} total={total} />

          {/* Counters row */}
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            {counts["passing"]! > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" /> {counts["passing"]} passing
              </span>
            )}
            {counts["failing"]! > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle className="h-3 w-3" /> {counts["failing"]} failing
              </span>
            )}
            {counts["skipped"]! > 0 && (
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <SkipForward className="h-3 w-3" /> {counts["skipped"]} skipped
              </span>
            )}
            {counts["blocked"]! > 0 && (
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3" /> {counts["blocked"]} blocked
              </span>
            )}
          </div>

          {/* Current feature indicator */}
          {currentFeature && (
            <div className="flex items-center gap-2 mt-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
                {currentFeature.id}: {currentFeature.name}
              </span>
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded: mini feature table */}
      {expanded && (
        <div className="border-t px-3 pb-3">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1 font-medium">ID</th>
                <th className="text-left py-1 font-medium">Feature</th>
                <th className="text-left py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => {
                const status = f.status as FeatureStatus;
                const isCurrent = f.status === "in_progress";
                return (
                  <tr
                    key={f.id}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      isCurrent && "bg-blue-500/5"
                    )}
                  >
                    <td className="py-1.5 font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {isCurrent && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                          </span>
                        )}
                        {f.id}
                      </span>
                    </td>
                    <td className="py-1.5 truncate max-w-[150px]">{f.name}</td>
                    <td className="py-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          STATUS_CONFIG[status]?.bgColor ?? ""
                        )}
                      >
                        <StatusIcon status={status} />
                        <span className="ml-1">{STATUS_CONFIG[status]?.label ?? status}</span>
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
