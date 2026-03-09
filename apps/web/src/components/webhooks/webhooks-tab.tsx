import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Webhook, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { webhooksQueryOptions, updateWebhook } from "@/api/webhooks";
import type { Webhook as WebhookType } from "@/api/webhooks";
import { WebhookCard } from "@/components/webhooks/webhook-card";
import { WebhookCreateDialog } from "@/components/webhooks/webhook-create-dialog";
import { WebhookEventsTable } from "@/components/webhooks/webhook-events-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WebhooksTabProps {
  agentId: string;
}

interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  webhook: WebhookType;
}

function WebhookEditDialog({ open, onOpenChange, agentId, webhook }: EditDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(webhook.name);
  const [description, setDescription] = useState(webhook.description ?? "");
  const [filters, setFilters] = useState(webhook.filters?.join(", ") ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      updateWebhook(agentId, webhook.id, {
        name,
        description: description || undefined,
        filters: filters
          ? filters.split(",").map((f) => f.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", agentId] });
      toast.success("Webhook atualizado");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao atualizar webhook"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Descricao</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-filters">Filtro event_type</Label>
            <Input
              id="edit-filters"
              value={filters}
              onChange={(e) => setFilters(e.target.value)}
              placeholder="payment.success, order.created"
            />
            <p className="text-xs text-muted-foreground">
              Separe multiplos tipos por virgula. Deixe vazio para aceitar todos.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!name.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksTab({ agentId }: WebhooksTabProps) {
  const { data: webhooks, isLoading } = useQuery(webhooksQueryOptions(agentId));
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null);
  const [viewingWebhook, setViewingWebhook] = useState<WebhookType | null>(null);

  if (viewingWebhook) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewingWebhook(null)}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Voltar
          </Button>
          <h3 className="text-sm font-medium">{viewingWebhook.name} — Historico</h3>
        </div>
        <WebhookEventsTable agentId={agentId} webhookId={viewingWebhook.id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Webhooks</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-4" />
          Novo Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : !webhooks?.length ? (
        <EmptyState
          icon={<Webhook />}
          title="Nenhum webhook configurado"
          description="Crie um webhook para receber eventos externos e acionar este agente."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((webhook) => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              agentId={agentId}
              onEdit={setEditingWebhook}
              onViewEvents={setViewingWebhook}
            />
          ))}
        </div>
      )}

      <WebhookCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
      />

      {editingWebhook && (
        <WebhookEditDialog
          open={!!editingWebhook}
          onOpenChange={(open) => { if (!open) setEditingWebhook(null); }}
          agentId={agentId}
          webhook={editingWebhook}
        />
      )}
    </div>
  );
}
