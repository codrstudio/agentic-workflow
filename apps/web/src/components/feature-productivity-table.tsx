import { useState, useMemo } from "react";
import { CheckCircle, XCircle, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFeatureProductivityRecords,
  type FeatureProductivityRecord,
  type OriginSource,
} from "@/hooks/use-feature-productivity";
import { Skeleton } from "@/components/ui/skeleton";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const ORIGIN_BADGE: Record<OriginSource, { label: string; className: string }> = {
  ai_generated: {
    label: "AI",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  ai_assisted: {
    label: "AI+",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  human_written: {
    label: "Human",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  mixed: {
    label: "Mixed",
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  },
};

type SortKey =
  | "feature_id"
  | "origin"
  | "total_duration_hours"
  | "review_rounds"
  | "rework_count"
  | "first_pass_accepted"
  | "ai_cost_usd";

type SortDir = "asc" | "desc";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatDuration(hours?: number): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${hours.toFixed(1)}h`;
}

function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function reworkHighlight(count: number): string {
  if (count > 4) return "bg-red-50 dark:bg-red-950/20";
  if (count > 2) return "bg-yellow-50 dark:bg-yellow-950/20";
  return "";
}

function compareValues(
  a: FeatureProductivityRecord,
  b: FeatureProductivityRecord,
  key: SortKey
): number {
  switch (key) {
    case "feature_id":
      return a.feature_id.localeCompare(b.feature_id);
    case "origin":
      return a.origin.localeCompare(b.origin);
    case "total_duration_hours":
      return (a.total_duration_hours ?? 0) - (b.total_duration_hours ?? 0);
    case "review_rounds":
      return a.review_rounds - b.review_rounds;
    case "rework_count":
      return a.rework_count - b.rework_count;
    case "first_pass_accepted":
      return (a.first_pass_accepted ? 1 : 0) - (b.first_pass_accepted ? 1 : 0);
    case "ai_cost_usd":
      return a.ai_cost_usd - b.ai_cost_usd;
    default:
      return 0;
  }
}

// ----------------------------------------------------------------
// SortIcon
// ----------------------------------------------------------------

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ChevronUp className="ml-1 inline h-3 w-3" />
    : <ChevronDown className="ml-1 inline h-3 w-3" />;
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------

interface FeatureProductivityTableProps {
  projectId: string;
  periodDays: number;
}

export function FeatureProductivityTable({
  projectId,
  periodDays,
}: FeatureProductivityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rework_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOrigin, setFilterOrigin] = useState<OriginSource | "">("");
  const [filterFirstPass, setFilterFirstPass] = useState<"" | "true" | "false">("");

  const { data, isLoading, isError } = useFeatureProductivityRecords(projectId, {
    origin: filterOrigin || undefined,
    first_pass: filterFirstPass || undefined,
  });

  const fromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays]);

  const records = useMemo(() => {
    const raw = data?.records ?? [];
    // Client-side period filter
    const periodFiltered = raw.filter(
      (r) => !r.created_at || r.created_at >= fromDate
    );
    // Sort
    return [...periodFiltered].sort((a, b) => {
      const cmp = compareValues(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, fromDate, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function thProps(key: SortKey) {
    return {
      role: "button" as const,
      tabIndex: 0,
      onClick: () => toggleSort(key),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") toggleSort(key);
      },
      className:
        "cursor-pointer select-none whitespace-nowrap pb-2 pr-4 text-left text-xs font-medium text-muted-foreground hover:text-foreground",
    };
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-card-foreground">
          Features por Produtividade
          {records.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({records.length})
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Origin filter */}
          <select
            value={filterOrigin}
            onChange={(e) => setFilterOrigin(e.target.value as OriginSource | "")}
            className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filtrar por origin"
          >
            <option value="">Todas as origens</option>
            <option value="ai_generated">AI Gerado</option>
            <option value="ai_assisted">AI Assistido</option>
            <option value="human_written">Humano</option>
            <option value="mixed">Mixed</option>
          </select>

          {/* First-pass filter */}
          <select
            value={filterFirstPass}
            onChange={(e) => setFilterFirstPass(e.target.value as "" | "true" | "false")}
            className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filtrar por first-pass"
          >
            <option value="">First-pass: todos</option>
            <option value="true">First-pass: sim</option>
            <option value="false">First-pass: nao</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        )}

        {isError && (
          <div className="p-4 text-xs text-destructive">
            Falha ao carregar registros de produtividade.
          </div>
        )}

        {!isLoading && !isError && records.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        )}

        {!isLoading && !isError && records.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th {...thProps("feature_id")}>
                  Feature ID
                  <SortIcon col="feature_id" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th {...thProps("origin")}>
                  Origem
                  <SortIcon col="origin" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th {...thProps("total_duration_hours")}>
                  Duracao
                  <SortIcon col="total_duration_hours" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th {...thProps("review_rounds")}>
                  Revisoes
                  <SortIcon col="review_rounds" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th {...thProps("rework_count")}>
                  Rework
                  <SortIcon col="rework_count" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th {...thProps("first_pass_accepted")}>
                  First-Pass
                  <SortIcon col="first_pass_accepted" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th {...thProps("ai_cost_usd")}>
                  Custo AI
                  <SortIcon col="ai_cost_usd" sortKey={sortKey} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const badge = ORIGIN_BADGE[rec.origin] ?? ORIGIN_BADGE.mixed;
                const rowHighlight = reworkHighlight(rec.rework_count);
                return (
                  <tr
                    key={rec.feature_id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/40",
                      rowHighlight
                    )}
                  >
                    {/* Feature ID */}
                    <td className="py-2 pr-4 font-mono text-xs font-medium">
                      {rec.feature_id}
                    </td>

                    {/* Origin badge */}
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {formatDuration(rec.total_duration_hours)}
                    </td>

                    {/* Review Rounds */}
                    <td className="py-2 pr-4 text-xs">
                      {rec.review_rounds}
                    </td>

                    {/* Rework Count */}
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                          rec.rework_count > 4
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : rec.rework_count > 2
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "text-muted-foreground"
                        )}
                      >
                        {rec.rework_count}
                      </span>
                    </td>

                    {/* First-Pass */}
                    <td className="py-2 pr-4">
                      {rec.first_pass_accepted ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" aria-label="Sim" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" aria-label="Nao" />
                      )}
                    </td>

                    {/* AI Cost */}
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {formatUsd(rec.ai_cost_usd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
