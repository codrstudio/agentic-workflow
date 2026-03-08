import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  MessageSquare,
  Package,
  Code,
  Loader2,
  CheckCircle2,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import {
  useHandoffRequest,
  useCreateHandoffRequest,
  usePatchHandoffRequest,
  useGenerateSpec,
  useGeneratePrp,
  useEnqueueFeature,
  handoffKeys,
  type HandoffSourceType,
  type HandoffRequest,
} from "@/hooks/use-handoff-requests";
import { useArtifact } from "@/hooks/use-artifacts";
import { HandoffStatusBadge } from "@/components/handoff-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "Descricao" },
  { num: 2, label: "Spec Review" },
  { num: 3, label: "PRP Review" },
  { num: 4, label: "Confirmacao" },
] as const;

const SOURCE_TYPES: {
  value: HandoffSourceType;
  label: string;
  icon: React.ElementType;
  placeholder: string;
}[] = [
  {
    value: "free_text",
    label: "Descrever aqui",
    icon: FileText,
    placeholder: "Descreva a feature que deseja construir...",
  },
  {
    value: "chat_session",
    label: "Usar sessao de chat",
    icon: MessageSquare,
    placeholder: "ID ou referencia da sessao de chat...",
  },
  {
    value: "artifact",
    label: "Usar artifact",
    icon: Package,
    placeholder: "ID do artifact existente...",
  },
  {
    value: "source_file",
    label: "Usar arquivo de source",
    icon: Code,
    placeholder: "Caminho do arquivo source...",
  },
];

function stepFromStatus(status: HandoffRequest["status"]): number {
  switch (status) {
    case "draft":
      return 1;
    case "generating_spec":
    case "spec_ready":
      return 2;
    case "generating_prp":
    case "prp_ready":
      return 3;
    case "enqueued":
      return 4;
    default:
      return 1;
  }
}

