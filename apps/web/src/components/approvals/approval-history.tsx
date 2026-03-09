import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { History } from "lucide-react";
import { approvalHistoryQueryOptions, type ApprovalRequest } from "@/api/approvals";

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  expired: { label: "Expirado", variant: "secondary" },
};

export function ApprovalHistory() {
  const { data, isLoading } = useQuery(approvalHistoryQueryOptions());
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");

  const rows = data ?? [];

  const uniqueAgents = Array.from(new Set(rows.map((r) => r.agent_id))).sort();

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (agentFilter !== "all" && r.agent_id !== agentFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={(v) => v && setAgentFilter(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {uniqueAgents.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="Nenhum historico"
          description="Decisoes de aprovacao aparecerao aqui."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Acao</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Agente</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Decidido por</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r: ApprovalRequest) => {
                const sc = statusConfig[r.status] ?? { label: r.status, variant: "outline" as const };
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.action_label}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.agent_id}</td>
                    <td className="px-4 py-3">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.decided_by ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.decided_at ? formatDate(r.decided_at) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
