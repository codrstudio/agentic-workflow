import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { securityEventsQueryOptions, type SecurityEvent } from "@/api/security";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEVERITY_COLORS: Record<string, string> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

const ACTION_LABELS: Record<string, string> = {
  blocked: "Bloqueado",
  flagged: "Suspeito",
  allow: "Permitido",
};

interface SecurityEventTableProps {
  days: number;
}

export function SecurityEventTable({ days }: SecurityEventTableProps) {
  const [agentFilter, setAgentFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data, isLoading } = useQuery(
    securityEventsQueryOptions({
      severity: severityFilter !== "all" ? severityFilter : undefined,
      action: actionFilter !== "all" ? actionFilter : undefined,
      agent_id: agentFilter !== "all" ? agentFilter : undefined,
      limit: 50,
    }),
  );

  const events = data?.events ?? [];

  // Extract unique agent IDs for the filter
  const allAgents = [...new Set(events.map((e: { agent_id: string }) => e.agent_id))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Log de Eventos</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {allAgents.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Critica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Acao" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas acoes</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
              <SelectItem value="flagged">Suspeito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum evento encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Padrao</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Acao</TableHead>
                <TableHead>Excerpt</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event: SecurityEvent) => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs font-mono">{event.agent_id}</TableCell>
                  <TableCell className="text-xs">{event.pattern_matched ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={SEVERITY_COLORS[event.severity] as "destructive" | "secondary" | "outline"}>
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.action === "blocked" ? "destructive" : "outline"}>
                      {ACTION_LABELS[event.action] ?? event.action}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate text-xs text-muted-foreground"
                    title={event.input_excerpt ?? ""}
                  >
                    {event.input_excerpt ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
