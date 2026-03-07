import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Layers,
  Clock,
} from "lucide-react";
import { useHarnessStatus, type StepInfo, type WaveInfo } from "@/hooks/use-harness";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { StepTimeline, StepStatusIcon, StepTypeBadge, formatDuration } from "@/components/step-timeline";

type HarnessStatusType = "running" | "completed" | "failed" | "idle";

function StatusBadge({ status }: { status: HarnessStatusType }) {
  const config: Record<HarnessStatusType, { label: string; className: string }> = {
    running: {
      label: "Running",
      className: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    },
    completed: {
      label: "Completed",
      className: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    },
    idle: {
      label: "Idle",
      className: "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400",
    },
    failed: {
      label: "Failed",
      className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    },
  };

  const cfg = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1", cfg.className)}>
      {status === "running" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {cfg.label}
    </Badge>
  );
}

function StepDetailPanel({ step }: { step: StepInfo }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <StepStatusIcon status={step.status} />
        <div>
          <h3 className="font-semibold">Step {step.number}: {step.name}</h3>
          <StepTypeBadge type={step.type} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Agent</span>
          <p className="font-medium">{step.agent}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Task</span>
          <p className="font-medium">{step.task}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <p className="font-medium capitalize">{step.status}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Duration</span>
          <p className="font-medium">{formatDuration(step.duration_ms)}</p>
        </div>
        {step.exit_code != null && (
          <div>
            <span className="text-muted-foreground">Exit Code</span>
            <p className={cn("font-medium", step.exit_code !== 0 && "text-red-500")}>
              {step.exit_code}
            </p>
          </div>
        )}
        {step.started_at && (
          <div>
            <span className="text-muted-foreground">Started</span>
            <p className="font-medium text-xs">
              {new Date(step.started_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceDetailPage() {
  const { projectId } = useParams({ from: "/_authenticated/harness/$projectId" });
  const { data: status, isLoading, error } = useHarnessStatus(projectId);
  const [selectedWave, setSelectedWave] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState<StepInfo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Determine the active wave
  const activeWaveNumber = selectedWave ?? status?.current_wave ?? null;
  const activeWave: WaveInfo | null =
    status?.waves.find((w) => w.number === activeWaveNumber) ?? null;

  const handleSelectStep = (step: StepInfo) => {
    setSelectedStep(step);
    // On mobile, open sheet
    setSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Link to="/harness" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Harness
        </Link>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Activity className="h-10 w-10 opacity-30" />
          <p className="text-sm">Workspace not found or unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Back link */}
      <Link to="/harness" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        Back to Harness
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {projectId}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              Wave {status.current_wave ?? "-"}
            </span>
          </div>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {/* Wave selector */}
      {status.waves.length > 1 && (
        <div className="flex gap-1 border-b">
          {status.waves.map((wave) => (
            <button
              key={wave.number}
              onClick={() => {
                setSelectedWave(wave.number);
                setSelectedStep(null);
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeWaveNumber === wave.number
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              Wave {wave.number}
            </button>
          ))}
        </div>
      )}

      {/* Main content: timeline + side panel */}
      <div className="flex gap-6">
        {/* StepTimeline area */}
        <div className="flex-1 min-w-0">
          <StepTimeline
            steps={activeWave?.steps ?? []}
            selectedStep={selectedStep}
            onSelectStep={handleSelectStep}
          />
        </div>

        {/* Desktop side panel */}
        <div className="hidden md:block w-80 shrink-0">
          {selectedStep ? (
            <div className="sticky top-4 rounded-lg border bg-card p-4 shadow-sm">
              <StepDetailPanel step={selectedStep} />
            </div>
          ) : (
            <div className="sticky top-4 rounded-lg border bg-card p-6 shadow-sm flex flex-col items-center justify-center text-muted-foreground">
              <Clock className="h-8 w-8 opacity-30 mb-2" />
              <p className="text-sm text-center">Select a step to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="md:hidden max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>
              {selectedStep
                ? `Step ${selectedStep.number}: ${selectedStep.name}`
                : "Step Details"}
            </SheetTitle>
            <SheetDescription>
              {selectedStep?.type ?? ""}
            </SheetDescription>
          </SheetHeader>
          {selectedStep && (
            <div className="p-4 overflow-y-auto">
              <StepDetailPanel step={selectedStep} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
