import { useState } from "react";
import { ShieldCheck, ShieldX, Shield, ShieldAlert, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GateTransition, GateStatus } from "@/hooks/use-quality-gates";

export interface GateSummaryItem {
  transition: GateTransition;
  status: GateStatus;
}

interface GateSummaryBannerProps {
  gates: GateSummaryItem[];
  onGateClick?: (transition: GateTransition) => void;
}

const TRANSITION_LABELS: Record<GateTransition, string> = {
  brainstorming_to_specs: "Brainstorming \u2192 Specs",
  specs_to_prps: "Specs \u2192 PRPs",
  prps_to_features: "PRPs \u2192 Features",
};

const GATE_ORDER: GateTransition[] = [
  "brainstorming_to_specs",
  "specs_to_prps",
  "prps_to_features",
];

const statusIcon: Record<GateStatus, typeof Shield> = {
  passing: ShieldCheck,
  failing: ShieldX,
  not_evaluated: Shield,
  overridden: ShieldAlert,
};

const statusColor: Record<GateStatus, string> = {
  passing: "text-green-500",
  failing: "text-red-500",
  not_evaluated: "text-muted-foreground",
  overridden: "text-yellow-500",
};

const statusBadgeClass: Record<GateStatus, string> = {
  passing: "bg-green-100 text-green-700 border-green-200",
  failing: "bg-red-100 text-red-700 border-red-200",
  not_evaluated: "bg-gray-100 text-gray-500 border-gray-200",
  overridden: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const statusLabel: Record<GateStatus, string> = {
  passing: "Passing",
  failing: "Failing",
  not_evaluated: "Nao avaliado",
  overridden: "Override",
};

function findNextFailingGate(gates: GateSummaryItem[]): GateSummaryItem | undefined {
  for (const transition of GATE_ORDER) {
    const gate = gates.find((g) => g.transition === transition);
    if (gate && gate.status === "failing") {
      return gate;
    }
  }
  return undefined;
}

export function GateSummaryBanner({ gates, onGateClick }: GateSummaryBannerProps) {
  const [expanded, setExpanded] = useState(false);

  // Don't render when no gate has been evaluated
  const hasEvaluated = gates.some((g) => g.status !== "not_evaluated");
  if (!hasEvaluated) return null;

  const passingCount = gates.filter(
    (g) => g.status === "passing" || g.status === "overridden"
  ).length;
  const total = gates.length;
  const nextFailing = findNextFailingGate(gates);

  return (
    <div className="rounded-lg border bg-card">
      {/* Compact banner - always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3",
          "hover:bg-accent/50 transition-colors rounded-lg",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {passingCount}/{total} gates passing
            </span>
          </div>

          {/* Inline status badges */}
          <div className="flex items-center gap-1.5">
            {GATE_ORDER.map((transition) => {
              const gate = gates.find((g) => g.transition === transition);
              if (!gate) return null;
              const Icon = statusIcon[gate.status];
              return (
                <div
                  key={transition}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    statusBadgeClass[gate.status]
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Alert for next failing gate */}
          {nextFailing && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Gate {TRANSITION_LABELS[nextFailing.transition]} requer atencao
              </span>
            </div>
          )}

          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded gate list */}
      {expanded && (
        <div className="border-t px-4 py-3">
          <div className="space-y-2">
            {GATE_ORDER.map((transition) => {
              const gate = gates.find((g) => g.transition === transition);
              if (!gate) return null;
              const Icon = statusIcon[gate.status];
              return (
                <button
                  key={transition}
                  type="button"
                  onClick={() => onGateClick?.(transition)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2",
                    "hover:bg-accent transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "text-left"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", statusColor[gate.status])} />
                    <span className="text-sm">{TRANSITION_LABELS[transition]}</span>
                  </div>
                  <Badge
                    className={cn("text-xs", statusBadgeClass[gate.status])}
                    variant="outline"
                  >
                    {statusLabel[gate.status]}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
