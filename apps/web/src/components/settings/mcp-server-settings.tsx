import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, CheckCircle2, Server } from "lucide-react";
import { toast } from "sonner";
import { mcpServerConfigQueryOptions, updateMcpServerConfig } from "@/api/mcp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export function McpServerSettings() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery(mcpServerConfigQueryOptions());

  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: updateMcpServerConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "mcp-server"] });
      toast.success("Configuração do servidor MCP salva");
    },
    onError: () => toast.error("Erro ao salvar configuração"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!config) return null;

  // Build SSE endpoint URL based on current origin
  const sseUrl = `${window.location.origin}/api/v1/ai/mcp/sse`;

  // Generate Claude Desktop config JSON
  function buildClaudeDesktopConfig(): string {
    const cfg: Record<string, unknown> = {
      mcpServers: {
        "agentic-backbone": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sse", sseUrl],
        },
      },
    };
    if (config!.require_auth) {
      (cfg.mcpServers as Record<string, unknown>)["agentic-backbone"] = {
        ...((cfg.mcpServers as Record<string, unknown>)["agentic-backbone"] as object),
        env: {
          MCP_AUTH_TOKEN: "<seu-jwt-token>",
        },
      };
    }
    return JSON.stringify(cfg, null, 2);
  }

  async function handleCopyClaudeConfig() {
    const json = buildClaudeDesktopConfig();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    toast.success("Config copiada para área de transferência");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleToggleEnabled(enabled: boolean) {
    mutation.mutate({ ...config!, enabled });
  }

  function handleToggleRequireAuth(require_auth: boolean) {
    mutation.mutate({ ...config!, require_auth });
  }

  const isBusy = mutation.isPending;

  return (
    <div className="space-y-6 pt-2">
      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Server className="size-4" />
            Habilitar servidor MCP
          </Label>
          <p className="text-xs text-muted-foreground">
            Expõe este backbone como servidor MCP para clientes externos (Claude Desktop, Cursor, etc.)
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={handleToggleEnabled}
          disabled={isBusy}
        />
      </div>

      {/* Require auth toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Exigir autenticação JWT</Label>
          <p className="text-xs text-muted-foreground">
            Quando habilitado, clientes MCP devem enviar token JWT via query param{" "}
            <code className="font-mono text-xs">?token=</code> ou header{" "}
            <code className="font-mono text-xs">Authorization</code>
          </p>
        </div>
        <Switch
          checked={config.require_auth}
          onCheckedChange={handleToggleRequireAuth}
          disabled={isBusy}
        />
      </div>

      {/* Connection info */}
      {config.enabled && (
        <div className="space-y-4 rounded-lg border p-4">
          <h4 className="text-sm font-medium">Instruções de conexão</h4>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Endpoint SSE</Label>
            <div className="flex gap-2">
              <Input
                value={sseUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(sseUrl);
                  toast.success("URL copiada");
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Configuração para Claude Desktop (
              <code className="font-mono">claude_desktop_config.json</code>)
            </Label>
            <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {buildClaudeDesktopConfig()}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyClaudeConfig}
              className="w-full"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="mr-2 size-3.5 text-green-500" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-3.5" />
                  Copiar config para Claude Desktop
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
