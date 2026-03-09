import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { request } from "@/lib/api";
import type { Adapter } from "@/api/adapters";

const CONNECTOR_LABELS: Record<string, string> = {
  mysql: "MySQL",
  postgres: "Postgres",
  evolution: "Evolution",
  twilio: "Twilio",
  http: "HTTP",
  "whatsapp-cloud": "WhatsApp Cloud",
  mcp: "MCP Server",
  email: "Email (IMAP/SMTP)",
};

function WhatsAppWebhookInfo({ adapterId }: { adapterId: string }) {
  const webhookUrl = `${window.location.origin}/api/v1/ai/connectors/whatsapp-cloud/${adapterId}/webhook`;

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      toast.success("URL copiada!");
    });
  }

  return (
    <div className="mt-3 rounded-md border p-3 space-y-2">
      <p className="text-xs font-medium">URL do Webhook</p>
      <p className="text-xs font-mono break-all text-muted-foreground">{webhookUrl}</p>
      <p className="text-xs text-muted-foreground">
        Configure esta URL no Meta Business Manager como webhook do aplicativo.
      </p>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copyUrl}>
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Copiar URL
      </Button>
    </div>
  );
}

type TestState = "idle" | "loading" | "ok" | "error";

interface Props {
  adapter: Adapter;
  onEdit: (adapter: Adapter) => void;
}

export function AdapterCard({ adapter, onEdit }: Props) {
  const queryClient = useQueryClient();
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState<string>("");

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      request(`/adapters/${adapter.slug}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adapters"] });
    },
    onError: () => toast.error("Erro ao atualizar adaptador"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => request(`/adapters/${adapter.slug}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Adaptador removido");
      queryClient.invalidateQueries({ queryKey: ["adapters"] });
    },
    onError: () => toast.error("Erro ao remover adaptador"),
  });

  async function handleTest() {
    setTestState("loading");
    setTestError("");
    try {
      const result = await request<{ ok: boolean; latencyMs?: number; message?: string; error?: string }>(
        `/adapters/${adapter.slug}/test`,
        { method: "POST" }
      );
      if (result.ok) {
        setTestState("ok");
        setTimeout(() => setTestState("idle"), 3000);
      } else {
        setTestState("error");
        setTestError(result.error ?? "Falha na conexao");
        setTimeout(() => setTestState("idle"), 5000);
      }
    } catch {
      setTestState("error");
      setTestError("Erro ao testar conexao");
      setTimeout(() => setTestState("idle"), 5000);
    }
  }

  const connectorLabel = CONNECTOR_LABELS[adapter.connector] ?? adapter.connector;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{adapter.name}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{adapter.slug}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              checked={adapter.enabled}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              disabled={toggleMutation.isPending}
            />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(adapter)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{connectorLabel}</Badge>
          <Badge variant="outline">{adapter.source}</Badge>
          <Badge variant="outline">{adapter.policy}</Badge>
        </div>

        {/* Test button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testState === "loading"}
            className="h-7 text-xs"
          >
            {testState === "loading" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {testState === "ok" && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-500" />}
            {testState === "error" && <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />}
            {testState === "idle" && "Testar"}
            {testState === "loading" && "Testando..."}
            {testState === "ok" && "Conectado"}
            {testState === "error" && "Falhou"}
          </Button>
        </div>
        {testState === "error" && testError && (
          <p className="text-xs text-destructive">{testError}</p>
        )}

        {adapter.connector === "whatsapp-cloud" && (
          <WhatsAppWebhookInfo adapterId={adapter.slug} />
        )}
      </CardContent>
    </Card>
  );
}
