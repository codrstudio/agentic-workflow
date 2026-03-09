import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useContainmentPolicies,
  useCreateContainmentPolicy,
  useUpdateContainmentPolicy,
  useDeleteContainmentPolicy,
  type ContainmentPolicy,
  type ContainmentLevel,
  type CreateContainmentPolicyBody,
} from "@/hooks/use-containment-policies";

// --- Level badge ---

const LEVEL_COLORS: Record<ContainmentLevel, string> = {
  unrestricted: "bg-gray-100 text-gray-700 border-gray-200",
  standard: "bg-blue-100 text-blue-700 border-blue-200",
  restricted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  isolated: "bg-red-100 text-red-700 border-red-200",
};

function LevelBadge({ level }: { level: ContainmentLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${LEVEL_COLORS[level]}`}
    >
      {level}
    </span>
  );
}

// --- Toggle ---

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// --- YAML Preview ---

function policyToYaml(p: FormState): string {
  const lines: string[] = [
    `name: ${p.name || "(sem nome)"}`,
    `level: ${p.level}`,
    `enabled: ${p.enabled}`,
  ];
  if (p.description) lines.push(`description: "${p.description}"`);
  if (p.applies_to_steps || p.applies_to_agents) {
    lines.push("applies_to:");
    if (p.applies_to_steps)
      lines.push(
        `  steps: [${p.applies_to_steps
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")}]`
      );
    if (p.applies_to_agents)
      lines.push(
        `  agents: [${p.applies_to_agents
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")}]`
      );
  }
  lines.push("execution_limits:");
  lines.push(`  max_turns: ${p.max_turns}`);
  lines.push(`  timeout_minutes: ${p.timeout_minutes}`);
  if (p.max_output_tokens)
    lines.push(`  max_output_tokens: ${p.max_output_tokens}`);
  const allowedPaths = p.allowed_paths
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const blockedPaths = p.blocked_paths
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const readOnly = p.read_only
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedPaths.length || blockedPaths.length || readOnly.length) {
    lines.push("path_restrictions:");
    if (allowedPaths.length)
      lines.push(`  allowed_paths: [${allowedPaths.join(", ")}]`);
    if (blockedPaths.length)
      lines.push(`  blocked_paths: [${blockedPaths.join(", ")}]`);
    if (readOnly.length) lines.push(`  read_only: [${readOnly.join(", ")}]`);
  }
  const allowedTools = p.allowed_tools
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const blockedTools = p.blocked_tools
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedTools.length || blockedTools.length) {
    lines.push("tool_restrictions:");
    if (allowedTools.length)
      lines.push(`  allowed_tools: [${allowedTools.join(", ")}]`);
    if (blockedTools.length)
      lines.push(`  blocked_tools: [${blockedTools.join(", ")}]`);
  }
  lines.push("graduated_response:");
  lines.push(`  on_timeout: ${p.on_timeout}`);
  lines.push(`  on_drift: ${p.on_drift}`);
  return lines.join("\n");
}

// --- Form State ---

interface FormState {
  name: string;
  description: string;
  level: ContainmentLevel;
  applies_to_steps: string;
  applies_to_agents: string;
  max_turns: number;
  timeout_minutes: number;
  max_output_tokens: string;
  allowed_paths: string;
  blocked_paths: string;
  read_only: string;
  allowed_tools: string;
  blocked_tools: string;
  on_timeout: "kill" | "warn_and_extend" | "save_and_kill";
  on_drift: "ignore" | "warn" | "intervene" | "kill";
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  level: "standard",
  applies_to_steps: "",
  applies_to_agents: "",
  max_turns: 200,
  timeout_minutes: 30,
  max_output_tokens: "",
  allowed_paths: "",
  blocked_paths: "",
  read_only: "",
  allowed_tools: "",
  blocked_tools: "",
  on_timeout: "kill",
  on_drift: "warn",
  enabled: true,
};

function policyToForm(p: ContainmentPolicy): FormState {
  return {
    name: p.name,
    description: p.description ?? "",
    level: p.level,
    applies_to_steps: (p.applies_to.steps ?? []).join(", "),
    applies_to_agents: (p.applies_to.agents ?? []).join(", "),
    max_turns: p.execution_limits.max_turns,
    timeout_minutes: p.execution_limits.timeout_minutes,
    max_output_tokens: p.execution_limits.max_output_tokens
      ? String(p.execution_limits.max_output_tokens)
      : "",
    allowed_paths: p.path_restrictions.allowed_paths.join("\n"),
    blocked_paths: p.path_restrictions.blocked_paths.join("\n"),
    read_only: p.path_restrictions.read_only.join("\n"),
    allowed_tools: (p.tool_restrictions.allowed_tools ?? []).join(", "),
    blocked_tools: (p.tool_restrictions.blocked_tools ?? []).join(", "),
    on_timeout: p.graduated_response.on_timeout,
    on_drift: p.graduated_response.on_drift,
    enabled: p.enabled,
  };
}

