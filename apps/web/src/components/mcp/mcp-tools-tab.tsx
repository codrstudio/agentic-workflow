import { useQuery } from "@tanstack/react-query";
import { Server, Wrench, CheckCircle2, XCircle, Clock } from "lucide-react";
import { agentMcpToolsQueryOptions, agentMcpCallsQueryOptions } from "@/api/mcp";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface McpToolsTabProps {
  agentId: string;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatInput(input: unknown): string {
  if (!input) return "{}";
  try {
    const str = JSON.stringify(input);
    return str.length > 60 ? str.slice(0, 57) + "..." : str;
  } catch {
    return String(input);
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function McpToolsTab({ agentId }: McpToolsTabProps) {
  const { data: toolsData, isLoading: toolsLoading } = useQuery(agentMcpToolsQueryOptions(agentId));
  const { data: callsData, isLoading: callsLoading } = useQuery(agentMcpCallsQueryOptions(agentId));

  const servers = toolsData?.servers ?? [];
  const calls = callsData?.calls ?? [];

  return (
    <div className="space-y-8 pt-2">
      {/* Servers & Tools */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Server className="size-4" />
          Servidores MCP conectados
        </h3>

        {toolsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <EmptyState
            icon={<Wrench />}
            title="Nenhum adapter MCP no escopo deste agente"
            description="Crie um adapter MCP em /adapters e adicione ao escopo do agente."
          />
        ) : (
          <div className="space-y-4">
            {servers.map((server) => (
              <div
                key={server.adapterSlug}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{server.serverLabel}</span>
                    <Badge variant="outline" className="text-xs">
                      {server.transport}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {server.connected ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-green-500" />
                        <span className="text-xs text-green-600">Conectado</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="size-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Desconectado</span>
                      </>
                    )}
                  </div>
                </div>

                {server.tools.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma ferramenta disponível</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {server.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="rounded-md bg-muted/40 px-3 py-2"
                      >
                        <p className="font-mono text-xs font-medium">{tool.name}</p>
                        {tool.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Call history */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="size-4" />
          Histórico de chamadas MCP (últimas 20)
        </h3>

        {callsLoading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma chamada MCP registrada ainda.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ferramenta</TableHead>
                  <TableHead className="text-xs">Adapter</TableHead>
                  <TableHead className="text-xs">Input</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Duração</TableHead>
                  <TableHead className="text-xs">Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-mono text-xs">{call.toolName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{call.adapterId}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[160px] truncate">
                      {formatInput(call.input)}
                    </TableCell>
                    <TableCell>
                      {call.error ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <XCircle className="size-3" />
                          Erro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="size-3" />
                          OK
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{formatDuration(call.durationMs)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(call.calledAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
