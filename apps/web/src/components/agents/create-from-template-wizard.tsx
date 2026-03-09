import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import Markdown from "react-markdown";
import {
  Headphones,
  ShoppingCart,
  LifeBuoy,
  Monitor,
  User,
  Bot,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  agentTemplateQueryOptions,
  createAgentFromTemplate,
} from "@/api/templates";
import { usersQueryOptions } from "@/api/users";
import { ApiError } from "@/lib/api";

const ICON_MAP: Record<string, LucideIcon> = {
  Headphones,
  ShoppingCart,
  LifeBuoy,
  Monitor,
  User,
  Bot,
};

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const STEPS = ["Preview", "Personalizar", "Confirmar"];

interface WizardForm {
  name: string;
  slug: string;
  description: string;
  owner: string;
}

interface FieldErrors {
  name?: string;
  slug?: string;
}

interface CreateFromTemplateWizardProps {
  templateSlug: string;
}

export function CreateFromTemplateWizard({
  templateSlug,
}: CreateFromTemplateWizardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [backendError, setBackendError] = useState<string | null>(null);
  const [form, setForm] = useState<WizardForm>({
    name: "",
    slug: "",
    description: "",
    owner: "system",
  });

  const { data: template, isLoading: templateLoading } = useQuery(
    agentTemplateQueryOptions(templateSlug),
  );
  const { data: users } = useQuery(usersQueryOptions());

  useEffect(() => {
    if (template && !form.description) {
      setForm((f) => ({ ...f, description: template.description }));
    }
  }, [template]);

  useEffect(() => {
    if (!slugManuallyEdited && form.name) {
      setForm((f) => ({ ...f, slug: toSlug(f.name) }));
    }
  }, [form.name, slugManuallyEdited]);

  const mutation = useMutation({
    mutationFn: createAgentFromTemplate,
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate({ to: "/agents/$id", params: { id: agent.id }, search: { tab: "config" } });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const body = error.body as Record<string, unknown> | undefined;
        const msg =
          (body?.error as string) ??
          (body?.message as string) ??
          "Erro ao criar agente";
        setBackendError(msg);
      } else {
        setBackendError("Erro ao criar agente");
      }
    },
  });

  const ownerOptions = [
    { value: "system", label: "system" },
    ...(users ?? []).map((u) => ({ value: u.slug, label: u.slug })),
  ];

  function validateStep2(): boolean {
    const errs: FieldErrors = {};
    if (!form.name.trim()) errs.name = "Nome é obrigatório";
    if (!form.slug.trim()) {
      errs.slug = "Slug é obrigatório";
    } else if (!KEBAB_CASE_RE.test(form.slug)) {
      errs.slug = "Slug deve ser kebab-case (ex: meu-agente)";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (step === 1 && !validateStep2()) return;
    setStep((s) => s + 1);
  }

  function handleBack() {
    setErrors({});
    setBackendError(null);
    setStep((s) => s - 1);
  }

  function handleCreate() {
    setBackendError(null);
    mutation.mutate({
      template: templateSlug,
      owner: form.owner,
      slug: form.slug,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      enabled: true,
    });
  }

  const Icon = template ? (ICON_MAP[template.icon] ?? Bot) : Bot;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Stepper */}
      <nav aria-label="Progresso do wizard">
        <ol className="flex items-center gap-0">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={[
                      "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary text-primary"
                          : "border-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </div>
                  <span
                    className={[
                      "text-xs",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={[
                      "mb-5 h-px flex-1 transition-colors",
                      done ? "bg-primary" : "bg-border",
                    ].join(" ")}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      {step === 0 && (
        <StepPreview template={template} isLoading={templateLoading} Icon={Icon} />
      )}
      {step === 1 && (
        <StepPersonalize
          form={form}
          errors={errors}
          ownerOptions={ownerOptions}
          onChange={(field, value) => {
            setForm((f) => ({ ...f, [field]: value }));
            setErrors((e) => ({ ...e, [field]: undefined }));
          }}
          onSlugChange={(value) => {
            setSlugManuallyEdited(true);
            setForm((f) => ({ ...f, slug: value }));
            setErrors((e) => ({ ...e, slug: undefined }));
          }}
        />
      )}
      {step === 2 && (
        <StepConfirm
          form={form}
          templateName={template?.name ?? templateSlug}
          Icon={Icon}
          backendError={backendError}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handleBack} disabled={step === 0}>
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext}>Próximo</Button>
        ) : (
          <Button onClick={handleCreate} disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar agente"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Step 1: Preview ---------- */

interface StepPreviewProps {
  template: import("@/api/templates").AgentTemplateDetail | undefined;
  isLoading: boolean;
  Icon: LucideIcon;
}

function StepPreview({ template, isLoading, Icon }: StepPreviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!template) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="size-5 shrink-0 text-muted-foreground" />
          {template.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{template.category}</Badge>
          {template.heartbeatEnabled && (
            <Badge variant="outline">Heartbeat ativo</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{template.description}</p>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Personalidade (SOUL.md)</p>
          <ScrollArea className="h-56 rounded-md border bg-muted/30 p-4">
            <div className="prose prose-sm max-w-none text-foreground">
              <Markdown>{template.preview.soul || "_Sem conteúdo_"}</Markdown>
            </div>
          </ScrollArea>
        </div>
        {template.suggestedSkills.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">Skills sugeridas</p>
            <div className="flex flex-wrap gap-1">
              {template.suggestedSkills.map((s) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Step 2: Personalizar ---------- */

interface StepPersonalizeProps {
  form: WizardForm;
  errors: FieldErrors;
  ownerOptions: { value: string; label: string }[];
  onChange: (field: keyof WizardForm, value: string) => void;
  onSlugChange: (value: string) => void;
}

function StepPersonalize({
  form,
  errors,
  ownerOptions,
  onChange,
  onSlugChange,
}: StepPersonalizeProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Personalizar agente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do agente *</Label>
          <Input
            id="name"
            placeholder="Ex: Atendente da Loja"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">
            Slug *{" "}
            <span className="text-xs text-muted-foreground">
              (auto-gerado do nome, editável)
            </span>
          </Label>
          <Input
            id="slug"
            placeholder="atendente-da-loja"
            value={form.slug}
            onChange={(e) => onSlugChange(e.target.value)}
            aria-invalid={!!errors.slug}
          />
          {errors.slug && (
            <p className="text-sm text-destructive">{errors.slug}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            placeholder="Descreva o agente (opcional)"
            value={form.description}
            onChange={(e) => onChange("description", e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">Owner</Label>
          <Select
            value={form.owner}
            onValueChange={(v) => v && onChange("owner", v)}
          >
            <SelectTrigger id="owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ownerOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Step 3: Confirmar ---------- */

interface StepConfirmProps {
  form: WizardForm;
  templateName: string;
  Icon: LucideIcon;
  backendError: string | null;
}

function StepConfirm({ form, templateName, Icon, backendError }: StepConfirmProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Confirmar criação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Icon className="size-5 shrink-0 text-muted-foreground" />
            <span className="font-medium">{form.name || form.slug}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono">{form.slug}</dd>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{form.owner}</dd>
            <dt className="text-muted-foreground">Template</dt>
            <dd>{templateName}</dd>
            {form.description && (
              <>
                <dt className="text-muted-foreground">Descrição</dt>
                <dd className="line-clamp-2">{form.description}</dd>
              </>
            )}
          </dl>
        </div>
        <p className="text-sm text-muted-foreground">
          O agente será criado com os arquivos SOUL.md, CONVERSATION.md e
          HEARTBEAT.md do template. Você pode editar tudo na página do agente
          após a criação.
        </p>
        {backendError && (
          <p className="text-sm text-destructive">{backendError}</p>
        )}
      </CardContent>
    </Card>
  );
}
