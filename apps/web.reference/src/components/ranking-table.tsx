import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RankingDiscovery {
  id: string;
  type: "pain" | "gain";
  description: string;
  score: number;
  discovered_at: number;
  last_reclassified_at: number;
  implemented_at: number | null;
  implementation_status: string;
}

interface RankingTableProps {
  discoveries: RankingDiscovery[];
}

type SortDirection = "asc" | "desc";

const statusColors: Record<string, string> = {
  nao: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  parcial:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  sim: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const barColor =
    score > 7
      ? "bg-green-500"
      : score >= 5
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums">{score}</span>
    </div>
  );
}

export function RankingTable({ discoveries }: RankingTableProps) {
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [typeFilter, setTypeFilter] = useState<"all" | "pain" | "gain">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statuses = useMemo(() => {
    const s = new Set(discoveries.map((d) => d.implementation_status));
    return Array.from(s).sort();
  }, [discoveries]);

  const filtered = useMemo(() => {
    let items = [...discoveries];
    if (typeFilter !== "all") {
      items = items.filter((d) => d.type === typeFilter);
    }
    if (statusFilter !== "all") {
      items = items.filter((d) => d.implementation_status === statusFilter);
    }
    items.sort((a, b) =>
      sortDir === "desc" ? b.score - a.score : a.score - b.score
    );
    return items;
  }, [discoveries, typeFilter, statusFilter, sortDir]);

  const toggleSort = () =>
    setSortDir((d) => (d === "desc" ? "asc" : "desc"));

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Tipo:</span>
          {(["all", "pain", "gain"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {t === "all" ? "Todos" : t === "pain" ? "Pain" : "Gain"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Status:</span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            Todos
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length}/{discoveries.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="w-8 pb-2 pr-2" />
              <th className="pb-2 pr-4 font-medium">ID</th>
              <th className="pb-2 pr-4 font-medium">Tipo</th>
              <th className="pb-2 pr-4 font-medium max-sm:hidden">
                Descricao
              </th>
              <th className="pb-2 pr-4 font-medium">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Score
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const isExpanded = expandedId === d.id;
              return (
                <DiscoveryRow
                  key={d.id}
                  discovery={d}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedId(isExpanded ? null : d.id)
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhuma discovery encontrada com os filtros selecionados.
        </p>
      )}
    </div>
  );
}

function DiscoveryRow({
  discovery,
  isExpanded,
  onToggle,
}: {
  discovery: RankingDiscovery;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const d = discovery;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;
  const typeBadgeClass =
    d.type === "pain"
      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";

  // Truncated description for table cell
  const shortDesc =
    d.description.length > 80
      ? d.description.slice(0, 80) + "..."
      : d.description;

  return (
    <>
      <tr
        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50"
        onClick={onToggle}
      >
        <td className="py-2 pr-2">
          <Chevron className="h-4 w-4 text-muted-foreground" />
        </td>
        <td className="py-2 pr-4 font-mono text-xs">{d.id}</td>
        <td className="py-2 pr-4">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              typeBadgeClass
            )}
          >
            {d.type}
          </span>
        </td>
        <td className="py-2 pr-4 max-sm:hidden">
          <span className="text-sm">{shortDesc}</span>
        </td>
        <td className="py-2 pr-4">
          <ScoreBar score={d.score} />
        </td>
        <td className="py-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              statusColors[d.implementation_status] ?? statusColors["nao"]
            )}
          >
            {d.implementation_status}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b last:border-0">
          <td colSpan={6} className="px-8 py-3">
            <div className="space-y-2 text-sm">
              <p className="text-foreground">{d.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Discovered: Sprint {d.discovered_at}</span>
                <span>Reclassified: Sprint {d.last_reclassified_at}</span>
                {d.implemented_at && (
                  <span>Implemented: Sprint {d.implemented_at}</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
