import { useState } from "react";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import {
  BarChart3,
  Zap,
  DollarSign,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import {
  useProjectMetrics,
  useSessionMetrics,
  useStepMetrics,
  type SessionMetrics,
  type StepMetrics,
} from "@/hooks/use-metrics";
import { EmptyState } from "@/components/empty-state";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import {
  MetricsTable,
  type MetricsColumn,
  formatTokens,
  formatCost,
  formatDuration,
} from "@/components/metrics-table";
import { ContextMetricsTab } from "@/components/context-metrics-tab";
import { BurnoutDashboardTab } from "@/components/burnout-dashboard-tab";
import { ComplexityDistributionChart } from "@/components/complexity-distribution-chart";
import { TrustProgressionDashboard } from "@/components/trust-progression-dashboard";
import { AIProductivityDashboard } from "@/components/ai-productivity-dashboard";
import { ComplianceDashboard } from "@/components/compliance-dashboard";
import { QualitySummaryTab } from "@/components/quality-summary-tab";
import { cn } from "@/lib/utils";

// --- Column definitions ---

const sessionColumns: MetricsColumn<SessionMetrics>[] = [
  { key: "title", label: "Sessao", format: "text", className: "font-medium truncate max-w-[200px]" },
  { key: "messages_count", label: "Msgs", format: "number" },
  { key: "tokens", label: "Tokens", format: "tokens" },
  { key: "cost_usd", label: "Custo", format: "cost" },
  { key: "duration_ms", label: "Duracao", format: "duration" },
  { key: "last_message_at", label: "Ultima msg", format: "date" },
];

const stepColumns: MetricsColumn<StepMetrics>[] = [
  { key: "wave", label: "Wave", format: "number" },
  { key: "step", label: "Step", format: "number" },
  { key: "name", label: "Nome", format: "text", className: "font-medium truncate max-w-[180px]" },
  { key: "agent", label: "Agente", format: "text", className: "text-muted-foreground" },
  { key: "duration_ms", label: "Duracao", format: "duration" },
  { key: "tokens", label: "Tokens", format: "tokens" },
  {
    key: "exit_code",
    label: "Exit",
    render: (value) => (
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
          value === 0
            ? "bg-green-500/10 text-green-700 dark:text-green-400"
            : value === null
              ? "bg-gray-500/10 text-gray-500"
              : "bg-red-500/10 text-red-700 dark:text-red-400"
        )}
      >
        {value ?? "-"}
      </span>
    ),
  },
];

// --- Sub-tabs ---

type MetricsTab = "general" | "context" | "wellbeing" | "spec-depth" | "autonomia" | "produtividade-ai" | "compliance" | "qualidade";

const TABS: { value: MetricsTab; label: string }[] = [
  { value: "general", label: "Geral" },
  { value: "context", label: "Context" },
  { value: "wellbeing", label: "Bem-estar" },
  { value: "spec-depth", label: "Spec Depth" },
  { value: "autonomia", label: "Autonomia" },
  { value: "produtividade-ai", label: "Produtividade AI" },
  { value: "compliance", label: "Compliance" },
  { value: "qualidade", label: "Qualidade" },
];

// --- Main Page ---

