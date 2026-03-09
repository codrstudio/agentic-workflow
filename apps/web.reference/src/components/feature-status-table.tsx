import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SprintFeature } from "@/hooks/use-sprints";

const statusColors: Record<string, string> = {
  passing:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failing: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  skipped:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  blocked:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

interface FeatureStatusTableProps {
  features: SprintFeature[];
}

export function FeatureStatusTable({ features }: FeatureStatusTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const passingCount = features.filter((f) => f.status === "passing").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {passingCount}/{features.length} passing
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="w-8 pb-2 pr-2" />
              <th className="pb-2 pr-4 font-medium">ID</th>
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Deps</th>
              <th className="pb-2 font-medium">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => {
              const isExpanded = expandedId === feature.id;
              return (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  allFeatures={features}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedId(isExpanded ? null : feature.id)
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        statusColors[status] ?? statusColors["pending"]
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function DepBadge({
  dep,
  allFeatures,
}: {
  dep: string;
  allFeatures: SprintFeature[];
}) {
  const depFeature = allFeatures.find((f) => f.id === dep);
  const depStatus = depFeature?.status ?? "pending";

  // Use a subtle border color matching the dep's status
  const borderColor: Record<string, string> = {
    passing: "border-green-400 dark:border-green-600",
    failing: "border-red-400 dark:border-red-600",
    pending: "border-gray-300 dark:border-gray-600",
    in_progress: "border-blue-400 dark:border-blue-600",
    blocked: "border-orange-400 dark:border-orange-600",
    skipped: "border-yellow-400 dark:border-yellow-600",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        borderColor[depStatus] ?? borderColor["pending"]
      )}
    >
      {dep}
    </Badge>
  );
}

function FeatureRow({
  feature,
  allFeatures,
  isExpanded,
  onToggle,
}: {
  feature: SprintFeature;
  allFeatures: SprintFeature[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <>
      <tr
        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50"
        onClick={onToggle}
      >
        <td className="py-2 pr-2">
          <Chevron className="h-4 w-4 text-muted-foreground" />
        </td>
        <td className="py-2 pr-4 font-mono text-xs">{feature.id}</td>
        <td className="py-2 pr-4">{feature.name}</td>
        <td className="py-2 pr-4">
          <FeatureStatusBadge status={feature.status} />
        </td>
        <td className="py-2 pr-4">
          {feature.dependencies.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {feature.dependencies.map((dep) => (
                <DepBadge key={dep} dep={dep} allFeatures={allFeatures} />
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        <td className="py-2">
          {feature.attempts != null ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              {feature.attempts}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b last:border-0">
          <td colSpan={6} className="px-8 py-3">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-foreground">{feature.description}</p>
              </div>
              {feature.tests.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Tests
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-foreground">
                    {feature.tests.map((test, i) => (
                      <li key={i}>{test}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feature.prp_path && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    PRP
                  </p>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {feature.prp_path}
                  </p>
                </div>
              )}
              {feature.completed_at && (
                <p className="text-xs text-muted-foreground">
                  Completed:{" "}
                  {new Date(feature.completed_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