export function HandoffWizardPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/handoff/new",
  });
  const search = useSearch({
    from: "/_authenticated/projects/$projectId/handoff/new",
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // URL-driven state
  const urlStep = Number(search.step) || 1;
  const urlRequestId = (search.requestId as string) || null;

  const [currentStep, setCurrentStep] = useState(
    Math.min(Math.max(urlStep, 1), 4),
  );
  const [requestId, setRequestId] = useState<string | null>(urlRequestId);

  // Step 1 form state
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<HandoffSourceType>("free_text");
  const [description, setDescription] = useState("");
  const [sourceRef, setSourceRef] = useState("");

  // Step 2 state
  const [pmNotes, setPmNotes] = useState("");

  // Step 3 state
  const [sprint, setSprint] = useState(1);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  // Step 4 state
  const [createdFeatureId, setCreatedFeatureId] = useState<string | null>(null);
  const [enqueuedSprint, setEnqueuedSprint] = useState<number | null>(null);

  // Queries
  const {
    data: handoff,
    refetch: refetchHandoff,
  } = useHandoffRequest(projectId, requestId);

  const { data: specArtifact } = useArtifact(
    projectId,
    handoff?.generated_spec_id ?? null,
  );
  const { data: prpArtifact } = useArtifact(
    projectId,
    handoff?.generated_prp_id ?? null,
  );

  // Mutations
  const createMutation = useCreateHandoffRequest(projectId);
  const patchMutation = usePatchHandoffRequest(projectId);
  const generateSpecMutation = useGenerateSpec(projectId);
  const generatePrpMutation = useGeneratePrp(projectId);
  const enqueueMutation = useEnqueueFeature(projectId);

  // SSE subscription for live status updates
  const eventSourceRef = useRef<EventSource | null>(null);

  const subscribeSSE = useCallback(
    (reqId: string) => {
      eventSourceRef.current?.close();
      const url = `/api/v1/hub/projects/${projectId}/handoff-requests/${reqId}/events`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("status_update", (e) => {
        try {
          const event = JSON.parse(e.data) as { status: string };
          // Refetch handoff to get latest state
          queryClient.invalidateQueries({
            queryKey: handoffKeys.detail(projectId, reqId),
          });
          // If status changed to a ready state, navigate to correct step
          if (
            event.status === "spec_ready" ||
            event.status === "prp_ready"
          ) {
            refetchHandoff();
          }
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("artifact_ready", () => {
        queryClient.invalidateQueries({
          queryKey: handoffKeys.detail(projectId, reqId),
        });
        refetchHandoff();
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
    },
    [projectId, queryClient, refetchHandoff],
  );

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Restore state from loaded handoff on F5
  useEffect(() => {
    if (!handoff) return;

    const correctStep = stepFromStatus(handoff.status);
    setCurrentStep(correctStep);
    setTitle(handoff.title);
    setSourceType(handoff.source_type);
    setDescription(handoff.description);
    setSourceRef(handoff.source_ref ?? "");
    setPmNotes(handoff.pm_notes ?? "");

    if (handoff.feature_id) {
      setCreatedFeatureId(handoff.feature_id);
    }

    // Subscribe SSE if in generating state
    if (
      handoff.status === "generating_spec" ||
      handoff.status === "generating_prp"
    ) {
      subscribeSSE(handoff.id);
    }
  }, [handoff, subscribeSSE]);

  // Sync step to URL
  useEffect(() => {
    navigate({
      to: "/projects/$projectId/handoff/new",
      params: { projectId },
      search: { step: String(currentStep), requestId: requestId ?? undefined },
      replace: true,
    });
  }, [currentStep, requestId, projectId, navigate]);

  // --- Step 1: Descricao ---
  async function handleGenerateSpec() {
    try {
      // Create the handoff request first
      const created = await createMutation.mutateAsync({
        title,
        source_type: sourceType,
        source_ref: sourceType !== "free_text" ? sourceRef : null,
        description,
      });

      setRequestId(created.id);

      // Trigger spec generation
      await generateSpecMutation.mutateAsync(created.id);

      // Subscribe to SSE for updates
      subscribeSSE(created.id);

      // Navigate to step 2
      setCurrentStep(2);
    } catch {
      // Error is handled by mutation state
    }
  }

  // --- Step 2: Approve spec ---
  async function handleApproveSpec(approved: boolean) {
    if (!requestId) return;
    await patchMutation.mutateAsync({
      id: requestId,
      spec_approved: approved,
    });
    refetchHandoff();
  }

  async function handleGeneratePrp() {
    if (!requestId) return;
    try {
      // Save pm_notes before generating
      if (pmNotes) {
        await patchMutation.mutateAsync({
          id: requestId,
          pm_notes: pmNotes,
        });
      }
      await generatePrpMutation.mutateAsync(requestId);
      subscribeSSE(requestId);
      setCurrentStep(3);
    } catch {
      // Error handled by mutation state
    }
  }

  // --- Step 3: Approve PRP + enqueue ---
  async function handleApprovePrp(approved: boolean) {
    if (!requestId) return;
    await patchMutation.mutateAsync({
      id: requestId,
      prp_approved: approved,
    });
    refetchHandoff();
  }

  async function handleEnqueue() {
    if (!requestId) return;
    try {
      const result = await enqueueMutation.mutateAsync({
        requestId,
        sprint,
        priority,
      });
      setCreatedFeatureId(result.feature_id);
      setEnqueuedSprint(sprint);
      setCurrentStep(4);
    } catch {
      // Error handled by mutation state
    }
  }

  const isStep1Valid =
    title.trim().length >= 3 &&
    description.trim().length >= 10;

  const isGenerating =
    handoff?.status === "generating_spec" ||
    handoff?.status === "generating_prp";

  return (
    <div className="relative flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/projects/$projectId/handoff",
              params: { projectId },
            })
          }
        >
          <ArrowLeft className="mr-1 size-4" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Novo Handoff</h1>
        </div>
        {handoff && <HandoffStatusBadge status={handoff.status} />}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8",
                  currentStep > s.num - 1 ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                currentStep === s.num
                  ? "bg-primary text-primary-foreground"
                  : currentStep > s.num
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <span>{s.num}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-lg border p-6">
        {currentStep === 1 && (
          <Step1Description
            title={title}
            onTitleChange={setTitle}
            sourceType={sourceType}
            onSourceTypeChange={setSourceType}
            description={description}
            onDescriptionChange={setDescription}
            sourceRef={sourceRef}
            onSourceRefChange={setSourceRef}
            isValid={isStep1Valid}
            isSubmitting={
              createMutation.isPending || generateSpecMutation.isPending
            }
            onSubmit={handleGenerateSpec}
          />
        )}

        {currentStep === 2 && (
          <Step2SpecReview
            handoff={handoff}
            specContent={specArtifact?.content ?? null}
            pmNotes={pmNotes}
            onPmNotesChange={setPmNotes}
            onApproveSpec={handleApproveSpec}
            onGeneratePrp={handleGeneratePrp}
            isApproving={patchMutation.isPending}
            isGeneratingPrp={generatePrpMutation.isPending}
          />
        )}

        {currentStep === 3 && (
          <Step3PrpReview
            handoff={handoff}
            prpContent={prpArtifact?.content ?? null}
            sprint={sprint}
            onSprintChange={setSprint}
            priority={priority}
            onPriorityChange={setPriority}
            onApprovePrp={handleApprovePrp}
            onEnqueue={handleEnqueue}
            isApproving={patchMutation.isPending}
            isEnqueuing={enqueueMutation.isPending}
          />
        )}

        {currentStep === 4 && (
          <Step4Confirmation
            featureId={createdFeatureId}
            sprint={enqueuedSprint}
            projectId={projectId}
            onNavigateBoard={() =>
              navigate({
                to: "/projects/$projectId/harness/board",
                params: { projectId },
                search: { sprint: undefined },
              })
            }
            onNewHandoff={() =>
              navigate({
                to: "/projects/$projectId/handoff/new",
                params: { projectId },
                search: { step: "1", requestId: undefined },
              })
            }
          />
        )}
      </div>
    </div>
  );
}

/* ─── Step 1: Descricao ─── */

function Step1Description({
  title,
  onTitleChange,
  sourceType,
  onSourceTypeChange,
  description,
  onDescriptionChange,
  sourceRef,
  onSourceRefChange,
  isValid,
  isSubmitting,
  onSubmit,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  sourceType: HandoffSourceType;
  onSourceTypeChange: (v: HandoffSourceType) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  sourceRef: string;
  onSourceRefChange: (v: string) => void;
  isValid: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const selectedSource = SOURCE_TYPES.find((s) => s.value === sourceType)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Descricao</h2>
        <p className="text-sm text-muted-foreground">
          Descreva o que voce quer construir. O sistema gerara uma spec tecnica.
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Titulo</Label>
        <Input
          id="title"
          placeholder="Ex: Autenticacao com OAuth2"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      {/* Source type radio */}
      <div className="space-y-2">
        <Label>Tipo de fonte</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOURCE_TYPES.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => onSourceTypeChange(st.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
                sourceType === st.value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <st.icon className="size-5" />
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional area by source type */}
      {sourceType === "free_text" ? (
        <div className="space-y-2">
          <Label htmlFor="description">Descricao</Label>
          <Textarea
            id="description"
            placeholder={selectedSource.placeholder}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="min-h-[160px]"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source-ref">
              {sourceType === "chat_session"
                ? "Sessao de chat"
                : sourceType === "artifact"
                  ? "Artifact"
                  : "Arquivo source"}
            </Label>
            <Input
              id="source-ref"
              placeholder={selectedSource.placeholder}
              value={sourceRef}
              onChange={(e) => onSourceRefChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description-extra">Descricao adicional</Label>
            <Textarea
              id="description-extra"
              placeholder="Contexto adicional sobre o que deseja..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 size-4" />
          )}
          Gerar Spec
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 2: Spec Review ─── */

function Step2SpecReview({
  handoff,
  specContent,
  pmNotes,
  onPmNotesChange,
  onApproveSpec,
  onGeneratePrp,
  isApproving,
  isGeneratingPrp,
}: {
  handoff: HandoffRequest | undefined;
  specContent: string | null;
  pmNotes: string;
  onPmNotesChange: (v: string) => void;
  onApproveSpec: (approved: boolean) => void;
  onGeneratePrp: () => void;
  isApproving: boolean;
  isGeneratingPrp: boolean;
}) {
  const isGenerating = handoff?.status === "generating_spec";
  const isReady = handoff?.status === "spec_ready" || handoff?.spec_approved;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Spec Review</h2>
        <p className="text-sm text-muted-foreground">
          Revise a spec gerada e aprove para gerar o PRP.
        </p>
      </div>

      {/* Spinner while generating */}
      {isGenerating && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Gerando spec...</p>
        </div>
      )}

      {/* Spec content */}
      {!isGenerating && isReady && specContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/20 p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {specContent}
          </ReactMarkdown>
        </div>
      )}

      {!isGenerating && isReady && !specContent && (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Spec gerada (artifact ID: {handoff?.generated_spec_id}). Conteudo
          nao disponivel para preview.
        </div>
      )}

      {/* PM Notes */}
      {!isGenerating && isReady && (
        <div className="space-y-2">
          <Label htmlFor="pm-notes">Notas para o dev</Label>
          <Textarea
            id="pm-notes"
            placeholder="Observacoes, contexto adicional, restricoes..."
            value={pmNotes}
            onChange={(e) => onPmNotesChange(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      )}

      {/* Approve spec toggle + Generate PRP */}
      {!isGenerating && isReady && (
        <div className="flex items-center justify-between border-t pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={handoff?.spec_approved ?? false}
              onChange={(e) => onApproveSpec(e.target.checked)}
              disabled={isApproving}
              className="size-4 rounded border-input accent-primary"
            />
            Aprovar spec
            {handoff?.spec_approved && (
              <CheckCircle2 className="size-4 text-green-600" />
            )}
          </label>

          <Button
            onClick={onGeneratePrp}
            disabled={!handoff?.spec_approved || isGeneratingPrp}
          >
            {isGeneratingPrp ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-1.5 size-4" />
            )}
            Gerar PRP
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Step 3: PRP Review ─── */

function Step3PrpReview({
  handoff,
  prpContent,
  sprint,
  onSprintChange,
  priority,
  onPriorityChange,
  onApprovePrp,
  onEnqueue,
  isApproving,
  isEnqueuing,
}: {
  handoff: HandoffRequest | undefined;
  prpContent: string | null;
  sprint: number;
  onSprintChange: (v: number) => void;
  priority: "high" | "medium" | "low";
  onPriorityChange: (v: "high" | "medium" | "low") => void;
  onApprovePrp: (approved: boolean) => void;
  onEnqueue: () => void;
  isApproving: boolean;
  isEnqueuing: boolean;
}) {
  const isGenerating = handoff?.status === "generating_prp";
  const isReady = handoff?.status === "prp_ready" || handoff?.prp_approved;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">PRP Review</h2>
        <p className="text-sm text-muted-foreground">
          Revise o PRP gerado, selecione sprint e prioridade, e enfilere a
          feature.
        </p>
      </div>

      {/* Spinner while generating */}
      {isGenerating && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Gerando PRP...</p>
        </div>
      )}

      {/* PRP content */}
      {!isGenerating && isReady && prpContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/20 p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {prpContent}
          </ReactMarkdown>
        </div>
      )}

      {!isGenerating && isReady && !prpContent && (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          PRP gerado (artifact ID: {handoff?.generated_prp_id}). Conteudo nao
          disponivel para preview.
        </div>
      )}

      {/* Approve PRP + Sprint + Priority + Enqueue */}
      {!isGenerating && isReady && (
        <>
          <div className="flex items-center gap-2 text-sm font-medium">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={handoff?.prp_approved ?? false}
                onChange={(e) => onApprovePrp(e.target.checked)}
                disabled={isApproving}
                className="size-4 rounded border-input accent-primary"
              />
              Aprovar PRP
              {handoff?.prp_approved && (
                <CheckCircle2 className="size-4 text-green-600" />
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sprint">Sprint destino</Label>
              <select
                id="sprint"
                value={sprint}
                onChange={(e) => onSprintChange(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Sprint {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) =>
                  onPriorityChange(
                    e.target.value as "high" | "medium" | "low",
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              onClick={onEnqueue}
              disabled={!handoff?.prp_approved || isEnqueuing}
            >
              {isEnqueuing ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-4" />
              )}
              Enfileirar Feature
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Step 4: Confirmacao ─── */

function Step4Confirmation({
  featureId,
  sprint,
  projectId,
  onNavigateBoard,
  onNewHandoff,
}: {
  featureId: string | null;
  sprint: number | null;
  projectId: string;
  onNavigateBoard: () => void;
  onNewHandoff: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
        <PartyPopper className="size-8 text-green-600 dark:text-green-400" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Feature criada!
        </h2>
        <p className="text-muted-foreground">
          Feature{" "}
          <span className="font-mono font-semibold text-foreground">
            {featureId ?? "???"}
          </span>{" "}
          criada no Sprint {sprint ?? "?"}.
        </p>
        <p className="text-sm text-muted-foreground">
          A feature esta com status <em>pending</em> e sera executada pelo
          harness quando chegar sua vez.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onNavigateBoard}>
          Ver no Harness Board
        </Button>
        <Button onClick={onNewHandoff}>Iniciar outro handoff</Button>
      </div>
    </div>
  );
}
