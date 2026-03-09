import { useState } from "react";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Formatting helpers ---

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Types ---

export type ColumnFormat = "text" | "number" | "tokens" | "cost" | "duration" | "date";

type SortDir = "asc" | "desc";

export interface MetricsColumn<T> {
  key: keyof T & string;
  label: string;
  format?: ColumnFormat;
  className?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface MetricsTableProps<T> {
  data: T[];
  columns: MetricsColumn<T>[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  defaultSortKey?: keyof T & string;
  defaultSortDir?: SortDir;
  emptyMessage?: string;
}

// --- SortHeader ---

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
          <span className="text-[10px]">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );
}

// --- Cell formatter ---

function formatCell(value: unknown, format?: ColumnFormat): React.ReactNode {
  if (value === null || value === undefined) return "-";
  switch (format) {
    case "tokens":
      return formatTokens(value as number);
    case "cost":
      return formatCost(value as number);
    case "duration":
      return formatDuration(value as number | null);
    case "date":
      return formatDate(value as string | null);
    case "number":
      return (value as number).toLocaleString();
    default:
      return String(value);
  }
}

function cellClassName(format?: ColumnFormat): string {
  switch (format) {
    case "tokens":
    case "cost":
    case "duration":
    case "number":
      return "tabular-nums";
    case "date":
      return "text-muted-foreground";
    default:
      return "";
  }
}

// --- MetricsTable ---

export function MetricsTable<T extends object>({
  data,
  columns,
  keyFn,
  onRowClick,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyMessage = "Nenhum registro encontrado",
}: MetricsTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>(
    defaultSortKey ?? columns[0]?.key ?? ""
  );
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const colSpan = columns.length + (onRowClick ? 1 : 0);

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
            {onRowClick && (
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8" />
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={keyFn(row)}
              className={cn(
                "border-b last:border-b-0 transition-colors",
                onRowClick &&
                  "hover:bg-muted/50 cursor-pointer"
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => {
                const value = (row as Record<string, unknown>)[col.key];
                return (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2",
                      cellClassName(col.format),
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(value as T[keyof T], row)
                      : formatCell(value, col.format)}
                  </td>
                );
              })}
              {onRowClick && (
                <td className="px-3 py-2">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </td>
              )}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={colSpan}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
