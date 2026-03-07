import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskComplexityClassifier } from "@/components/task-complexity-classifier";
import { useSprints, useSprintDetail } from "@/hooks/use-sprints";
import { useQualityGates, resolveGateStatus } from "@/hooks/use-quality-gates";
import type { PipelineGate } from "@/components/pipeline-stepper";
import type { GateTransition } from "@/hooks/use-quality-gates";
import { EmptyState } from "@/components/empty-state";
import { PipelineStepper, computePhaseStatus } from "@/components/pipeline-stepper";
import { CognitivePhaseIndicator } from "@/components/cognitive-phase-indicator";
import { BurnoutRiskWidget } from "@/components/burnout-risk-widget";
import { PhaseContentView } from "@/components/phase-content-view";
import { GateDetailSheet } from "@/components/gate-detail-sheet";
import { GateSummaryBanner } from "@/components/gate-summary-banner";
import type { GateSummaryItem } from "@/components/gate-summary-banner";
import { EscalationBanner, ApprovalGateDialog } from "@/components/approval-gate";
import { usePhaseAutonomyConfigs } from "@/hooks/use-phase-autonomy";
import type { PipelinePhase as AutonomyPhase } from "@/hooks/use-phase-autonomy";
import { ROISummaryWidget } from "@/components/roi-summary-widget";

