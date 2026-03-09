import { useState } from "react";
import {
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Users,
  Shield,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  type IPAttributionReport,
  type FeatureAttribution,
} from "@/hooks/use-compliance";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const ORIGIN_COLORS = {
  ai_generated: "#ef4444",
  ai_assisted: "#3b82f6",
  human_written: "#22c55e",
  mixed: "#a855f7",
} as const;

const ORIGIN_LABELS = {
  ai_generated: "AI Gerado",
  ai_assisted: "AI Assistido",
  human_written: "Humano",
  mixed: "Misto",
} as const;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function getProtectableColor(ratio: number): string {
  if (ratio >= 0.8)
    return "text-green-600 dark:text-green-400";
  if (ratio >= 0.5)
    return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getProtectableBgColor(ratio: number): string {
  if (ratio >= 0.8)
    return "bg-green-500/10 border-green-500/20";
  if (ratio >= 0.5)
    return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
}

// ----------------------------------------------------------------
// Origin Badge
// ----------------------------------------------------------------

function OriginBadge({
  origin,
}: {
  origin: FeatureAttribution["origin"];
}) {
  const colors: Record<FeatureAttribution["origin"], string> = {
    ai_generated:
      "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
    ai_assisted:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    human_written:
      "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
    mixed:
      "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[origin]
      )}
    >
      {ORIGIN_LABELS[origin]}
    </span>
  );
}

// ----------------------------------------------------------------
// Pie Chart
// ----------------------------------------------------------------

function OriginPieChart({ report }: { report: IPAttributionReport }) {
  const data = [
    {
      name: ORIGIN_LABELS.ai_generated,
      value: report.ai_generated_count,
      color: ORIGIN_COLORS.ai_generated,
    },
    {
      name: ORIGIN_LABELS.ai_assisted,
      value: report.ai_assisted_count,
      color: ORIGIN_COLORS.ai_assisted,
    },
    {
      name: ORIGIN_LABELS.human_written,
      value: report.human_written_count,
      color: ORIGIN_COLORS.human_written,
    },
    {
      name: ORIGIN_LABELS.mixed,
      value: report.mixed_count,
      color: ORIGIN_COLORS.mixed,
    },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Nenhum artefato no período
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <RechartsTooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// Feature Table
// ----------------------------------------------------------------

type SortKey = "feature_id" | "origin" | "human_oversight_count";
type SortDir = "asc" | "desc";

function FeatureAttributionTable({
  attributions,
}: {
  attributions: FeatureAttribution[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("human_oversight_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...attributions].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "feature_id") {
      cmp = a.feature_id.localeCompare(b.feature_id);
    } else if (sortKey === "origin") {
      cmp = a.origin.localeCompare(b.origin);
    } else {
      cmp = a.human_oversight_count - b.human_oversight_count;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (sorted.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Nenhuma feature no período
      </p>
    );
  }

  function SortHeader({
    label,
    k,
  }: {
    label: string;
    k: SortKey;
  }) {
    return (
      <th
        className="cursor-pointer px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
        onClick={() => handleSort(k)}
      >
        {label}{" "}
        {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <SortHeader label="Feature ID" k="feature_id" />
            <SortHeader label="Origin" k="origin" />
            <SortHeader label="Oversight Count" k="human_oversight_count" />
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Human Edit
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AI Models
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((attr) => (
            <tr
              key={attr.feature_id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="px-3 py-2 font-mono text-xs font-medium">
                {attr.feature_id}
              </td>
              <td className="px-3 py-2">
                <OriginBadge origin={attr.origin} />
              </td>
              <td className="px-3 py-2 text-center">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {attr.human_oversight_count}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                {attr.has_human_edit ? (
                  <CheckCircle className="mx-auto h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                )}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {attr.ai_models_used.length > 0
                  ? attr.ai_models_used.join(", ")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------

export function IPAttributionReportView({
  report,
  onClose,
}: {
  report: IPAttributionReport;
  onClose: () => void;
}) {
  function handleExportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ip-attribution-report-${report.generated_at.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const protectableColor = getProtectableColor(report.protectable_ratio);
  const protectableBg = getProtectableBgColor(report.protectable_ratio);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Compliance Dashboard
            </button>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Relatório de Atribuição de IP
          </h2>
          <p className="text-sm text-muted-foreground">
            Período: {report.period.from} a {report.period.to} · Gerado em{" "}
            {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportJson}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="h-4 w-4" />
          Exportar JSON
        </button>
      </div>

      {/* Summary Card */}
      <div className={cn("rounded-xl border p-5", protectableBg)}>
        <div className="flex flex-wrap items-start gap-6">
          {/* Protectable Ratio */}
          <div className="flex flex-col items-center">
            <span
              className={cn("text-5xl font-bold tabular-nums", protectableColor)}
            >
              {formatPct(report.protectable_ratio)}
            </span>
            <span className="mt-1 text-sm font-medium text-foreground">
              Protectable Ratio
            </span>
            <span className="text-xs text-muted-foreground">
              {report.protectable_ratio >= 0.8
                ? "Excelente — alto nível de oversight"
                : report.protectable_ratio >= 0.5
                  ? "Moderado — oversight suficiente"
                  : "Baixo — requer mais revisão humana"}
            </span>
          </div>

          {/* Breakdown */}
          <div className="flex flex-1 flex-wrap gap-4">
            <div className="flex flex-col items-center rounded-lg bg-background/60 p-3">
              <span className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {report.ai_generated_count}
              </span>
              <span className="text-xs text-muted-foreground">AI Gerado</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-background/60 p-3">
              <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {report.ai_assisted_count}
              </span>
              <span className="text-xs text-muted-foreground">AI Assistido</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-background/60 p-3">
              <span className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                {report.human_written_count}
              </span>
              <span className="text-xs text-muted-foreground">Humano</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-background/60 p-3">
              <span className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                {report.mixed_count}
              </span>
              <span className="text-xs text-muted-foreground">Misto</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Distribuição de Origem
        </h3>
        <OriginPieChart report={report} />
      </div>

      {/* Feature Attribution Table */}
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Atribuição por Feature
        </h3>
        <FeatureAttributionTable attributions={report.feature_attributions} />
      </div>

      {/* Human Oversight Evidence */}
      <div className="rounded-xl border p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Human Oversight Evidence
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {report.human_oversight_actions}
            </span>
            <span className="text-xs text-muted-foreground">
              Intervenções humanas totais
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {report.features_with_human_review}
            </span>
            <span className="text-xs text-muted-foreground">
              Features com revisão humana
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {report.features_with_human_edit}
            </span>
            <span className="text-xs text-muted-foreground">
              Features com edição humana
            </span>
          </div>
        </div>
      </div>

      {/* Recommendation Card */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">
            Recomendação
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Informativa — não constitui aconselhamento jurídico
          </span>
        </div>
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-foreground">{report.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