function formToBody(f: FormState): CreateContainmentPolicyBody {
  const steps = f.applies_to_steps
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const agents = f.applies_to_agents
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedPaths = f.allowed_paths
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const blockedPaths = f.blocked_paths
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const readOnly = f.read_only
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedTools = f.allowed_tools
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const blockedTools = f.blocked_tools
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name: f.name,
    description: f.description || null,
    level: f.level,
    applies_to: {
      steps: steps.length ? steps : null,
      agents: agents.length ? agents : null,
    },
    execution_limits: {
      max_turns: f.max_turns,
      timeout_minutes: f.timeout_minutes,
      max_output_tokens: f.max_output_tokens
        ? Number(f.max_output_tokens)
        : null,
    },
    path_restrictions: {
      allowed_paths: allowedPaths,
      blocked_paths: blockedPaths,
      read_only: readOnly,
    },
    tool_restrictions: {
      allowed_tools: allowedTools.length ? allowedTools : null,
      blocked_tools: blockedTools.length ? blockedTools : null,
    },
    graduated_response: {
      on_timeout: f.on_timeout,
      on_drift: f.on_drift,
    },
    enabled: f.enabled,
  };
}

// --- Policy Form Drawer ---

function ContainmentPolicyForm({
  open,
  onClose,
  policy,
  projectSlug,
}: {
  open: boolean;
  onClose: () => void;
  policy: ContainmentPolicy | null;
  projectSlug: string;
}) {
  const [form, setForm] = useState<FormState>(
    policy ? policyToForm(policy) : EMPTY_FORM
  );
  const [showYaml, setShowYaml] = useState(false);

  const createMutation = useCreateContainmentPolicy(projectSlug);
  const updateMutation = useUpdateContainmentPolicy(projectSlug);
  const deleteMutation = useDeleteContainmentPolicy(projectSlug);

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const body = formToBody(form);
    if (policy) {
      await updateMutation.mutateAsync({ id: policy.id, ...body });
    } else {
      await createMutation.mutateAsync(body);
    }
    onClose();
  }

  async function handleDelete() {
    if (!policy) return;
    await deleteMutation.mutateAsync(policy.id);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col overflow-hidden p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>
              {policy ? "Editar Politica" : "Nova Politica"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ex: Standard Coder Policy"
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descricao</Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Opcional"
              disabled={isPending}
            />
          </div>

          {/* Level */}
          <div className="space-y-1.5">
            <Label>Nivel</Label>
            <select
              value={form.level}
              onChange={(e) => set("level", e.target.value as ContainmentLevel)}
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="unrestricted">unrestricted</option>
              <option value="standard">standard</option>
              <option value="restricted">restricted</option>
              <option value="isolated">isolated</option>
            </select>
          </div>

          {/* Applies To */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Aplica a (applies_to)</Label>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Steps (separados por virgula)
              </Label>
              <Input
                value={form.applies_to_steps}
                onChange={(e) => set("applies_to_steps", e.target.value)}
                placeholder="ex: step-06, step-07"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Agents (separados por virgula)
              </Label>
              <Input
                value={form.applies_to_agents}
                onChange={(e) => set("applies_to_agents", e.target.value)}
                placeholder="ex: coder, researcher"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Execution Limits */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Limites de Execucao</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Max Turns
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_turns}
                  onChange={(e) => set("max_turns", Number(e.target.value))}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Timeout (min)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.timeout_minutes}
                  onChange={(e) =>
                    set("timeout_minutes", Number(e.target.value))
                  }
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Max Output Tokens (opcional)
              </Label>
              <Input
                type="number"
                min={1}
                value={form.max_output_tokens}
                onChange={(e) => set("max_output_tokens", e.target.value)}
                placeholder="ilimitado"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Path Restrictions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Restricoes de Path (glob por linha)
            </Label>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Allowed Paths
              </Label>
              <Textarea
                rows={3}
                value={form.allowed_paths}
                onChange={(e) => set("allowed_paths", e.target.value)}
                placeholder="src/**&#10;tests/**"
                disabled={isPending}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Blocked Paths
              </Label>
              <Textarea
                rows={3}
                value={form.blocked_paths}
                onChange={(e) => set("blocked_paths", e.target.value)}
                placeholder=".env&#10;secrets/**"
                disabled={isPending}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Read Only</Label>
              <Textarea
                rows={2}
                value={form.read_only}
                onChange={(e) => set("read_only", e.target.value)}
                placeholder="docs/**"
                disabled={isPending}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Tool Restrictions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Restricoes de Tools (separadas por virgula)
            </Label>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Allowed Tools
              </Label>
              <Input
                value={form.allowed_tools}
                onChange={(e) => set("allowed_tools", e.target.value)}
                placeholder="Read, Write, Edit"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Blocked Tools
              </Label>
              <Input
                value={form.blocked_tools}
                onChange={(e) => set("blocked_tools", e.target.value)}
                placeholder="Bash"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Graduated Response */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Resposta Graduada</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  On Timeout
                </Label>
                <select
                  value={form.on_timeout}
                  onChange={(e) =>
                    set(
                      "on_timeout",
                      e.target.value as FormState["on_timeout"]
                    )
                  }
                  disabled={isPending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="kill">kill</option>
                  <option value="warn_and_extend">warn_and_extend</option>
                  <option value="save_and_kill">save_and_kill</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  On Drift
                </Label>
                <select
                  value={form.on_drift}
                  onChange={(e) =>
                    set("on_drift", e.target.value as FormState["on_drift"])
                  }
                  disabled={isPending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="ignore">ignore</option>
                  <option value="warn">warn</option>
                  <option value="intervene">intervene</option>
                  <option value="kill">kill</option>
                </select>
              </div>
            </div>
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label>Habilitada</Label>
            <Toggle
              checked={form.enabled}
              onChange={(v) => set("enabled", v)}
              disabled={isPending}
            />
          </div>

          {/* Preview YAML */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowYaml((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={`size-4 transition-transform ${showYaml ? "rotate-90" : ""}`}
              />
              Preview YAML
            </button>
            {showYaml && (
              <pre className="rounded-md border bg-muted p-3 text-xs font-mono whitespace-pre overflow-x-auto max-h-48">
                {policyToYaml(form)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-2">
          <div>
            {policy && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                  >
                    <Trash2 className="size-4 mr-1.5" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir politica?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A politica &quot;{policy.name}&quot; sera excluida
                      permanentemente. Esta acao nao pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !form.name.trim()}
            >
              {isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Main Page ---

export function ContainmentPoliciesPage() {
  const { projectId } = useParams({ strict: false }) as {
    projectId: string;
  };

  const { data: policies, isLoading } = useContainmentPolicies(projectId);
  const updateMutation = useUpdateContainmentPolicy(projectId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] =
    useState<ContainmentPolicy | null>(null);

  function openNew() {
    setSelectedPolicy(null);
    setDrawerOpen(true);
  }

  function openEdit(policy: ContainmentPolicy) {
    setSelectedPolicy(policy);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedPolicy(null);
  }

  function toggleEnabled(policy: ContainmentPolicy) {
    updateMutation.mutate({ id: policy.id, enabled: !policy.enabled });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-5" />
            <div>
              <h1 className="text-lg font-semibold">Containment Policies</h1>
              <p className="text-sm text-muted-foreground">
                Politicas declarativas de containment para agentes no pipeline.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4 mr-1.5" />
            Nova Politica
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3">Nivel</th>
                <th className="text-right font-medium px-4 py-3">
                  Max Turns
                </th>
                <th className="text-right font-medium px-4 py-3">
                  Timeout
                </th>
                <th className="text-right font-medium px-4 py-3">Paths</th>
                <th className="text-right font-medium px-4 py-3">Tools</th>
                <th className="text-left font-medium px-4 py-3">On Drift</th>
                <th className="text-center font-medium px-4 py-3">
                  Habilitada
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && (!policies || policies.length === 0) && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Nenhuma politica criada. Clique em &quot;Nova Politica&quot;
                    para comecar.
                  </td>
                </tr>
              )}
              {policies?.map((policy) => {
                const pathsCount =
                  policy.path_restrictions.allowed_paths.length +
                  policy.path_restrictions.blocked_paths.length +
                  policy.path_restrictions.read_only.length;
                const toolsCount =
                  (policy.tool_restrictions.allowed_tools?.length ?? 0) +
                  (policy.tool_restrictions.blocked_tools?.length ?? 0);

                return (
                  <tr
                    key={policy.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div>{policy.name}</div>
                      {policy.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {policy.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LevelBadge level={policy.level} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {policy.execution_limits.max_turns}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {policy.execution_limits.timeout_minutes}m
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {pathsCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {toolsCount}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {policy.graduated_response.on_drift}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={policy.enabled}
                        onChange={() => toggleEnabled(policy)}
                        disabled={updateMutation.isPending}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(policy)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ContainmentPolicyForm
        open={drawerOpen}
        onClose={closeDrawer}
        policy={selectedPolicy}
        projectSlug={projectId}
      />
    </div>
  );
}
