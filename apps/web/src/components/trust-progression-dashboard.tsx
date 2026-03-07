import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import { useTrustProgression } from "@/hooks/use-trust-progression";
import { useDelegationEvents } from "@/hooks/use-delegation-events";
import type { AutonomyLevel } from "@/hooks/use-phase-autonomy";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
] as const;

const PHASE_SHORT: Record<string, string> = {
  brainstorming: "Brain",
  specs: "Specs",
  prps: "PRPs",
  implementation: "Impl",
  review: "Review",
  merge: "Merge",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  auto_executed: "Auto",
  review_requested: "Review",
  approval_granted: "Aprovado",
  approval_denied: "Negado",
  escalated: "Escalado",
  sign_off_completed: "Sign-off",
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  auto_executed:
    "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
  review_requested:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
  approval_granted:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  approval_denied:
    "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  escalated:
    "bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20",
  sign_off_completed:
    "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
};

const AUTONOMY_BADGE: Record<
  AutonomyLevel,
  { label: string; className: string }
> = {
  full_auto: {
    label: "Auto",
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  },
  auto_with_review: {
    label: "Review",
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  approval_required: {
    label: "Approval",
    className:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  },
  manual_only: {
    label: "Manual",
    className:
      "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function trustScoreColor(score: number): string {
  if (score >= 75) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ----------------------------------------------------------------
// PhaseAutonomyBadge
// ----------------------------------------------------------------

export interface PhaseAutonomyBadgeProps {
  autonomyLevel: AutonomyLevel;
  confidenceThreshold?: number;
  onConfigClick?: () => void;
}

export function PhaseAutonomyBadge({
  autonomyLevel,
  confidenceThreshold,
  onConfigClick,
}: PhaseAutonomyBadgeProps) {
  const badge = AUTONOMY_BADGE[autonomyLevel];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onConfigClick}
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold",
            onConfigClick ? "cursor-pointer" : "cursor-default",
            badge.className
          )}
        >
          {badge.label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{badge.label}</span>
          {confidenceThreshold !== undefined && (
            <span>Threshold: {Math.round(confidenceThreshold * 100)}%</span>
          )}
          {onConfigClick && (
            <span className="text-muted-foreground">Clique para configurar</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ----------------------------------------------------------------
// TrustProgressionDashboard
// ----------------------------------------------------------------

export function TrustProgressionDashboard({ projectId }: { projectId: string }) {
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);

  const { data: trust, isLoading: trustLoading } = useTrustProgression(
    projectId,
    periodDays
  );
  const { data: eventsData, isLoading: eventsLoading } = useDelegationEvents(
    projectId,
    { limit: 20 }
  );

  const events = eventsData?.events ?? [];

  // KPI counts from raw events list
  const autoCount = events.filter((e) => e.event_type === "auto_executed").length;
  const escalatedCount = events.filter((e) => e.event_type === "escalated").length;
  const approvalDeniedCount = events.filter(
    (e) => e.event_type === "approval_denied"
  ).length;

  // Grouped bar chart data
  const barData = (trust?.phase_delegation_rates ?? []).map((p) => ({
    phase: PHASE_SHORT[p.phase] ?? p.phase,
    Delegado: Math.round(p.delegation_rate * 100),
    Manual: Math.round((1 - p.delegation_rate) * 100),
  }));

  // Line chart: previous + current
  const lineData: { periodo: string; score: number }[] = trust
    ? [
        ...(trust.previous_score !== null
          ? [{ periodo: "Anterior", score: Math.round(trust.previous_score) }]
          : []),
        { periodo: `Atual (${periodDays}d)`, score: Math.round(trust.trust_score) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header: trust score badge + trend + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {trustLoading ? (
            <Skeleton className="h-16 w-24 rounded-xl" />
          ) : trust ? (
            <div className="flex flex-col items-center rounded-xl border bg-card px-5 py-3 shadow-sm">
              <span
                className={cn(
                  "text-4xl font-extrabold tabular-nums",
                  trustScoreColor(trust.trust_score)
                )}
              >
                {Math.round(trust.trust_score)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Trust Score
              </span>
            </div>
          ) : null}

          {trust && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                {trust.trend === "rising" && (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                )}
                {trust.trend === "declining" && (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                {trust.trend === "stable" && (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-sm font-semibold",
                    trust.trend === "rising"
                      ? "text-green-600 dark:text-green-400"
                      : trust.trend === "declining"
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                  )}
                >
                  {trust.trend === "rising"
                    ? "Em alta"
                    : trust.trend === "declining"
                      ? "Em queda"
                      : "Estavel"}
                </span>
              </div>
              {trust.previous_score !== null && (
                <span className="text-xs text-muted-foreground">
                  Score anterior: {Math.round(trust.previous_score)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {trust.total_events} eventos no periodo
              </span>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div className="flex gap-1 rounded-lg border p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriodDays(opt.value as 7 | 30 | 90)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                periodDays === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI Cards */}
      {trustLoading ? (
        <KpiCardGrid>
          {[1, 2, 3, 4].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
      ) : trust ? (
        <KpiCardGrid>
          <KpiCard
            icon={Zap}
            iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
            label="Delegacao Automatica"
            value={pct(trust.delegation_rate)}
            subtitle={`${autoCount} execucoes auto`}
          />
          <KpiCard
            icon={AlertTriangle}
            iconClassName="bg-orange-500/10 text-orange-600 dark:text-orange-400"
            label="Escalacoes"
            value={String(escalatedCount)}
            subtitle={`${pct(trust.escalation_rate)} do total`}
          />
          <KpiCard
            icon={CheckCircle}
            iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            label="Sucesso Auto"
            value={pct(trust.success_rate_auto)}
            subtitle="sem defeitos ou escalacao"
          />
          <KpiCard
            icon={XCircle}
            iconClassName="bg-red-500/10 text-red-600 dark:text-red-400"
            label="Aprovacoes Negadas"
            value={String(approvalDeniedCount)}
            subtitle={
              events.length > 0
                ? `${pct(approvalDeniedCount / events.length)} do total`
                : undefined
            }
          />
        </KpiCardGrid>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Grouped bar: Delegacao por Fase */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Delegacao por Fase
          </h3>
          {trustLoading ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : barData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sem dados de fase disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={barData}
                margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(v) => [`${v}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Delegado" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Manual" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Line chart: Trust Score ao Longo do Tempo */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Trust Score ao Longo do Tempo
          </h3>
          {trustLoading ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : lineData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sem dados historicos
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={lineData}
                margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 5, fill: "#3b82f6" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Timeline: last 20 events */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Ultimos eventos de delegacao
          </h3>
        </div>
        {eventsLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Nenhum evento registrado
          </div>
        ) : (
          <div className="divide-y">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      EVENT_TYPE_BADGE[event.event_type] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {PHASE_SHORT[event.phase] ?? event.phase}
                    {event.details ? ` — ${event.details}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(event.agent_confidence * 100)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatEventDate(event.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
