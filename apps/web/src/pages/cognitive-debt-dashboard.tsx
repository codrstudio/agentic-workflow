import { useParams } from "@tanstack/react-router";
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useCognitiveDebtGates,
  useCognitiveDebtIndicators,
  type ComprehensionGate,
} from "@/hooks/use-cognitive-debt";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import { cn } from "@/lib/utils";

// ---- Helpers ----

function gapColor(ratio: number): string {
  if (ratio > 5) return "text-red-600 dark:text-red-400";
  if (ratio > 3) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function gapBadge(ratio: number): string {
  if (ratio > 5)
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  if (ratio > 3)
    return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
}

function riskBadge(risk: string): string {
  if (risk === "high")
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  if (risk === "medium")
    return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `W${week.toString().padStart(2, "0")}`;
}

// ---- Weekly trend from gates ----

function computeWeeklyTrend(
  gates: ComprehensionGate[],
): { week: string; avg_load: number }[] {
  const byWeek: Record<string, { sum: number; count: number }> = {};
  for (const g of gates) {
    if (g.cognitive_load_score === null) continue;
    const week = isoWeek(g.created_at);
    if (!byWeek[week]) byWeek[week] = { sum: 0, count: 0 };
    byWeek[week].sum += g.cognitive_load_score;
    byWeek[week].count += 1;
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { sum, count }]) => ({
      week,
      avg_load: Math.round((sum / count) * 10) / 10,
    }));
}

// ---- Risk by Phase heatmap data ----

interface PhaseRisk {
  phase: string;
  low: number;
  medium: number;
  high: number;
  total: number;
}

function computePhaseRisk(gates: ComprehensionGate[]): PhaseRisk[] {
  const byPhase: Record<string, PhaseRisk> = {};
  for (const g of gates) {
    if (!byPhase[g.phase]) {
      byPhase[g.phase] = { phase: g.phase, low: 0, medium: 0, high: 0, total: 0 };
    }
    byPhase[g.phase]![g.auto_detected_risk]++;
    byPhase[g.phase]!.total++;
  }
  return Object.values(byPhase).sort((a, b) => b.total - a.total);
}

// ---- Gate list row ----

function GateRow({ gate }: { gate: ComprehensionGate }) {
  const date = new Date(gate.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const status = gate.completed
    ? "Completado"
    : gate.bypassed
      ? "Bypass"
      : "Pendente";
  const statusClass = gate.completed
    ? "text-green-600 dark:text-green-400"
    : gate.bypassed
      ? "text-orange-600 dark:text-orange-400"
      : "text-muted-foreground";

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">{date}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs font-medium">{gate.phase}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              riskBadge(gate.auto_detected_risk),
            )}
          >
            {gate.auto_detected_risk}
          </span>
        </div>
        {gate.response && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {gate.response}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("text-xs font-medium", statusClass)}>{status}</span>
        {gate.cognitive_load_score !== null && (
          <span className="text-xs text-muted-foreground">
            Load: {gate.cognitive_load_score}/5
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Risk by Phase Heatmap ----

function PhaseHeatmap({ data }: { data: PhaseRisk[] }) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 pr-3 text-left font-medium">Fase</th>
              <th className="px-2 py-1 text-center font-medium">Low</th>
              <th className="px-2 py-1 text-center font-medium">Medium</th>
              <th className="px-2 py-1 text-center font-medium">High</th>
              <th className="px-2 py-1 text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.phase} className="border-t">
                <td className="py-2 pr-3 font-medium">{row.phase}</td>
                <td className="px-2 py-2 text-center">
                  {row.low > 0 ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-green-500/10 px-2 py-0.5 font-semibold text-green-700 dark:text-green-400">
                      {row.low}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {row.medium > 0 ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-yellow-500/10 px-2 py-0.5 font-semibold text-yellow-700 dark:text-yellow-400">
                      {row.medium}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {row.high > 0 ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-700 dark:text-red-400">
                      {row.high}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center font-semibold">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Main Page ----

export function CognitiveDebtDashboardPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/metrics/cognitive-debt",
  });

  const { data: indicators, isLoading: indicatorsLoading } =
    useCognitiveDebtIndicators(projectId);

  const { data: gates, isLoading: gatesLoading } =
    useCognitiveDebtGates(projectId);

  const isLoading = indicatorsLoading || gatesLoading;

  const weeklyTrend = gates ? computeWeeklyTrend(gates) : [];
  const phaseRisk = gates ? computePhaseRisk(gates) : [];
  const last10Gates = gates
    ? [...gates]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 10)
    : [];

  const comprehensionRate = indicators
    ? indicators.total_gates > 0
      ? Math.round((indicators.completed_gates / indicators.total_gates) * 100)
      : 0
    : 0;

  const avgLoad = indicators?.avg_cognitive_load ?? null;
  const gap = indicators?.comprehension_gap_ratio ?? 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-violet-500/10 p-2 text-violet-600 dark:text-violet-400">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Cognitive Debt Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprehension gates, cognitive load e gap de geracao/revisao
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading && (
        <KpiCardGrid>
          {[1, 2, 3].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Comprehension Rate */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-green-500/10 p-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Comprehension Rate
                </p>
                <p className="text-2xl font-bold text-card-foreground">
                  {comprehensionRate}%
                </p>
                {indicators && (
                  <p className="text-xs text-muted-foreground">
                    {indicators.completed_gates}/{indicators.total_gates} gates ·{" "}
                    {indicators.bypassed_gates} bypass
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Cognitive Load Medio */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Cognitive Load Medio
                </p>
                <p className="text-2xl font-bold text-card-foreground">
                  {avgLoad !== null ? avgLoad.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  escala 1–5 (1=tranquilo, 5=perdido)
                </p>
              </div>
            </div>
          </div>

          {/* Comprehension Gap */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-orange-500/10 p-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Comprehension Gap
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    gapColor(gap),
                  )}
                >
                  {gap.toFixed(1)}x
                </p>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    gapBadge(gap),
                  )}
                >
                  {gap > 5 ? "alto" : gap > 3 ? "moderado" : "saudavel"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cognitive Load Trend chart */}
      {weeklyTrend.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Cognitive Load Trend
            </h2>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="week" fontSize={12} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={12} />
                <Tooltip
                  formatter={(value: unknown) => [
                    `${Number(value).toFixed(1)}`,
                    "Load Medio",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="avg_load"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#8b5cf6" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Risk by Phase heatmap */}
      {phaseRisk.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Risk by Phase
          </h2>
          <PhaseHeatmap data={phaseRisk} />
        </div>
      )}

      {/* Last 10 gates */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Ultimos Gates
        </h2>
        {gatesLoading && (
          <div className="h-32 animate-pulse rounded-lg border bg-muted" />
        )}
        {!gatesLoading && last10Gates.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Brain className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum gate encontrado.</p>
            <p className="text-xs">
              Gates aparecerao quando fases forem completadas com comprehension checks.
            </p>
          </div>
        )}
        {last10Gates.length > 0 && (
          <div className="flex flex-col gap-2">
            {last10Gates.map((g) => (
              <GateRow key={g.id} gate={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
