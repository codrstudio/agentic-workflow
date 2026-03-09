import React, { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCode,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Play,
  ShieldAlert,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRescueProject,
  usePatchRescueProject,
  useAudit,
  useTriggerAudit,
  useReverseSpecs,
  useTriggerReverseSpecs,
  usePromoteReverseSpec,
  useRemediationPlan,
  useTriggerRemediation,
  useGenerateFeatures,
  type RescuePhase,
  type RescueDifficulty,
  type IssueSeverity,
  type EffortEstimate,
  type ItemStatus,
} from "@/hooks/use-rescue";

// ---- Constants ----

const PHASES: { id: RescuePhase; label: string; icon: React.ElementType }[] = [
  { id: "audit", label: "Audit", icon: ShieldAlert },
  { id: "reverse_spec", label: "Reverse Specs", icon: FileCode },
  { id: "gap_analysis", label: "Gap Analysis", icon: Layers },
  { id: "remediation", label: "Remediation", icon: Wrench },
  { id: "execution", label: "Execution", icon: Play },
  { id: "validation", label: "Validation", icon: CheckCircle2 },
];

// ---- Helpers ----

function difficultyColor(d: RescueDifficulty): string {
  switch (d) {
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400";
    case "medium":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400";
    case "extreme":
      return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
  }
}

function severityColor(s: IssueSeverity): string {
  switch (s) {
    case "critical":
      return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400";
    case "medium":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
    case "low":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400";
  }
}

function effortColor(e: EffortEstimate): string {
  switch (e) {
    case "small":
      return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400";
    case "medium":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
    case "large":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400";
    case "xlarge":
      return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
  }
}

function itemStatusColor(s: ItemStatus): string {
  switch (s) {
    case "pending":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "in_progress":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400";
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400";
    case "skipped":
      return "bg-gray-100 text-gray-400 dark:bg-gray-800";
  }
}

function categoryColor(c: string): string {
  const map: Record<string, string> = {
    testing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400",
    types: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
    architecture: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
    security: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    documentation: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400",
    performance: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  };
  return map[c] ?? "bg-gray-100 text-gray-600";
}

// ---- Stepper ----

interface StepperProps {
  currentPhase: RescuePhase;
  phasesCompleted: string[];
}

