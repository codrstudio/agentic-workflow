import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createWebhook } from "@/api/webhooks";
import type { Webhook } from "@/api/webhooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface WebhookCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

interface CreatedInfo {
  url: string;
  secret: string;
}

function buildWebhookUrl(agentId: string, webhookId: string): string {
  return `${window.location.origin}/api/v1/ai/webhooks/${agentId}/${webhookId}`;
}

export function WebhookCreateDialog({ open, onOpenChange, agentId }: WebhookCreateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState("");
  const [created, setCreated] = useState<CreatedInfo | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      createWebhook(agentId, {
        name,
        description: description || undefined,
        filters: filters
          ? filters.split(",").map((f) => f.trim()).filter(Boolean)
          : undefined,
      }),
    onSuccess: (webhook: Webhook) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", agentId] });
      setCreated({
        url: buildWebhookUrl(agentId, webhook.id),
        secret: webhook.secret,
      });
    },
    onError: () => toast.error("Erro ao criar webhook"),
  });

  function handleClose(open: boolean) {
    if (!open) {
      setName("");
      setDescription("");
      setFilters("");
      setCreated(null);
      setCopiedUrl(false);
      setCopiedSecret(false);
    }
    onOpenChange(open);
  }

  async function copyUrl() {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  async function copySecret() {
    if (!created) return;
    await navigator.clipboard.writeText(created.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Webhook</DialogTitle>
        </DialogHeader>

        {!created ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wh-name">Nome *</Label>
                <Input
                  id="wh-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Stripe pagamentos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-desc">Descricao (opcional)</Label>
                <Textarea
                  id="wh-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Para que serve este webhook?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-filters">Filtro event_type (opcional)</Label>
                <Input
                  id="wh-filters"
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
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Criar Webhook"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <p>O secret nao sera exibido novamente. Copie e guarde em local seguro.</p>
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate font-mono">
                    {created.url}
                  </code>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copyUrl}>
                    {copiedUrl ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secret (HMAC-SHA256)</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate font-mono">
                    {created.secret}
                  </code>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copySecret}>
                    {copiedSecret ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Concluir</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
