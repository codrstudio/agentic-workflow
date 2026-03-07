import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { useSprints, useSprintDetail } from "@/hooks/use-sprints";
import { EmptyState } from "@/components/empty-state";
import { PipelineStepper, computePhaseStatus } from "@/components/pipeline-stepper";
import { PhaseContentView } from "@/components/phase-content-view";

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
  const { data: sprintDetail } = useSprintDetail(projectId, selectedSprint);

  const pipelinePhases = currentSprint
    ? computePhaseStatus(currentSprint.phases, currentSprint.features_count)
    : [];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header with sprint selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Sprint pipeline: brainstorming, specs, PRPs, features
          </p>
        </div>

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
          <PipelineStepper
            phases={pipelinePhases}
            activePhaseId={activePhase}
            onPhaseClick={(phaseId) => setActivePhase(phaseId)}
          />
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
    </div>
  );
}
