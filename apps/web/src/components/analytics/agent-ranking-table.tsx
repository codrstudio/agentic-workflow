import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ExternalLink, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  analyticsAgentsQueryOptions,
  type AgentRankingEntry,
} from "@/api/analytics";

type SortKey = keyof Pick<
  AgentRankingEntry,
  "agentId" | "heartbeats" | "errorRate" | "conversations" | "avgResponseMs" | "costUsd"
>;

type SortDir = "asc" | "desc";

function errorRateBadge(rate: number) {
  if (rate <= 0.05) return <Badge variant="secondary">{(rate * 100).toFixed(1)}%</Badge>;
  if (rate <= 0.15) return <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">{(rate * 100).toFixed(1)}%</Badge>;
  return <Badge variant="destructive">{(rate * 100).toFixed(1)}%</Badge>;
}

function formatMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

interface AgentRankingTableProps {
  from: string;
  to: string;
}

export function AgentRankingTable({ from, to }: AgentRankingTableProps) {
  const { data, isLoading } = useQuery(analyticsAgentsQueryOptions({ from, to }));

  const [sortKey, setSortKey] = useState<SortKey>("costUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = data?.agents
    ? [...data.agents].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "string" && typeof bv === "string") {
          return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        const diff = (av as number) - (bv as number);
        return sortDir === "asc" ? diff : -diff;
      })
    : [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Nenhum dado de agentes"
        description="Nao ha dados de agentes para o periodo selecionado."
      />
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "agentId", label: "Agente" },
    { key: "heartbeats", label: "Heartbeats" },
    { key: "errorRate", label: "Taxa de Erro" },
    { key: "conversations", label: "Conversas" },
    { key: "avgResponseMs", label: "Resp. Media" },
    { key: "costUsd", label: "Custo" },
  ];

  function SortButton({ col }: { col: { key: SortKey; label: string } }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 font-medium"
        onClick={() => toggleSort(col.key)}
      >
        {col.label}
        <ArrowUpDown className="ml-1 size-3.5" />
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Ranking de Agentes</h3>

      {/* Desktop: Table */}
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  <SortButton col={col} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((agent) => (
              <TableRow key={agent.agentId}>
                <TableCell className="font-medium">
                  <code className="text-sm">{agent.agentId}</code>
                </TableCell>
                <TableCell>{agent.heartbeats.toLocaleString()}</TableCell>
                <TableCell>{errorRateBadge(agent.errorRate)}</TableCell>
                <TableCell>{agent.conversations.toLocaleString()}</TableCell>
                <TableCell>{formatMs(agent.avgResponseMs)}</TableCell>
                <TableCell>
                  <Link
                    to="/costs"
                    search={{ agent: agent.agentId }}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    ${agent.costUsd.toFixed(2)}
                    <ExternalLink className="size-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {sorted.map((agent) => (
          <div key={agent.agentId} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <code className="text-sm font-medium">{agent.agentId}</code>
              {errorRateBadge(agent.errorRate)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Heartbeats:</span>{" "}
                <span className="font-medium">{agent.heartbeats.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Conversas:</span>{" "}
                <span className="font-medium">{agent.conversations.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resp. Media:</span>{" "}
                <span className="font-medium">{formatMs(agent.avgResponseMs)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Custo:</span>{" "}
                <Link
                  to="/costs"
                  search={{ agent: agent.agentId }}
                  className="font-medium text-primary hover:underline"
                >
                  ${agent.costUsd.toFixed(2)}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
