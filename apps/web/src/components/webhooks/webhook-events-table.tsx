import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { webhookEventsQueryOptions } from "@/api/webhooks";
import type { WebhookEvent } from "@/api/webhooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { request } from "@/lib/api";

interface WebhookEventsTableProps {
  agentId: string;
  webhookId: string;
}

const STATUS_BADGE: Record<WebhookEvent["status"], { label: string; variant: "default" | "destructive" | "secondary" }> = {
  done: { label: "Concluido", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  pending: { label: "Pendente", variant: "secondary" },
};

function PayloadCell({ payload }: { payload: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const text = JSON.stringify(payload, null, 2);
  const preview = JSON.stringify(payload).slice(0, 80);

  return (
    <div className="font-mono text-xs">
      <button
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="truncate max-w-[200px]">{preview}{text.length > 80 ? "…" : ""}</span>
      </button>
      {expanded && (
        <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  );
}

export function WebhookEventsTable({ agentId, webhookId }: WebhookEventsTableProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: events, isLoading } = useQuery(
    webhookEventsQueryOptions(agentId, webhookId),
  );

  const reprocessMutation = useMutation({
    mutationFn: (eventId: string) =>
      request(`/agents/${agentId}/webhooks/${webhookId}/events/${eventId}/reprocess`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-events", agentId, webhookId] });
      toast.success("Evento reenviado");
    },
    onError: () => toast.error("Erro ao reprocessar evento"),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  const paged = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(events.length / PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Data</TableHead>
              <TableHead className="w-[140px]">Event Type</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Payload</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((event) => {
              const badge = STATUS_BADGE[event.status];
              const eventType =
                typeof event.headers === "object" && event.headers
                  ? (event.headers as Record<string, string>)["x-event-type"] ?? "—"
                  : "—";
              return (
                <TableRow key={event.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.receivedAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{eventType}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant} className="text-xs">
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PayloadCell payload={event.payload} />
                  </TableCell>
                  <TableCell className="text-xs text-destructive">
                    {event.error ?? "—"}
                  </TableCell>
                  <TableCell>
                    {event.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={reprocessMutation.isPending}
                        onClick={() => reprocessMutation.mutate(event.id)}
                      >
                        <RefreshCw className="mr-1 size-3" />
                        Reprocessar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {page + 1} de {totalPages} ({events.length} eventos)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Proximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
