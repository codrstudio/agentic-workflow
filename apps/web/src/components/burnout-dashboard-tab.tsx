import { useState } from "react";
import {
  Clock,
  MessageSquare,
  Scale,
  ArrowLeftRight,
  AlertTriangle,
  Heart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import {
  useBurnoutIndicators,
  useActivitySummary,
  type RiskLevel,
  type RiskFactor,
} from "@/hooks/use-burnout-indicators";
import { cn } from "@/lib/utils";

const PHASE_COLORS: Record<string, string> = {
  brainstorming: "#a855f7",
  specs: "#3b82f6",
  prps: "#f59e0b",
  implementation: "#22c55e",
  review: "#14b8a6",
};

const PHASE_LABELS: Record<string, string> = {
  brainstorming: "Brainstorming",
  specs: "Specs",
  prps: "PRPs",
  implementation: "Implementacao",
  review: "Review",
};

const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
] as const;

const RISK_BADGE_CLASS: Record<RiskLevel, string> = {
  low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  moderate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
  critical: "Critico",
};

const ACTION_SUGGESTIONS: Record<string, string> = {
  long_session: "Considere dividir sessoes longas em blocos de 90 minutos com pausas.",
  intense_day: "Distribua o trabalho ao longo da semana para evitar dias exaustivos.",
  long_streak: "Planeje pelo menos 1 dia de descanso a cada 5 dias de trabalho.",
  late_sessions: "Evite sessoes apos o horario limite para preservar o sono.",
  weekend_sessions: "Reserve fins de semana para descanso e recuperacao.",
  context_switching: "Agrupe tarefas similares para reduzir trocas de contexto.",
  verification_tax: "Automatize verificacoes repetitivas para reduzir a carga de review.",
};

interface BurnoutDashboardTabProps {
  projectId: string;
}

export function BurnoutDashboardTab({ projectId }: BurnoutDashboardTabProps) {
  const [periodDays, setPeriodDays] = useState(7);

  const { data: indicators, isLoading: indicatorsLoading } =
    useBurnoutIndicators(projectId, periodDays);
  const { data: activityData, isLoading: activityLoading } =
    useActivitySummary(projectId, periodDays);

  const isLoading = indicatorsLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <KpiCardGrid>
          {[1, 2, 3, 4].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
        <div className="h-48 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!indicators) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <Heart className="h-10 w-10 opacity-40" />
        <p className="text-sm">Sem dados de bem-estar ainda.</p>
        <p className="text-xs">
          Dados aparecerão apos sessoes de atividade serem registradas.
        </p>
      </div>
    );
  }

  // Format minutes as hours+minutes
  const formatMinutes = (m: number) => {
    if (m < 60) return `${Math.round(m)}min`;
    const h = Math.floor(m / 60);
    const mins = Math.round(m % 60);
    return mins > 0 ? `${h}h ${mins}min` : `${h}h`;
  };

  // Prepare chart data
  const phases = new Set<string>();
  if (activityData) {
    for (const day of activityData.days) {
      for (const key of Object.keys(day)) {
        if (key !== "date") phases.add(key);
      }
    }
  }
  const phaseKeys = [...phases].sort();

  const chartData =
    activityData?.days.map((day) => {
      const row: Record<string, string | number> = {
        name: String(day.date).slice(5), // MM-DD
      };
      for (const phase of phaseKeys) {
        row[phase] = Number(day[phase] ?? 0);
      }
      return row;
    }) ?? [];

  const triggeredFactors = indicators.risk_factors.filter((f) => f.triggered);
  const untriggeredFactors = indicators.risk_factors.filter((f) => !f.triggered);

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Bem-estar</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
              RISK_BADGE_CLASS[indicators.risk_level]
            )}
          >
            Risco {RISK_LABEL[indicators.risk_level]}
          </span>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriodDays(opt.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                periodDays === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCardGrid>
        <KpiCard
          icon={Clock}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label="Tempo Ativo"
          value={formatMinutes(indicators.total_active_minutes_period)}
          subtitle={`~${formatMinutes(indicators.avg_session_duration_minutes)} por sessao`}
        />
        <KpiCard
          icon={MessageSquare}
          iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          label="Sessoes"
          value={indicators.sessions_count_period.toString()}
          subtitle={`~${Math.round(indicators.avg_messages_per_session)} msgs/sessao`}
        />
        <KpiCard
          icon={Scale}
          iconClassName="bg-teal-500/10 text-teal-600 dark:text-teal-400"
          label="Verificacao vs Geracao"
          value={`${indicators.review_to_generation_ratio.toFixed(2)}x`}
          subtitle={`${formatMinutes(indicators.verification_minutes_period)} em review`}
        />
        <KpiCard
          icon={ArrowLeftRight}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          label="Trocas de Contexto"
          value={indicators.avg_context_switches_per_session.toFixed(1)}
          subtitle="media por sessao"
        />
      </KpiCardGrid>

      {/* Daily Activity Bar Chart */}
      {chartData.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-foreground">
            Atividade Diaria
          </h3>
          <div className="rounded-lg border bg-card p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(v: number) =>
                    v < 60 ? `${v}m` : `${Math.round(v / 60)}h`
                  }
                  label={{
                    value: "Minutos",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Math.round(Number(value))} min`,
                    PHASE_LABELS[String(name)] ?? String(name),
                  ]}
                />
                <Legend
                  formatter={(value: string) => PHASE_LABELS[value] ?? value}
                />
                {phaseKeys.map((phase) => (
                  <Bar
                    key={phase}
                    dataKey={phase}
                    stackId="activity"
                    fill={PHASE_COLORS[phase] ?? "#9ca3af"}
                    name={phase}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Risk Factors */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          Fatores de Risco
        </h3>

        {triggeredFactors.length > 0 && (
          <div className="space-y-2">
            {triggeredFactors.map((factor) => (
              <RiskFactorCard key={factor.factor} factor={factor} triggered />
            ))}
          </div>
        )}

        {untriggeredFactors.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Dentro dos limites
            </p>
            {untriggeredFactors.map((factor) => (
              <RiskFactorCard
                key={factor.factor}
                factor={factor}
                triggered={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RiskFactorCard({
  factor,
  triggered,
}: {
  factor: RiskFactor;
  triggered: boolean;
}) {
  const pct = factor.threshold > 0
    ? Math.min(100, Math.round((factor.current_value / factor.threshold) * 100))
    : 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        triggered
          ? "border-orange-500/30 bg-orange-500/5"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {triggered && (
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            )}
            <span className="text-sm font-medium">{factor.description}</span>
          </div>
          {triggered && ACTION_SUGGESTIONS[factor.factor] && (
            <p className="mt-1 text-xs text-muted-foreground">
              {ACTION_SUGGESTIONS[factor.factor]}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              triggered
                ? "text-orange-600 dark:text-orange-400"
                : "text-muted-foreground"
            )}
          >
            {factor.current_value}
          </span>
          <span className="text-xs text-muted-foreground">
            /{factor.threshold}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            triggered ? "bg-orange-500" : "bg-green-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
