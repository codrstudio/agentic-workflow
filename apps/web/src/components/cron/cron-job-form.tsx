import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CronScheduleBuilder } from "@/components/cron/cron-schedule-builder";
import {
  createCronJob,
  updateCronJob,
  type CronJob,
} from "@/api/cron";
import { agentsQueryOptions } from "@/api/agents";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

interface CronJobFormProps {
  agentId?: string;
  job?: CronJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CronJobForm({
  agentId: preselectedAgentId,
  job,
  open,
  onOpenChange,
  onSuccess,
}: CronJobFormProps) {
  const isEditing = !!job;
  const queryClient = useQueryClient();

  const [agentId, setAgentId] = useState(job?.agentId ?? preselectedAgentId ?? "");
  const [slug, setSlug] = useState(job?.slug ?? "");
  const [name, setName] = useState(job?.def.name ?? "");
  const [instructions, setInstructions] = useState(job?.def.payload.message ?? "");
  const [schedule, setSchedule] = useState(job?.def.schedule.expr ?? "0 9 * * *");
  const [enabled, setEnabled] = useState(job?.def.enabled ?? true);

  const [slugError, setSlugError] = useState<string | null>(null);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const { data: agents } = useQuery(agentsQueryOptions());

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
    toast.success(isEditing ? "Job atualizado com sucesso" : "Job criado com sucesso");
    onOpenChange(false);
    onSuccess?.();
  }, [queryClient, isEditing, onOpenChange, onSuccess]);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      const body = error.body as Record<string, unknown> | undefined;
      const msg =
        (body?.error as string) ??
        (body?.message as string) ??
        "Erro ao salvar job";
      setBackendError(msg);
    } else {
      setBackendError("Erro ao salvar job");
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: createCronJob,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      agentId: aId,
      slug: s,
      ...payload
    }: { agentId: string; slug: string } & Parameters<typeof updateCronJob>[2]) =>
      updateCronJob(aId, s, payload),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    let valid = true;

    if (!isEditing && !agentId) {
      setAgentError("Selecione um agente");
      valid = false;
    } else {
      setAgentError(null);
    }

    if (!slug.trim()) {
      setSlugError("Slug e obrigatorio");
      valid = false;
    } else if (!KEBAB_CASE_RE.test(slug)) {
      setSlugError("Slug deve ser kebab-case (ex: relatorio-diario)");
      valid = false;
    } else {
      setSlugError(null);
    }

    if (!instructions.trim()) {
      setInstructionsError("Instrucoes sao obrigatorias");
      valid = false;
    } else {
      setInstructionsError(null);
    }

    return valid;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBackendError(null);

    if (!validate()) return;

    if (isEditing) {
      updateMutation.mutate({
        agentId: job.agentId,
        slug: job.slug,
        name: name.trim() || slug,
        enabled,
        schedule: { kind: "cron", expr: schedule },
        payload: { kind: "conversation", message: instructions.trim() },
      });
    } else {
      createMutation.mutate({
        agentId,
        slug,
        name: name.trim() || slug,
        enabled,
        schedule: { kind: "cron", expr: schedule },
        payload: { kind: "conversation", message: instructions.trim() },
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Job" : "Novo Job"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere as configuracoes do agendamento."
              : "Configure uma nova tarefa agendada para um agente."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(100vh-12rem)]">
          <form onSubmit={handleSubmit} className="space-y-5 pr-2">
            <div className="space-y-2">
              <Label htmlFor="cron-agent">Agente</Label>
              {isEditing ? (
                <Input id="cron-agent" value={job.agentId} disabled />
              ) : (
                <>
                  <Select
                    value={agentId}
                    onValueChange={(v) => {
                      if (v) setAgentId(v);
                      setAgentError(null);
                    }}
                  >
                    <SelectTrigger id="cron-agent" aria-invalid={!!agentError}>
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(agents ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {agentError && (
                    <p className="text-sm text-destructive">{agentError}</p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron-slug">Nome (slug)</Label>
              <Input
                id="cron-slug"
                placeholder="relatorio-diario"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugError(null);
                  setBackendError(null);
                }}
                disabled={isEditing}
                aria-invalid={!!slugError}
              />
              {slugError && (
                <p className="text-sm text-destructive">{slugError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron-name">Nome de exibicao</Label>
              <Input
                id="cron-name"
                placeholder="Relatorio diario (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron-instructions">Instrucoes</Label>
              <Textarea
                id="cron-instructions"
                placeholder="Descreva a tarefa que o agente executara..."
                value={instructions}
                onChange={(e) => {
                  setInstructions(e.target.value);
                  setInstructionsError(null);
                }}
                rows={3}
                aria-invalid={!!instructionsError}
              />
              {instructionsError && (
                <p className="text-sm text-destructive">{instructionsError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Agenda</Label>
              <CronScheduleBuilder value={schedule} onChange={setSchedule} />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="cron-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="cron-enabled">Ativo</Label>
            </div>

            {backendError && (
              <p className="text-sm text-destructive">{backendError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditing
                    ? "Salvando..."
                    : "Criando..."
                  : isEditing
                    ? "Salvar"
                    : "Criar Job"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
