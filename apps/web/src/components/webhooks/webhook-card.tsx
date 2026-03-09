import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { updateWebhook, deleteWebhook } from "@/api/webhooks";
import type { Webhook } from "@/api/webhooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WebhookCardProps {
  webhook: Webhook;
  agentId: string;
  onEdit: (webhook: Webhook) => void;
  onViewEvents: (webhook: Webhook) => void;
}

function buildWebhookUrl(agentId: string, webhookId: string): string {
  return `${window.location.origin}/api/v1/ai/webhooks/${agentId}/${webhookId}`;
}

export function WebhookCard({ webhook, agentId, onEdit, onViewEvents }: WebhookCardProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateWebhook(agentId, webhook.id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", agentId] });
    },
    onError: () => toast.error("Erro ao atualizar webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWebhook(agentId, webhook.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", agentId] });
      toast.success("Webhook revogado");
    },
    onError: () => toast.error("Erro ao revogar webhook"),
  });

  async function copyUrl() {
    const url = buildWebhookUrl(agentId, webhook.id);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("URL copiada");
  }

  const url = buildWebhookUrl(agentId, webhook.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="font-medium text-sm leading-none truncate">{webhook.name}</p>
            {webhook.description && (
              <p className="text-xs text-muted-foreground truncate">{webhook.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={webhook.enabled}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              disabled={toggleMutation.isPending}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-7">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewEvents(webhook)}>
                  <Eye className="mr-2 size-3.5" />
                  Ver historico
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(webhook)}>
                  <Pencil className="mr-2 size-3.5" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Revogar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate font-mono">
            {url}
          </code>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copyUrl}>
            {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {webhook.filters && webhook.filters.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Filtro: {webhook.filters.join(", ")}
              </span>
            )}
          </div>
          <Badge variant={webhook.enabled ? "default" : "secondary"} className="text-xs">
            {webhook.enabled ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Criado em {new Date(webhook.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </CardContent>
    </Card>
  );
}
