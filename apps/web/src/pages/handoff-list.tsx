import { useState, useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useHandoffRequests, useCancelHandoffRequest, type HandoffRequest, type HandoffStatus } from "@/hooks/use-handoff-requests";
import { HandoffStatusBadge } from "@/components/handoff-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type Tab = "in_progress" | "completed" | "cancelled";

const IN_PROGRESS_STATUSES: HandoffStatus[] = [
  "draft",
  "generating_spec",
  "spec_ready",
  "generating_prp",
  "prp_ready",
];

const SOURCE_TYPE_LABELS: Record<string, string> = {
  chat_session: "Chat",
  artifact: "Artifact",
  source_file: "Source",
  free_text: "Texto livre",
};

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "in_progress", label: "Em progresso", icon: Clock },
  { key: "completed", label: "Concluidos", icon: CheckCircle2 },
  { key: "cancelled", label: "Cancelados", icon: XCircle },
];

function filterByTab(requests: HandoffRequest[], tab: Tab): HandoffRequest[] {
  switch (tab) {
    case "in_progress":
      return requests.filter((r) => IN_PROGRESS_STATUSES.includes(r.status));
    case "completed":
      return requests.filter((r) => r.status === "enqueued");
    case "cancelled":
      return requests.filter((r) => r.status === "cancelled");
  }
}

export function HandoffListPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/handoff",
  });
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("in_progress");

  const { data: requests, isLoading, isError, error } = useHandoffRequests(projectId);
  const cancelMutation = useCancelHandoffRequest(projectId);

  const filtered = useMemo(() => {
    if (!requests) return [];
    return filterByTab(requests, activeTab);
  }, [requests, activeTab]);

  const tabCounts = useMemo(() => {
    if (!requests) return { in_progress: 0, completed: 0, cancelled: 0 };
    return {
      in_progress: filterByTab(requests, "in_progress").length,
      completed: filterByTab(requests, "completed").length,
      cancelled: filterByTab(requests, "cancelled").length,
    };
  }, [requests]);

  return (
    <div className="relative flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PM Handoff</h1>
          <p className="text-sm text-muted-foreground">
            Converta ideias em specs e PRPs estruturados para o harness
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: "/projects/$projectId/handoff/new",
              params: { projectId },
            })
          }
        >
          <Plus className="mr-1.5 size-4" />
          Novo Handoff
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar handoffs: {error.message}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={ArrowRightLeft}
          title={
            activeTab === "in_progress"
              ? "Nenhum handoff em progresso"
              : activeTab === "completed"
                ? "Nenhum handoff concluido"
                : "Nenhum handoff cancelado"
          }
          description={
            activeTab === "in_progress"
              ? "Crie um novo handoff para converter ideias em features estruturadas."
              : "Handoffs aparecerao aqui quando mudarem de status."
          }
          actionLabel={activeTab === "in_progress" ? "Novo Handoff" : undefined}
          onAction={
            activeTab === "in_progress"
              ? () =>
                  navigate({
                    to: "/projects/$projectId/handoff/new",
                    params: { projectId },
                  })
              : undefined
          }
          className="min-h-[40vh]"
        />
      )}

      {/* Cards */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((req) => (
            <HandoffCard
              key={req.id}
              request={req}
              projectId={projectId}
              onCancel={() => cancelMutation.mutate(req.id)}
              onNavigate={(path) => navigate({ to: path, params: { projectId } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HandoffCard({
  request,
  projectId,
  onCancel,
  onNavigate,
}: {
  request: HandoffRequest;
  projectId: string;
  onCancel: () => void;
  onNavigate: (path: string) => void;
}) {
  const isInProgress = IN_PROGRESS_STATUSES.includes(request.status);
  const isWizardable = request.status === "draft" || request.status === "spec_ready" || request.status === "prp_ready";

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">{request.title}</h3>
          <HandoffStatusBadge status={request.status} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {SOURCE_TYPE_LABELS[request.source_type] ?? request.source_type}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {request.description}
        </p>
        <p className="text-xs text-muted-foreground">
          Criado em {new Date(request.created_at).toLocaleDateString("pt-BR")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {isWizardable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onNavigate(`/projects/${projectId}/handoff/new?requestId=${request.id}`)
            }
          >
            Continuar
          </Button>
        )}
        {request.status === "enqueued" && request.feature_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(`/projects/${projectId}/handoff/${request.id}`)}
          >
            Ver detalhe
          </Button>
        )}
        {isInProgress && request.status !== "generating_spec" && request.status !== "generating_prp" && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