export function ProjectMetricsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/metrics",
  });
  const navigate = useNavigate();
  const search = useSearch({
    from: "/_authenticated/projects/$projectId/metrics",
  });
  const initialTab = (search.tab as MetricsTab) || "general";
  const [activeTab, setActiveTab] = useState<MetricsTab>(
    TABS.some((t) => t.value === initialTab) ? initialTab : "general"
  );

  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    error: metricsErr,
  } = useProjectMetrics(projectId);

  const { data: sessions, isLoading: sessionsLoading } =
    useSessionMetrics(projectId);

  const { data: steps, isLoading: stepsLoading } =
    useStepMetrics(projectId);

  const isLoading = metricsLoading || sessionsLoading || stepsLoading;

  if (metricsError) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar metricas: {metricsErr.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Metricas</h1>
        <p className="text-sm text-muted-foreground">
          Tokens, custos, sessoes e features do projeto
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2",
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General tab content */}
      {activeTab === "general" && (
        <>
          {/* KPI Cards */}
          {isLoading && (
            <KpiCardGrid>
              {[1, 2, 3, 4].map((i) => (
                <KpiCardSkeleton key={i} />
              ))}
            </KpiCardGrid>
          )}

          {metrics && (
            <KpiCardGrid>
              <KpiCard
                icon={Zap}
                iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                label="Total Tokens"
                value={formatTokens(metrics.total_tokens)}
                subtitle={`~${formatTokens(metrics.avg_session_tokens)} por sessao`}
              />
              <KpiCard
                icon={DollarSign}
                iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
                label="Custo Estimado"
                value={formatCost(metrics.total_cost_usd)}
              />
              <KpiCard
                icon={MessageSquare}
                iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                label="Sessoes"
                value={metrics.total_sessions.toString()}
                subtitle={
                  metrics.avg_session_duration_ms
                    ? `~${formatDuration(metrics.avg_session_duration_ms)} em media`
                    : undefined
                }
              />
              <KpiCard
                icon={CheckCircle}
                iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                label="Features"
                value={`${metrics.features_passing}/${metrics.total_features}`}
                subtitle={
                  metrics.total_features > 0
                    ? `${Math.round((metrics.features_passing / metrics.total_features) * 100)}% passing`
                    : undefined
                }
              />
            </KpiCardGrid>
          )}

          {/* Sessions table */}
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Sessoes recentes
            </h2>
            {sessionsLoading && (
              <div className="h-32 animate-pulse rounded-lg border bg-muted" />
            )}
            {sessions && (
              <MetricsTable
                data={sessions}
                columns={sessionColumns}
                keyFn={(s) => s.id}
                defaultSortKey="last_message_at"
                defaultSortDir="desc"
                emptyMessage="Nenhuma sessao encontrada"
                onRowClick={(s) =>
                  navigate({
                    to: "/projects/$projectId/chat/$sessionId",
                    params: { projectId, sessionId: s.id },
                  })
                }
              />
            )}
          </div>

          {/* Steps table */}
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Steps do harness
            </h2>
            {stepsLoading && (
              <div className="h-32 animate-pulse rounded-lg border bg-muted" />
            )}
            {steps && (
              <MetricsTable
                data={steps}
                columns={stepColumns}
                keyFn={(s) => `w${s.wave}-s${s.step}`}
                defaultSortKey="step"
                defaultSortDir="asc"
                emptyMessage="Nenhum step encontrado"
                onRowClick={() => {
                  // Harness route removed
                }}
              />
            )}
          </div>

          {/* Empty state when no data at all */}
          {!isLoading &&
            metrics &&
            metrics.total_sessions === 0 &&
            metrics.total_features === 0 && (
              <EmptyState
                icon={BarChart3}
                title="Sem metricas ainda"
                description="Metricas aparecerão aqui quando sessoes de chat ou steps do harness forem executados."
                className="min-h-[30vh]"
              />
            )}
        </>
      )}

      {/* Context tab content */}
      {activeTab === "context" && (
        <ContextMetricsTab projectId={projectId} />
      )}

      {/* Wellbeing tab content */}
      {activeTab === "wellbeing" && (
        <BurnoutDashboardTab projectId={projectId} />
      )}

      {/* Spec Depth tab content */}
      {activeTab === "spec-depth" && (
        <ComplexityDistributionChart projectId={projectId} />
      )}

      {/* Autonomia tab content */}
      {activeTab === "autonomia" && (
        <TrustProgressionDashboard projectId={projectId} />
      )}

      {/* Produtividade AI tab content */}
      {activeTab === "produtividade-ai" && (
        <AIProductivityDashboard projectId={projectId} />
      )}

      {/* Compliance tab content */}
      {activeTab === "compliance" && (
        <ComplianceDashboard projectId={projectId} />
      )}

      {/* Qualidade tab content */}
      {activeTab === "qualidade" && (
        <QualitySummaryTab projectId={projectId} />
      )}
    </div>
  );
}
