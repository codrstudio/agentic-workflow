import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectorForm, McpConnectorForm, EmailConnectorForm, EvolutionConnectorForm, MASKED } from "@/components/adapters/connector-form";
import type { ConnectorType, ConnectorCredential, McpOptions, EmailOptions, EvolutionOptions } from "@/components/adapters/connector-form";
import { request } from "@/lib/api";
import type { Adapter } from "@/api/adapters";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Detect which credential fields are masked (value === "***")
function detectMaskedFields(credential: Record<string, unknown>): Set<string> {
  const masked = new Set<string>();
  for (const [key, value] of Object.entries(credential)) {
    if (value === MASKED) masked.add(key);
  }
  return masked;
}

// Build credential object to send, omitting masked (unchanged) fields
function buildCredentialPayload(
  credential: ConnectorCredential,
  maskedFields: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(credential)) {
    if (!maskedFields.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

type TestState = "idle" | "loading" | "ok" | "error";

interface EmailTestResult {
  imap?: { ok: boolean; latencyMs?: number; mailbox?: string; unreadCount?: number; error?: string };
  smtp?: { ok: boolean; latencyMs?: number; error?: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAdapter?: Adapter | null;
}

export function AdapterDialog({ open, onOpenChange, editingAdapter }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!(editingAdapter?.slug);

  const [connector, setConnector] = useState<ConnectorType>("mysql");
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [scope, setScope] = useState<"shared" | "system">("shared");
  const [policy, setPolicy] = useState<"readonly" | "readwrite">("readwrite");
  const [credential, setCredential] = useState<ConnectorCredential>({});
  const [maskedFields, setMaskedFields] = useState<Set<string>>(new Set());
  const [mcpOptions, setMcpOptions] = useState<McpOptions>({ transport: "stdio", args: [], env: {} });
  const [mcpTools, setMcpTools] = useState<Array<{ name: string; description: string }>>([]);
  const [emailOptions, setEmailOptions] = useState<EmailOptions>({
    mailbox: "INBOX",
    poll_interval_seconds: 60,
    mark_seen: true,
    reply_prefix: "",
    from_name: "",
    sender_whitelist: "",
    subject_filter: "",
    auto_reply: true,
  });
  const [evolutionOptions, setEvolutionOptions] = useState<EvolutionOptions>({});

  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState("");
  const [testOk, setTestOk] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<EmailTestResult | null>(null);

  // Reset form when opening / changing editing target
  useEffect(() => {
    if (!open) return;
    if (isEditing && editingAdapter) {
      setConnector((editingAdapter.connector as ConnectorType) ?? "mysql");
      setLabel(editingAdapter.name ?? "");
      setSlug(editingAdapter.slug ?? "");
      setSlugEdited(true);
      setScope((editingAdapter.source as "shared" | "system") ?? "shared");
      setPolicy((editingAdapter.policy as "readonly" | "readwrite") ?? "readwrite");
      const cred = (editingAdapter.credential ?? {}) as Record<string, unknown>;
      setCredential(cred as ConnectorCredential);
      setMaskedFields(detectMaskedFields(cred));
      if (editingAdapter.connector === "mcp") {
        const opts = (editingAdapter.options ?? {}) as Partial<McpOptions>;
        setMcpOptions({
          transport: opts.transport ?? "stdio",
          command: opts.command,
          args: opts.args ?? [],
          env: opts.env ?? {},
          url: opts.url,
          server_label: opts.server_label,
          allowed_tools: opts.allowed_tools ?? [],
        });
      }
      if (editingAdapter.connector === "email") {
        const opts = (editingAdapter.options ?? {}) as Partial<EmailOptions>;
        setEmailOptions({
          agent_id: opts.agent_id,
          mailbox: opts.mailbox ?? "INBOX",
          poll_interval_seconds: opts.poll_interval_seconds ?? 60,
          mark_seen: opts.mark_seen ?? true,
          reply_prefix: opts.reply_prefix ?? "",
          from_name: opts.from_name ?? "",
          sender_whitelist: Array.isArray((opts as Record<string, unknown>).sender_whitelist)
            ? ((opts as Record<string, unknown>).sender_whitelist as string[]).join("\n")
            : (opts.sender_whitelist ?? ""),
          subject_filter: opts.subject_filter ?? "",
          auto_reply: opts.auto_reply ?? true,
        });
      }
      if (editingAdapter.connector === "evolution") {
        const opts = (editingAdapter.options ?? {}) as Partial<EvolutionOptions>;
        setEvolutionOptions({
          instance_name: opts.instance_name,
        });
      }
    } else {
      setConnector("mysql");
      setLabel("");
      setSlug("");
      setSlugEdited(false);
      setScope("shared");
      setPolicy("readwrite");
      setCredential({});
      setMaskedFields(new Set());
      setMcpOptions({ transport: "stdio", args: [], env: {} });
      setEmailOptions({
        mailbox: "INBOX",
        poll_interval_seconds: 60,
        mark_seen: true,
        reply_prefix: "",
        from_name: "",
        sender_whitelist: "",
        subject_filter: "",
        auto_reply: true,
      });
      setEvolutionOptions({});
    }
    setTestState("idle");
    setTestError("");
    setTestOk(false);
    setMcpTools([]);
    setEmailTestResult(null);
  }, [open, isEditing, editingAdapter]);

  // Auto-generate slug from label
  function handleLabelChange(value: string) {
    setLabel(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugEdited(true);
  }

  function handleConnectorChange(value: ConnectorType) {
    setConnector(value);
    setCredential({});
    setMaskedFields(new Set());
    setTestState("idle");
    setTestOk(false);
    setMcpTools([]);
    setEmailTestResult(null);
    if (value === "mcp") {
      setMcpOptions({ transport: "stdio", args: [], env: {} });
    }
    if (value === "email") {
      setEmailOptions({
        mailbox: "INBOX",
        poll_interval_seconds: 60,
        mark_seen: true,
        reply_prefix: "",
        from_name: "",
        sender_whitelist: "",
        subject_filter: "",
        auto_reply: true,
      });
    }
    if (value === "evolution") {
      // Initialize credential with env var defaults
      setCredential({ host: "${EVOLUTION_URL}", api_key: "${EVOLUTION_API_KEY}" });
      setEvolutionOptions({});
    }
  }

  function handleUnmask(field: string) {
    const next = new Set(maskedFields);
    next.delete(field);
    setMaskedFields(next);
    // Clear the field value so user types fresh
    setCredential((prev: ConnectorCredential) => ({ ...prev, [field]: "" }));
  }

  async function handleTest() {
    setTestState("loading");
    setTestError("");
    setMcpTools([]);
    setEmailTestResult(null);
    try {
      // For new adapters, save first then test.
      if (!isEditing) {
        await saveMutation.mutateAsync(false);
      }

      if (connector === "mcp") {
        // MCP-specific test that actually connects and returns tools
        const result = await request<{
          ok: boolean;
          tools?: Array<{ name: string; description: string }>;
          error?: string;
        }>(`/adapters/${slug}/mcp-test`, { method: "POST" });
        if (result.ok) {
          setTestState("ok");
          setTestOk(true);
          setMcpTools(result.tools ?? []);
        } else {
          setTestState("error");
          setTestError(result.error ?? "Falha na conexao MCP");
          setTestOk(false);
        }
      } else if (connector === "email") {
        // Email-specific test: separate IMAP + SMTP results
        const result = await request<EmailTestResult>(`/adapters/email/${slug}/test`, { method: "POST" });
        setEmailTestResult(result);
        const allOk = (result.imap?.ok ?? false) && (result.smtp?.ok ?? false);
        if (allOk) {
          setTestState("ok");
          setTestOk(true);
        } else {
          setTestState("error");
          const errs = [
            !result.imap?.ok ? `IMAP: ${result.imap?.error ?? "falhou"}` : null,
            !result.smtp?.ok ? `SMTP: ${result.smtp?.error ?? "falhou"}` : null,
          ].filter(Boolean);
          setTestError(errs.join(" | "));
          setTestOk(false);
        }
      } else {
        const result = await request<{ ok: boolean; latencyMs?: number; message?: string; error?: string }>(
          `/adapters/${slug}/test`,
          { method: "POST" },
        );
        if (result.ok) {
          setTestState("ok");
          setTestOk(true);
        } else {
          setTestState("error");
          setTestError(result.error ?? "Falha na conexao");
          setTestOk(false);
        }
      }
    } catch (e) {
      setTestState("error");
      setTestError(e instanceof Error ? e.message : "Erro ao testar conexao");
      setTestOk(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (closeAfter: boolean) => {
      const credPayload = buildCredentialPayload(credential, maskedFields);
      let optionsPayload: Record<string, unknown> = {};
      if (connector === "mcp") {
        optionsPayload = mcpOptions as unknown as Record<string, unknown>;
      } else if (connector === "email") {
        // Convert sender_whitelist from newline-separated string to array
        const whitelist = (emailOptions.sender_whitelist ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        optionsPayload = {
          ...emailOptions,
          sender_whitelist: whitelist,
        };
      } else if (connector === "evolution") {
        optionsPayload = evolutionOptions as unknown as Record<string, unknown>;
      }
      if (isEditing) {
        await request(`/adapters/${editingAdapter!.slug}`, {
          method: "PATCH",
          body: JSON.stringify({ label, slug, scope, policy, credential: credPayload, options: optionsPayload }),
        });
      } else {
        await request("/adapters", {
          method: "POST",
          body: JSON.stringify({ slug, connector, label, scope, policy, credential: credPayload, options: optionsPayload }),
        });
      }
      if (closeAfter) {
        queryClient.invalidateQueries({ queryKey: ["adapters"] });
        toast.success(isEditing ? "Adaptador atualizado" : "Adaptador criado");
        onOpenChange(false);
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar adaptador");
    },
  });

  async function handleSave() {
    await saveMutation.mutateAsync(true);
  }

  const canSave = isEditing || testOk;
  const isBusy = saveMutation.isPending || testState === "loading";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>{isEditing ? "Editar Adaptador" : "Novo Adaptador"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Connector */}
          <div className="space-y-1.5">
            <Label>Conector</Label>
            <Select
              value={connector}
              onValueChange={(v) => handleConnectorChange(v as ConnectorType)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgres">Postgres</SelectItem>
                <SelectItem value="evolution">Evolution</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="whatsapp-cloud">WhatsApp Cloud</SelectItem>
                <SelectItem value="mcp">MCP Server</SelectItem>
                <SelectItem value="email">Email (IMAP/SMTP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="ad-label">Nome</Label>
            <Input
              id="ad-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="CRM MySQL"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="ad-slug">Slug</Label>
            <Input
              id="ad-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="crm-mysql"
              className="font-mono text-sm"
            />
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "shared" | "system")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">Compartilhado (shared)</SelectItem>
                <SelectItem value="system">Sistema (system)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Policy */}
          <div className="space-y-1.5">
            <Label>Política</Label>
            <Select value={policy} onValueChange={(v) => setPolicy(v as "readonly" | "readwrite")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readwrite">Leitura e escrita</SelectItem>
                <SelectItem value="readonly">Somente leitura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic connector fields */}
          <div className="border-t pt-4 space-y-1">
            <p className="text-sm font-medium mb-3">
              {connector === "mcp" ? "Configuração MCP" : connector === "email" ? "Configuração Email" : connector === "evolution" ? "Configuração Evolution" : "Credenciais"}
            </p>
            {connector === "mcp" ? (
              <McpConnectorForm
                credential={credential}
                maskedFields={maskedFields}
                onChange={setCredential}
                onUnmask={handleUnmask}
                options={mcpOptions}
                onOptionsChange={setMcpOptions}
              />
            ) : connector === "email" ? (
              <EmailConnectorForm
                credential={credential}
                maskedFields={maskedFields}
                onChange={setCredential}
                onUnmask={handleUnmask}
                options={emailOptions}
                onOptionsChange={setEmailOptions}
              />
            ) : connector === "evolution" ? (
              <EvolutionConnectorForm
                credential={credential}
                maskedFields={maskedFields}
                onChange={setCredential}
                onUnmask={handleUnmask}
                options={evolutionOptions}
                onOptionsChange={setEvolutionOptions}
                isEditing={isEditing}
              />
            ) : (
              <ConnectorForm
                connector={connector}
                credential={credential}
                maskedFields={maskedFields}
                onChange={setCredential}
                onUnmask={handleUnmask}
              />
            )}
          </div>

          {/* Test connection */}
          <div className="border-t pt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isBusy || !slug}
              className="w-full"
            >
              {testState === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testState === "ok" && <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />}
              {testState === "error" && <XCircle className="mr-2 h-4 w-4 text-destructive" />}
              {testState === "loading" ? "Testando..." : "Testar conexão"}
            </Button>
            {testState === "ok" && connector !== "email" && (
              <p className="text-xs text-green-600 text-center">Conexão bem-sucedida</p>
            )}
            {testState === "error" && testError && connector !== "email" && (
              <p className="text-xs text-destructive text-center">{testError}</p>
            )}
            {/* Email test: IMAP + SMTP results */}
            {connector === "email" && emailTestResult && (
              <div className="mt-2 space-y-2">
                {emailTestResult.imap && (
                  <div className={`rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${emailTestResult.imap.ok ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
                    {emailTestResult.imap.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    <div>
                      <span className="font-medium">IMAP</span>
                      {emailTestResult.imap.ok ? (
                        <span className="text-muted-foreground"> — {emailTestResult.imap.latencyMs}ms{emailTestResult.imap.unreadCount !== undefined ? `, ${emailTestResult.imap.unreadCount} nao lidos` : ""}</span>
                      ) : (
                        <span className="text-destructive"> — {emailTestResult.imap.error ?? "falhou"}</span>
                      )}
                    </div>
                  </div>
                )}
                {emailTestResult.smtp && (
                  <div className={`rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${emailTestResult.smtp.ok ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
                    {emailTestResult.smtp.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    <div>
                      <span className="font-medium">SMTP</span>
                      {emailTestResult.smtp.ok ? (
                        <span className="text-muted-foreground"> — {emailTestResult.smtp.latencyMs}ms</span>
                      ) : (
                        <span className="text-destructive"> — {emailTestResult.smtp.error ?? "falhou"}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* MCP tools discovered after test */}
            {connector === "mcp" && mcpTools.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {mcpTools.length} ferramenta(s) descoberta(s):
                </p>
                <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                  {mcpTools.map((t) => (
                    <div key={t.name} className="px-3 py-2">
                      <p className="text-xs font-mono font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {t.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="p-6 pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isBusy || !slug || !label}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
