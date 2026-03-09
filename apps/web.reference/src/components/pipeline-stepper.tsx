import { type ReactNode } from "react";
import {
  Lightbulb,
  FileText,
  ClipboardList,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GateIndicator } from "@/components/gate-indicator";
import type { GateStatus, GateTransition } from "@/hooks/use-quality-gates";

export type PhaseStatus = "empty" | "in_progress" | "complete";

export interface PipelinePhase {
  id: string;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  status: PhaseStatus;
  autonomyBadge?: ReactNode;
  costBadge?: ReactNode;
}

export interface PipelineGate {
  transition: GateTransition;
  status: GateStatus;
}

interface PipelineStepperProps {
  phases: PipelinePhase[];
  activePhaseId?: string;
  onPhaseClick?: (phaseId: string) => void;
  gates?: PipelineGate[];
  onGateClick?: (transition: GateTransition) => void;
}

const statusColors: Record<PhaseStatus, { bg: string; border: string; icon: string }> = {
  empty: {
    bg: "bg-muted",
    border: "border-muted-foreground/30",
    icon: "text-muted-foreground",
  },
  in_progress: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    border: "border-yellow-500",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
  complete: {
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-500",
    icon: "text-green-600 dark:text-green-400",
  },
};

const lineColors: Record<PhaseStatus, string> = {
  empty: "bg-muted-foreground/20",
  in_progress: "bg-yellow-400",
  complete: "bg-green-500",
};

// Maps phase index to the gate transition between phase[index] and phase[index+1]
const PHASE_GATE_MAP: GateTransition[] = [
  "brainstorming_to_specs",
  "specs_to_prps",
  "prps_to_features",
];

export function PipelineStepper({
  phases,
  activePhaseId,
  onPhaseClick,
  gates,
  onGateClick,
}: PipelineStepperProps) {
  return (
    <div className="flex items-center w-full">
      {phases.map((phase, index) => {
        const colors = statusColors[phase.status];
        const isActive = phase.id === activePhaseId;
        const gateTransition = PHASE_GATE_MAP[index];
        const gate = gateTransition
          ? gates?.find((g) => g.transition === gateTransition)
          : undefined;

        return (
          <div key={phase.id} className="flex items-center flex-1 last:flex-none">
            {/* Phase circle + label */}
            <button
              type="button"
              onClick={() => onPhaseClick?.(phase.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 group cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-1"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  colors.bg,
                  colors.border,
                  isActive && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                )}
              >
                <span className={cn("h-5 w-5", colors.icon)}>
                  {phase.icon}
                </span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium text-center leading-tight",
                  phase.status === "empty"
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}
              >
                <span className="hidden sm:inline">{phase.label}</span>
                <span className="sm:hidden">{phase.shortLabel}</span>
              </span>
              {phase.autonomyBadge && phase.autonomyBadge}
              {phase.costBadge && phase.costBadge}
            </button>

            {/* Connector line with gate indicator */}
            {index < phases.length - 1 && (
              <div className="flex-1 mx-2 sm:mx-3 flex items-center gap-1">
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    lineColors[phase.status]
                  )}
                />
                {gate && (
                  <GateIndicator
                    transition={gate.transition}
                    status={gate.status}
                    onClick={onGateClick}
                  />
                )}
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    lineColors[phase.status]
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function computePhaseStatus(
  phases: Record<string, number>,
  featuresCount: number
): PipelinePhase[] {
  const phaseDefinitions = [
    {
      id: "1-brainstorming",
      label: "Brainstorming",
      shortLabel: "Brain",
      icon: <Lightbulb className="h-5 w-5" />,
      countKey: "1-brainstorming",
    },
    {
      id: "2-specs",
      label: "Specs",
      shortLabel: "Specs",
      icon: <FileText className="h-5 w-5" />,
      countKey: "2-specs",
    },
    {
      id: "3-prps",
      label: "PRPs",
      shortLabel: "PRPs",
      icon: <ClipboardList className="h-5 w-5" />,
      countKey: "3-prps",
    },
    {
      id: "features",
      label: "Features",
      shortLabel: "Feat",
      icon: <CheckSquare className="h-5 w-5" />,
      countKey: "features",
    },
  ];

  const counts = phaseDefinitions.map((p) =>
    p.countKey === "features" ? featuresCount : (phases[p.countKey] ?? 0)
  );

  // Determine status: a phase is "complete" if it has files.
  // The first phase with 0 files (after completed phases) is "in_progress"
  // if there are completed phases before it.
  // All phases after the first empty one are "empty".
  let foundFirstEmpty = false;
  let hasCompletedBefore = false;

  return phaseDefinitions.map((p, i) => {
    const count = counts[i]!;
    let status: PhaseStatus;

    if (foundFirstEmpty) {
      status = "empty";
    } else if (count > 0) {
      status = "complete";
      hasCompletedBefore = true;
    } else {
      // count === 0
      if (hasCompletedBefore) {
        status = "in_progress";
      } else {
        status = "empty";
      }
      foundFirstEmpty = true;
    }

    return {
      id: p.id,
      label: p.label,
      shortLabel: p.shortLabel,
      icon: p.icon,
      status,
    };
  });
}
