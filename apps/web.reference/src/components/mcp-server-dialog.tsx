import { useState, useEffect } from "react";
import { Eye, EyeOff, Plus, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateMcpServer,
  useUpdateMcpServer,
  useConnectMcpServer,
  type McpServerConfig,
  type McpTransport,
} from "@/hooks/use-mcp-servers";

interface EnvEntry {
  key: string;
  value: string;
  visible: boolean;
}

function EnvEditor({
  entries,
  onChange,
}: {
  entries: EnvEntry[];
  onChange: (entries: EnvEntry[]) => void;
}) {
  const addEntry = () => {
    onChange([...entries, { key: "", value: "", visible: false }]);
  };

  const removeEntry = (idx: number) => {
    onChange(entries.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, field: "key" | "value", val: string) => {
    const next = entries.map((e, i) =>
      i === idx ? { ...e, [field]: val } : e
    );
    onChange(next);
  };

  const toggleVisibility = (idx: number) => {
    const next = entries.map((e, i) =>
      i === idx ? { ...e, visible: !e.visible } : e
    );
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          Environment Variables
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={addEntry}
        >
          <Plus className="size-3 mr-1" />
          Adicionar
        </Button>
      </div>
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            placeholder="KEY"
            value={entry.key}
            onChange={(e) => updateEntry(idx, "key", e.target.value)}
            className="flex-1 text-xs font-mono"
          />
          <div className="relative flex-1">
            <Input
              type={entry.visible ? "text" : "password"}
              placeholder="value"
              value={entry.value}
              onChange={(e) => updateEntry(idx, "value", e.target.value)}
              className="pr-8 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => toggleVisibility(idx)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {entry.visible ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeEntry(idx)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function McpServerDialog({
  open,
  onOpenChange,
  projectSlug,
  server,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  server?: McpServerConfig;
}) {
  const isEdit = !!server;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState<McpTransport>("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [url, setUrl] = useState("");
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([]);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const createServer = useCreateMcpServer(projectSlug);
  const updateServer = useUpdateMcpServer(projectSlug);
  const connectServer = useConnectMcpServer(projectSlug);

  useEffect(() => {
    if (open) {
      if (server) {
        setName(server.name);
        setDescription(server.description ?? "");
        setTransport(server.transport);
        setCommand(server.command ?? "");
        setArgsText(server.args.join(" "));
        setUrl(server.url ?? "");
        setEnvEntries(
          Object.entries(server.env).map(([key, value]) => ({
            key,
            value,
            visible: false,
          }))
        );
      } else {
        setName("");
        setDescription("");
        setTransport("stdio");
        setCommand("");
        setArgsText("");
        setUrl("");
        setEnvEntries([]);
      }
      setTestResult("idle");
      setTestError("");
    }
  }, [open, server]);

  const envToRecord = (): Record<string, string> => {
    const rec: Record<string, string> = {};
    for (const e of envEntries) {
      if (e.key.trim()) {
        rec[e.key.trim()] = e.value;
      }
    }
    return rec;
  };

  const handleSave = async () => {
    const args = argsText
      .split(/\s+/)
      .filter((a) => a.length > 0);

    if (isEdit) {
      await updateServer.mutateAsync({
        id: server.id,
        updates: {
          name,
          description: description || undefined,
          command: transport === "stdio" ? command : undefined,
          args: transport === "stdio" ? args : undefined,
          env: transport === "stdio" ? envToRecord() : undefined,
          url: transport === "sse" ? url : undefined,
        },
      });
    } else {
      await createServer.mutateAsync({
        name,
        description: description || undefined,
        transport,
        command: transport === "stdio" ? command : undefined,
        args: transport === "stdio" ? args : undefined,
        env: transport === "stdio" ? envToRecord() : undefined,
        url: transport === "sse" ? url : undefined,
      });
    }
    onOpenChange(false);
  };

  const handleTestConnection = async () => {
    setTestResult("testing");
    setTestError("");

    try {
      // Save first if creating new, then test
      let serverId = server?.id;
      if (!serverId) {
        const args = argsText.split(/\s+/).filter((a) => a.length > 0);
        const result = await createServer.mutateAsync({
          name,
          description: description || undefined,
          transport,
          command: transport === "stdio" ? command : undefined,
          args: transport === "stdio" ? args : undefined,
          env: transport === "stdio" ? envToRecord() : undefined,
          url: transport === "sse" ? url : undefined,
        });
        serverId = result.server.id;
      }

      const result = await connectServer.mutateAsync({
        id: serverId,
        action: "connect",
      });

      if (result.server.status === "connected") {
        setTestResult("success");
      } else {
        setTestResult("error");
        setTestError(result.server.last_error ?? "Falha na conexao");
      }
    } catch (err) {
      setTestResult("error");
      setTestError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const isSaving = createServer.isPending || updateServer.isPending;
  const canSave =
    name.trim() !== "" &&
    (transport === "stdio" ? command.trim() !== "" : url.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar MCP Server" : "Adicionar MCP Server"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize a configuracao do server MCP."
              : "Configure um novo server MCP para integracao."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Nome</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: filesystem, github, slack"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-desc">Descricao (opcional)</Label>
            <Textarea
              id="server-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao do server..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Transport</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => !isEdit && setTransport("stdio")}
                disabled={isEdit}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  transport === "stdio"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-input text-muted-foreground hover:bg-muted/50"
                } ${isEdit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                stdio
              </button>
              <button
                type="button"
                onClick={() => !isEdit && setTransport("sse")}
                disabled={isEdit}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  transport === "sse"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-input text-muted-foreground hover:bg-muted/50"
                } ${isEdit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                SSE
              </button>
            </div>
          </div>

          {transport === "stdio" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="server-command">Comando</Label>
                <Input
                  id="server-command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Ex: npx, node, python"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-args">Argumentos</Label>
                <Input
                  id="server-args"
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  placeholder="Ex: -y @modelcontextprotocol/server-filesystem /tmp"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Separados por espaco
                </p>
              </div>
              <EnvEditor entries={envEntries} onChange={setEnvEntries} />
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="server-url">URL</Label>
              <Input
                id="server-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Ex: http://localhost:3001/sse"
                className="font-mono text-sm"
              />
            </div>
          )}

          {testResult !== "idle" && (
            <div
              className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                testResult === "testing"
                  ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-600"
                  : testResult === "success"
                    ? "border-green-500/30 bg-green-500/5 text-green-600"
                    : "border-red-500/30 bg-red-500/5 text-red-600"
              }`}
            >
              {testResult === "testing" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : testResult === "success" ? (
                <CheckCircle className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
              <span>
                {testResult === "testing"
                  ? "Testando conexao..."
                  : testResult === "success"
                    ? "Conexao bem sucedida!"
                    : testError}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={!canSave || testResult === "testing" || isSaving}
          >
            {testResult === "testing" && (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            )}
            Testar conexao
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {isSaving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            {isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