function Stepper({ currentPhase, phasesCompleted }: StepperProps) {
  return (
    <div
      className="flex items-center gap-0 overflow-x-auto border-b bg-muted/20 px-4 py-3"
      data-testid="rescue-stepper"
    >
      {PHASES.map((phase, idx) => {
        const isCompleted = phasesCompleted.includes(phase.id);
        const isCurrent = phase.id === currentPhase;
        const isPending = !isCompleted && !isCurrent;
        return (
          <React.Fragment key={phase.id}>
            <div className="flex flex-col items-center gap-1 min-w-[80px]">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold",
                  isCompleted
                    ? "border-green-500 bg-green-500 text-white"
                    : isCurrent
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-300 bg-background text-muted-foreground"
                )}
                data-testid={`phase-${phase.id}-${isCompleted ? "completed" : isCurrent ? "current" : "pending"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <phase.icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCompleted
                    ? "text-green-600"
                    : isCurrent
                    ? "text-blue-600"
                    : "text-muted-foreground"
                )}
              >
                {phase.label}
              </span>
            </div>
            {idx < PHASES.length - 1 && (
              <ChevronRight
                className={cn(
                  "mx-1 h-4 w-4 shrink-0",
                  isCompleted ? "text-green-400" : "text-muted-foreground/40"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---- Badge ----

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

// ---- KPI Card ----

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---- Audit Phase ----

function AuditPhase({
  projectSlug,
  rescueId,
}: {
  projectSlug: string;
  rescueId: string;
}) {
  const { data: audit, isLoading, error } = useAudit(projectSlug, rescueId);
  const trigger = useTriggerAudit(projectSlug, rescueId);

  const hasAudit = !!audit;

  return (
    <div className="flex flex-col gap-6" data-testid="audit-phase">
      {!hasAudit && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-10">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Execute o audit automatizado do codebase para identificar issues, metricas e
            dificuldade de rescue.
          </p>
          <button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending || isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="iniciar-audit-btn"
          >
            {trigger.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Iniciar Audit
          </button>
          {trigger.isError && (
            <p className="text-xs text-red-500">{String(trigger.error)}</p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {audit && (
        <>
          {/* 5 KPI Cards */}
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            data-testid="audit-kpi-cards"
          >
            <KpiCard label="Files" value={audit.metrics.files} />
            <KpiCard label="Lines" value={audit.metrics.lines.toLocaleString()} />
            <KpiCard
              label="Languages"
              value={audit.metrics.languages.length}
              sub={audit.metrics.languages.join(", ")}
            />
            <KpiCard
              label="Test Coverage"
              value={audit.health.test_coverage_estimate ?? "N/A"}
              sub={audit.health.has_tests ? "Tests found" : "No tests"}
            />
            <KpiCard
              label="Dep. Health"
              value={
                <Badge
                  className={cn(
                    "text-sm",
                    audit.health.dependency_health === "healthy"
                      ? "bg-green-100 text-green-700"
                      : audit.health.dependency_health === "outdated"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {audit.health.dependency_health}
                </Badge>
              }
            />
          </div>

          {/* Difficulty Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Dificuldade de Rescue:</span>
            <Badge
              className={cn("text-sm px-3 py-1", difficultyColor(audit.rescue_difficulty))}
              data-testid="difficulty-badge"
            >
              {audit.rescue_difficulty.toUpperCase()}
            </Badge>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              ~{audit.estimated_effort_hours}h estimadas
            </span>
          </div>

          {/* AI Summary */}
          <div
            className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30"
            data-testid="ai-summary-card"
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-500">
              AI Summary
            </p>
            <p className="text-sm text-foreground">{audit.ai_summary}</p>
          </div>

          {/* Issues List */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Issues encontradas ({audit.issues.length})
            </h3>
            <div className="flex flex-col gap-2" data-testid="issues-list">
              {Object.entries(
                audit.issues.reduce<Record<string, typeof audit.issues>>((acc, issue) => {
                  (acc[issue.category] ??= []).push(issue);
                  return acc;
                }, {})
              ).map(([category, issues]) => (
                <div key={category} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                    <span className="text-xs font-semibold capitalize text-muted-foreground">
                      {category}
                    </span>
                    <Badge className="bg-gray-100 text-gray-600">{issues.length}</Badge>
                  </div>
                  <div className="divide-y">
                    {issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2">
                        <Badge className={cn("mt-0.5 shrink-0", severityColor(issue.severity))}>
                          {issue.severity}
                        </Badge>
                        <div>
                          <p className="text-sm">{issue.description}</p>
                          {issue.file_path && (
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {issue.file_path}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Re-trigger button */}
          <div>
            <button
              onClick={() => trigger.mutate()}
              disabled={trigger.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {trigger.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Re-executar Audit
            </button>
          </div>
        </>
      )}

      {error && !audit && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum audit encontrado. Clique em &quot;Iniciar Audit&quot; para comecar.
        </div>
      )}
    </div>
  );
}

// ---- Reverse Specs Phase ----

function ReverseSpecsPhase({
  projectSlug,
  rescueId,
}: {
  projectSlug: string;
  rescueId: string;
}) {
  const { data: specs = [], isLoading, error } = useReverseSpecs(projectSlug, rescueId);
  const trigger = useTriggerReverseSpecs(projectSlug, rescueId);
  const promote = usePromoteReverseSpec(projectSlug, rescueId);

  return (
    <div className="flex flex-col gap-6" data-testid="reverse-specs-phase">
      {specs.length === 0 && !isLoading && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-10">
          <FileCode className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Gere as reverse-specs por modulo do codebase.
          </p>
          <button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {trigger.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Gerar Reverse Specs
          </button>
          {trigger.isError && (
            <p className="text-xs text-red-500">{String(trigger.error)}</p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {specs.length > 0 && (
        <div className="flex flex-col gap-3">
          {specs.map((spec) => (
            <div key={spec.id} className="rounded-lg border" data-testid={`reverse-spec-${spec.id}`}>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{spec.module_name}</h3>
                    <Badge className="bg-gray-100 text-gray-600">
                      {spec.issues_found.length} issues
                    </Badge>
                    {spec.promoted_to_spec_id && (
                      <Badge className="bg-green-100 text-green-700">Promovido</Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {spec.inferred_purpose}
                  </p>
                </div>
                <button
                  onClick={() => promote.mutate(spec.id)}
                  disabled={promote.isPending || !!spec.promoted_to_spec_id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  data-testid={`promote-btn-${spec.id}`}
                >
                  {promote.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {spec.promoted_to_spec_id ? "Promovido" : "Promover a Spec Formal"}
                </button>
              </div>

              <div className="border-t px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {spec.issues_found.map((issue, i) => (
                    <Badge key={i} className={severityColor(issue.severity)}>
                      {issue.severity}: {issue.description.slice(0, 40)}
                      {issue.description.length > 40 ? "…" : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending}
            className="self-start inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {trigger.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Re-gerar Reverse Specs
          </button>
        </div>
      )}

      {error && specs.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma reverse-spec encontrada. Clique em &quot;Gerar Reverse Specs&quot; para comecar.
        </div>
      )}
    </div>
  );
}

// ---- Gap Analysis Phase ----

function GapAnalysisPhase({
  projectSlug,
  rescueId,
}: {
  projectSlug: string;
  rescueId: string;
}) {
  const { data: audit } = useAudit(projectSlug, rescueId);
  const { data: specs = [] } = useReverseSpecs(projectSlug, rescueId);

  return (
    <div className="flex flex-col gap-4" data-testid="gap-analysis-phase">
      <div className="rounded-xl border bg-muted/20 p-6">
        <h3 className="mb-2 font-semibold">Gap Analysis</h3>
        <p className="text-sm text-muted-foreground">
          Comparativo entre issues encontradas no audit e as reverse-specs geradas por modulo.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Audit Issues
            </p>
            <p className="mt-2 text-3xl font-bold">{audit?.issues.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {audit
                ? `Dificuldade: ${audit.rescue_difficulty} — ~${audit.estimated_effort_hours}h`
                : "Audit ainda nao executado"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Modulos Identificados
            </p>
            <p className="mt-2 text-3xl font-bold">{specs.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {specs.length > 0
                ? `${specs.filter((s) => s.promoted_to_spec_id).length} promovidos a spec formal`
                : "Reverse specs ainda nao geradas"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Gap analysis detalhado (comparativo estruturado) estara disponivel em versao futura.
          <br />
          Avance para a fase de Remediation para gerar o plano de acao.
        </div>
      </div>
    </div>
  );
}

// ---- Remediation Phase ----

function RemediationPhase({
  projectSlug,
  rescueId,
}: {
  projectSlug: string;
  rescueId: string;
}) {
  const { data: plan, isLoading, error } = useRemediationPlan(projectSlug, rescueId);
  const triggerRemediation = useTriggerRemediation(projectSlug, rescueId);
  const generateFeatures = useGenerateFeatures(projectSlug, rescueId);
  const [featuresGenerated, setFeaturesGenerated] = useState(false);

  const handleGenerateFeatures = () => {
    generateFeatures.mutate(undefined, {
      onSuccess: () => setFeaturesGenerated(true),
    });
  };

  return (
    <div className="flex flex-col gap-6" data-testid="remediation-phase">
      {!plan && !isLoading && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-10">
          <Wrench className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Gere o plano de remediacao priorizado baseado no audit e reverse-specs.
          </p>
          <button
            onClick={() => triggerRemediation.mutate()}
            disabled={triggerRemediation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="gerar-plano-btn"
          >
            {triggerRemediation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
            Gerar Plano
          </button>
          {triggerRemediation.isError && (
            <p className="text-xs text-red-500">{String(triggerRemediation.error)}</p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {plan && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">
                Plano de Remediacao ({plan.items.length} items)
              </h3>
              <p className="text-xs text-muted-foreground">
                Esforco total estimado: {plan.total_effort_estimate}
              </p>
            </div>
            <button
              onClick={handleGenerateFeatures}
              disabled={generateFeatures.isPending || featuresGenerated}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              data-testid="gerar-features-btn"
            >
              {generateFeatures.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {featuresGenerated ? "Features Geradas!" : "Gerar Features"}
            </button>
          </div>

          {generateFeatures.isError && (
            <p className="text-xs text-red-500">{String(generateFeatures.error)}</p>
          )}

          <div className="flex flex-col gap-2" data-testid="remediation-items">
            {plan.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border bg-card p-4"
                data-testid={`remediation-item-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-lg font-bold tabular-nums text-muted-foreground">
                    #{item.priority}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{item.title}</span>
                      <Badge className={categoryColor(item.category)}>{item.category}</Badge>
                      <Badge className={effortColor(item.effort_estimate)}>
                        {item.effort_estimate}
                      </Badge>
                      <Badge className={itemStatusColor(item.status)}>{item.status}</Badge>
                      {item.feature_id && (
                        <Badge className="bg-indigo-100 text-indigo-700">{item.feature_id}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => triggerRemediation.mutate()}
            disabled={triggerRemediation.isPending}
            className="self-start inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {triggerRemediation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wrench className="h-3 w-3" />
            )}
            Re-gerar Plano
          </button>
        </>
      )}

      {error && !plan && !isLoading && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum plano encontrado. Clique em &quot;Gerar Plano&quot; para comecar.
        </div>
      )}
    </div>
  );
}

