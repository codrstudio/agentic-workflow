import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Zap,
  DollarSign,
  MessageSquare,
  CheckCircle,
  ArrowUpDown,
  ExternalLink,
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
import { cn } from "@/lib/utils";

// --- Formatting helpers ---

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Sortable Table ---

type SortDir = "asc" | "desc";

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn("h-3 w-3", active ? "text-foreground" : "opacity-30")}
        />
        {active && (
          <span className="text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );
}

// --- Sessions Table ---

function SessionsTable({
  sessions,
  projectId,
}: {
  sessions: SessionMetrics[];
  projectId: string;
}) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<keyof SessionMetrics>("last_message_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: keyof SessionMetrics) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...sessions].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const columns: Array<{ key: keyof SessionMetrics; label: string }> = [
    { key: "title", label: "Sessao" },
    { key: "messages_count", label: "Msgs" },
    { key: "tokens", label: "Tokens" },
    { key: "cost_usd", label: "Custo" },
    { key: "duration_ms", label: "Duracao" },
    { key: "last_message_at", label: "Ultima msg" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {columns.map((col) => (
              <SortHeader
                key={col.key}
                label={col.label}
                active={sortKey === col.key}
                dir={sortDir}
                onClick={() => toggleSort(col.key)}
              />
            ))}
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.id}
              className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() =>
                navigate({
                  to: "/projects/$projectId/chat/$sessionId",
                  params: { projectId, sessionId: s.id },
                })
              }
            >
              <td className="px-3 py-2 font-medium truncate max-w-[200px]">
                {s.title}
              </td>
              <td className="px-3 py-2 tabular-nums">{s.messages_count}</td>
              <td className="px-3 py-2 tabular-nums">{formatTokens(s.tokens)}</td>
              <td className="px-3 py-2 tabular-nums">{formatCost(s.cost_usd)}</td>
              <td className="px-3 py-2 tabular-nums">{formatDuration(s.duration_ms)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatDate(s.last_message_at)}
              </td>
              <td className="px-3 py-2">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                Nenhuma sessao encontrada
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Steps Table ---

function StepsTable({
  steps,
  projectId,
}: {
  steps: StepMetrics[];
  projectId: string;
}) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<keyof StepMetrics>("step");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: keyof StepMetrics) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...steps].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const columns: Array<{ key: keyof StepMetrics; label: string }> = [
    { key: "wave", label: "Wave" },
    { key: "step", label: "Step" },
    { key: "name", label: "Nome" },
    { key: "agent", label: "Agente" },
    { key: "duration_ms", label: "Duracao" },
    { key: "tokens", label: "Tokens" },
    { key: "exit_code", label: "Exit" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {columns.map((col) => (
              <SortHeader
                key={col.key}
                label={col.label}
                active={sortKey === col.key}
                dir={sortDir}
                onClick={() => toggleSort(col.key)}
              />
            ))}
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={`w${s.wave}-s${s.step}`}
              className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() =>
                navigate({
                  to: "/harness/$projectId",
                  params: { projectId },
                })
              }
            >
              <td className="px-3 py-2 tabular-nums">{s.wave}</td>
              <td className="px-3 py-2 tabular-nums">{s.step}</td>
              <td className="px-3 py-2 font-medium truncate max-w-[180px]">
                {s.name}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{s.agent}</td>
              <td className="px-3 py-2 tabular-nums">{formatDuration(s.duration_ms)}</td>
              <td className="px-3 py-2 tabular-nums">{formatTokens(s.tokens)}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    s.exit_code === 0
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : s.exit_code === null
                        ? "bg-gray-500/10 text-gray-500"
                        : "bg-red-500/10 text-red-700 dark:text-red-400"
                  )}
                >
                  {s.exit_code ?? "-"}
                </span>
              </td>
              <td className="px-3 py-2">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                Nenhum step encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Main Page ---

export function ProjectMetricsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/metrics",
  });

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
          <SessionsTable sessions={sessions} projectId={projectId} />
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
        {steps && <StepsTable steps={steps} projectId={projectId} />}
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
    </div>
  );
}
