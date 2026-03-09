import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SnapshotActiveSprint } from "@/hooks/use-snapshots";

interface SprintProgressMiniProps {
  sprint: SnapshotActiveSprint;
  projectId: string;
}

export function SprintProgressMini({ sprint, projectId }: SprintProgressMiniProps) {
  const total = sprint.features_total;
  const passingPct = total > 0 ? (sprint.features_passing / total) * 100 : 0;
  const failingPct = total > 0 ? (sprint.features_failing / total) * 100 : 0;
  const pendingPct = total > 0 ? (sprint.features_pending / total) * 100 : 0;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          Sprint {sprint.number} — {sprint.current_phase}
        </span>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {total === 0 ? (
          <div className="w-full bg-gray-300" />
        ) : (
          <>
            {passingPct > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${passingPct}%` }}
              />
            )}
            {failingPct > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${failingPct}%` }}
              />
            )}
            {pendingPct > 0 && (
              <div
                className="bg-gray-400 transition-all"
                style={{ width: `${pendingPct}%` }}
              />
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">
            {sprint.features_passing} passing
          </Badge>
          <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
            {sprint.features_failing} failing
          </Badge>
          <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0">
            {sprint.features_pending} pending
          </Badge>
        </div>

        <Link
          to="/projects/$projectId/pipeline"
          params={{ projectId }}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Ver no Pipeline
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