// ---- Execution Phase ----

function ExecutionPhase({ projectSlug }: { projectSlug: string }) {
  return (
    <div className="flex flex-col gap-4" data-testid="execution-phase">
      <div className="rounded-xl border bg-muted/20 p-6">
        <div className="flex items-center gap-3">
          <Play className="h-8 w-8 text-blue-500" />
          <div>
            <h3 className="font-semibold">Fase de Execucao</h3>
            <p className="text-sm text-muted-foreground">
              Features geradas pelo plano de remediacao estao prontas para execucao via pipeline.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={`/projects/${projectSlug}/harness/board`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Agentic Board</p>
              <p className="text-xs text-muted-foreground">
                Acompanhe execucao das features no board
              </p>
            </div>
          </a>
          <a
            href={`/projects/${projectSlug}/pipeline`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <Layers className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Pipeline</p>
              <p className="text-xs text-muted-foreground">
                Visualize o pipeline de execucao do harness
              </p>
            </div>
          </a>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Proximos passos:</strong> Execute o harness com as features geradas. Apos
            conclusao, avance para a fase de Validation para verificar criterios de qualidade.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Validation Phase ----

function ValidationPhase({ projectSlug }: { projectSlug: string }) {
  return (
    <div className="flex flex-col gap-4" data-testid="validation-phase">
      <div className="rounded-xl border bg-muted/20 p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <h3 className="font-semibold">Fase de Validacao</h3>
            <p className="text-sm text-muted-foreground">
              Verifique criterios de qualidade apos execucao do plano de remediacao.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={`/projects/${projectSlug}/security`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Security Dashboard</p>
              <p className="text-xs text-muted-foreground">
                Verifique criterios de seguranca e compliance
              </p>
            </div>
          </a>
          <a
            href={`/projects/${projectSlug}/settings/quality-gates`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Quality Gates</p>
              <p className="text-xs text-muted-foreground">
                Configure e verifique quality gates do projeto
              </p>
            </div>
          </a>
        </div>

        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
          <p className="text-xs text-green-700 dark:text-green-400">
            <strong>Criterios de sucesso:</strong> Cobertura de testes &gt;60%, zero issues
            criticos no security dashboard, todos os quality gates passando.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Phase Footer ----

const PHASE_ORDER: RescuePhase[] = [
  "audit",
  "reverse_spec",
  "gap_analysis",
  "remediation",
  "execution",
  "validation",
];

interface PhaseFooterProps {
  currentPhase: RescuePhase;
  projectSlug: string;
  rescueId: string;
}

function PhaseFooter({ currentPhase, projectSlug, rescueId }: PhaseFooterProps) {
  const patchRescue = usePatchRescueProject(projectSlug, rescueId);
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const nextPhase = PHASE_ORDER[currentIdx + 1];

  if (!nextPhase) {
    return (
      <div className="border-t bg-muted/20 px-6 py-4">
        <p className="text-sm font-medium text-green-600">
          Rescue completo! Todas as fases foram executadas.
        </p>
      </div>
    );
  }

  const nextLabel = PHASES.find((p) => p.id === nextPhase)?.label ?? nextPhase;

  return (
    <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
      <p className="text-sm text-muted-foreground">
        Proxima fase: <span className="font-medium text-foreground">{nextLabel}</span>
      </p>
      <button
        onClick={() => patchRescue.mutate({ phase: nextPhase })}
        disabled={patchRescue.isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        data-testid="avancar-fase-btn"
      >
        {patchRescue.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Avancar Fase
      </button>
    </div>
  );
}

// ---- Main Page ----

export function RescueWizardPage() {
  const { projectId, rescueId } = useParams({ strict: false }) as {
    projectId: string;
    rescueId: string;
  };

  const { data: rescueProject, isLoading, error } = useRescueProject(projectId, rescueId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !rescueProject) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <p className="text-sm text-muted-foreground">Rescue project nao encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="rescue-wizard">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Wrench className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-bold">{rescueProject.name}</h1>
          <p className="text-xs text-muted-foreground">
            Rescue Wizard &mdash; {rescueProject.source_path}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper
        currentPhase={rescueProject.phase}
        phasesCompleted={rescueProject.phases_completed}
      />

      {/* Phase content */}
      <div className="flex-1 p-6">
        {rescueProject.phase === "audit" && (
          <AuditPhase projectSlug={projectId} rescueId={rescueId} />
        )}
        {rescueProject.phase === "reverse_spec" && (
          <ReverseSpecsPhase projectSlug={projectId} rescueId={rescueId} />
        )}
        {rescueProject.phase === "gap_analysis" && (
          <GapAnalysisPhase projectSlug={projectId} rescueId={rescueId} />
        )}
        {rescueProject.phase === "remediation" && (
          <RemediationPhase projectSlug={projectId} rescueId={rescueId} />
        )}
        {rescueProject.phase === "execution" && (
          <ExecutionPhase projectSlug={projectId} />
        )}
        {rescueProject.phase === "validation" && (
          <ValidationPhase projectSlug={projectId} />
        )}
      </div>

      {/* Footer */}
      <PhaseFooter
        currentPhase={rescueProject.phase}
        projectSlug={projectId}
        rescueId={rescueId}
      />
    </div>
  );
}
