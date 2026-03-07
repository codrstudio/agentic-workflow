import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Layers, Clock, List } from "lucide-react";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import {
  useClassifications,
  useAllTemplates,
  type ComplexityLevel,
  type TaskComplexity,
  type SpecTemplate,
} from "@/hooks/use-task-complexity";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<ComplexityLevel, string> = {
  trivial: "#9ca3af",
  small: "#3b82f6",
  medium: "#f59e0b",
  large: "#a855f7",
};

const LEVEL_LABELS: Record<ComplexityLevel, string> = {
  trivial: "Trivial",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const METHOD_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_heuristic: "Heuristica",
  auto_ai: "AI",
};

const LEVEL_BADGE_CLASS: Record<ComplexityLevel, string> = {
  trivial: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  small: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  large: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

// Estimated hours for a full PRP (large template) — baseline for overhead calculation
const FULL_PRP_EFFORT_HOURS: Record<ComplexityLevel, number> = {
  trivial: 16,
  small: 16,
  medium: 16,
  large: 16,
};

function parseEffortHours(effort: string): number {
  // e.g. "30min", "2h", "4-8h", "16-24h"
  const rangeMatch = effort.match(/(\d+)-(\d+)\s*h/i);
  if (rangeMatch) {
    return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
  }
  const hourMatch = effort.match(/(\d+)\s*h/i);
  if (hourMatch) return Number(hourMatch[1]);
  const minMatch = effort.match(/(\d+)\s*min/i);
  if (minMatch) return Number(minMatch[1]) / 60;
  return 0;
}

function computeOverheadSaved(
  classifications: TaskComplexity[],
  templates: SpecTemplate[]
): { hours: number; count: number } {
  const templateMap = new Map(templates.map((t) => [t.level, t]));
  let totalSaved = 0;
  let count = 0;

  for (const c of classifications) {
    const template = templateMap.get(c.complexity_level);
    if (!template) continue;
    const actualEffort = parseEffortHours(template.estimated_effort);
    const fullPrpEffort = FULL_PRP_EFFORT_HOURS[c.complexity_level] ?? 16;
    if (c.complexity_level !== "large") {
      totalSaved += fullPrpEffort - actualEffort;
      count++;
    }
  }

  return { hours: Math.round(totalSaved * 10) / 10, count };
}

interface ComplexityDistributionChartProps {
  projectId: string;
}

export function ComplexityDistributionChart({
  projectId,
}: ComplexityDistributionChartProps) {
  const { data: classifications, isLoading: classLoading } =
    useClassifications(projectId, 100);
  const { data: templates, isLoading: templatesLoading } =
    useAllTemplates(projectId);

  const isLoading = classLoading || templatesLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <KpiCardGrid>
          {[1, 2, 3].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!classifications || classifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <Layers className="h-10 w-10 opacity-40" />
        <p className="text-sm">Sem dados de complexidade ainda.</p>
        <p className="text-xs">
          Classifique tarefas para ver a distribuicao aqui.
        </p>
      </div>
    );
  }

  // Compute distribution
  const distribution: Record<ComplexityLevel, number> = {
    trivial: 0,
    small: 0,
    medium: 0,
    large: 0,
  };
  for (const c of classifications) {
    distribution[c.complexity_level] =
      (distribution[c.complexity_level] ?? 0) + 1;
  }

  const pieData = (
    ["trivial", "small", "medium", "large"] as ComplexityLevel[]
  )
    .filter((level) => distribution[level] > 0)
    .map((level) => ({
      name: LEVEL_LABELS[level],
      value: distribution[level],
      level,
    }));

  // Overhead saved KPI
  const overhead = templates
    ? computeOverheadSaved(classifications, templates)
    : { hours: 0, count: 0 };

  // Recent classifications (last 10)
  const recent = classifications.slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">Spec Depth</h3>
        <span className="text-xs text-muted-foreground">
          {classifications.length} classificacoes
        </span>
      </div>

      {/* KPI Cards */}
      <KpiCardGrid>
        <KpiCard
          icon={Layers}
          iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          label="Classificacoes"
          value={classifications.length.toString()}
          subtitle={`${pieData.length} niveis usados`}
        />
        <KpiCard
          icon={Clock}
          iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
          label="Overhead Economizado"
          value={`${overhead.hours}h`}
          subtitle={`${overhead.count} tarefas com template menor`}
        />
        <KpiCard
          icon={List}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label="Nivel Mais Comum"
          value={
            pieData.length > 0
              ? pieData.reduce((a, b) => (a.value > b.value ? a : b)).name
              : "-"
          }
          subtitle={
            pieData.length > 0
              ? `${pieData.reduce((a, b) => (a.value > b.value ? a : b)).value} tarefas`
              : undefined
          }
        />
      </KpiCardGrid>

      {/* Pie Chart */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          Distribuicao por Complexidade
        </h3>
        <div className="rounded-lg border bg-card p-4">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.level}
                    fill={LEVEL_COLORS[entry.level]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value} tarefas`,
                  String(name),
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Classifications */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          Classificacoes Recentes
        </h3>
        <div className="rounded-lg border bg-card divide-y">
          {recent.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0",
                    LEVEL_BADGE_CLASS[c.complexity_level]
                  )}
                >
                  {LEVEL_LABELS[c.complexity_level]}
                </span>
                <span className="text-sm font-medium truncate">
                  {c.title}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {METHOD_LABELS[c.classification_method] ??
                    c.classification_method}
                </span>
                {c.confidence != null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(c.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