export function ProjectPipelinePage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/pipeline",
  });

  const { data: sprints, isLoading, isError, error } = useSprints(projectId);
  const [selectedSprint, setSelectedSprint] = useState<number>(0);

  // Default to last sprint when data loads
  useEffect(() => {
    if (sprints && sprints.length > 0 && selectedSprint === 0) {
      const last = sprints[sprints.length - 1]!;
      setSelectedSprint(last.number);
    }
  }, [sprints, selectedSprint]);

  const currentSprint = sprints?.find((s) => s.number === selectedSprint);
  const [activePhase, setActivePhase] = useState<string | undefined>();
  const [selectedGate, setSelectedGate] = useState<GateTransition | null>(null);
  const [classifierOpen, setClassifierOpen] = useState(false);
  const { data: sprintDetail } = useSprintDetail(projectId, selectedSprint);
  const { data: gatesData } = useQualityGates(projectId, selectedSprint);

  const pipelinePhases = currentSprint
    ? computePhaseStatus(currentSprint.phases, currentSprint.features_count)
    : [];

  const pipelineGates: PipelineGate[] = (gatesData ?? []).map((g) => ({
    transition: g.transition,
    status: resolveGateStatus(g),
  }));

  const summaryGates: GateSummaryItem[] = pipelineGates.map((g) => ({
    transition: g.transition,
    status: g.status,
  }));

  // Autonomy: phase configs + approval gate dialog state
  const { data: autonomyData } = usePhaseAutonomyConfigs(projectId);
  const [approvalGate, setApprovalGate] = useState<{
    open: boolean;
    phase: AutonomyPhase;
    agentConfidence: number;
    confidenceThreshold: number;
    outputSummary?: string;
  } | null>(null);

  // Phase id → autonomy pipeline phase mapping
  const PHASE_ID_TO_AUTONOMY: Record<string, AutonomyPhase> = {
    "1-brainstorming": "brainstorming",
    "2-specs": "specs",
    "3-prps": "prps",
    features: "implementation",
  };

  function handlePhaseClick(phaseId: string) {
    setActivePhase(phaseId);
    const autonomyPhase = PHASE_ID_TO_AUTONOMY[phaseId];
    if (!autonomyPhase) return;
    const pipelinePhase = pipelinePhases.find((p) => p.id === phaseId);
    if (pipelinePhase?.status !== "complete") return;
    const config = autonomyData?.phases.find((c) => c.phase === autonomyPhase);
    if (config?.autonomy_level === "approval_required") {
      setApprovalGate({
        open: true,
        phase: autonomyPhase,
        agentConfidence: 0.82,
        confidenceThreshold: config.confidence_threshold,
        outputSummary: `Fase ${autonomyPhase} completada. Aguardando aprovacao para continuar.`,
      });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Escalation banner — shown when there are pending escalations */}
      <EscalationBanner projectId={projectId} />

      {/* Header with sprint selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Sprint pipeline: brainstorming, specs, PRPs, features
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setClassifierOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Button>

        {sprints && sprints.length > 0 && (
          <select
            value={selectedSprint}
            onChange={(e) => setSelectedSprint(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {sprints.map((s) => (
              <option key={s.number} value={s.number}>
                Sprint {s.number}
              </option>
            ))}
          </select>
        )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load sprints: {error.message}
        </div>
      )}

      {/* No sprints */}
      {!isLoading && !isError && sprints && sprints.length === 0 && (
        <EmptyState
          icon={GitBranch}
          title="No sprints yet"
          description="Sprints will appear here once the pipeline generates them."
          className="min-h-[50vh]"
        />
      )}

      {/* Pipeline Stepper */}
      {currentSprint && pipelinePhases.length > 0 && (
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <CognitivePhaseIndicator phases={pipelinePhases} />
          </div>
          <PipelineStepper
            phases={pipelinePhases}
            activePhaseId={activePhase}
            onPhaseClick={handlePhaseClick}
            gates={pipelineGates}
            onGateClick={(transition) => setSelectedGate(transition)}
          />
        </div>
      )}

      {/* Gate summary banner */}
      {currentSprint && summaryGates.length > 0 && (
        <GateSummaryBanner
          gates={summaryGates}
          onGateClick={(transition) => setSelectedGate(transition)}
        />
      )}

      {/* Burnout risk widget + ROI summary */}
      {currentSprint && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BurnoutRiskWidget projectId={projectId} />
          <ROISummaryWidget projectId={projectId} />
        </div>
      )}

      {/* Sprint overview */}
      {currentSprint && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">
            Sprint {currentSprint.number}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">
                {currentSprint.phases["1-brainstorming"] ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Brainstorming</p>
            </div>
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">
                {currentSprint.phases["2-specs"] ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Specs</p>
            </div>
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">
                {currentSprint.phases["3-prps"] ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">PRPs</p>
            </div>
            <div className="rounded-md border bg-background p-3 text-center">
              <p className="text-2xl font-bold">
                {currentSprint.features_count}
              </p>
              <p className="text-xs text-muted-foreground">Features</p>
            </div>
          </div>
        </div>
      )}

      {/* Phase content view */}
      {activePhase && currentSprint && sprintDetail && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">
            {activePhase === "1-brainstorming"
              ? "Brainstorming"
              : activePhase === "2-specs"
                ? "Specs"
                : activePhase === "3-prps"
                  ? "PRPs"
                  : "Features"}
          </h2>
          <PhaseContentView
            projectSlug={projectId}
            sprintNumber={selectedSprint}
            phase={activePhase}
            files={
              activePhase === "features"
                ? []
                : sprintDetail.phases[activePhase] ?? []
            }
          />
        </div>
      )}

      {/* Gate detail sheet */}
      <GateDetailSheet
        projectSlug={projectId}
        sprintNumber={selectedSprint}
        transition={selectedGate}
        open={selectedGate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedGate(null);
        }}
      />

      {/* Task complexity classifier dialog */}
      <TaskComplexityClassifier
        open={classifierOpen}
        onOpenChange={setClassifierOpen}
        projectSlug={projectId}
      />

      {/* Approval gate dialog */}
      {approvalGate && (
        <ApprovalGateDialog
          open={approvalGate.open}
          onOpenChange={(open) => {
            if (!open) setApprovalGate(null);
          }}
          projectId={projectId}
          phase={approvalGate.phase}
          agentConfidence={approvalGate.agentConfidence}
          confidenceThreshold={approvalGate.confidenceThreshold}
          outputSummary={approvalGate.outputSummary}
        />
      )}
    </div>
  );
}
