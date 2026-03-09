import { useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCreateDelegationEvent,
  useDelegationEvents,
} from "@/hooks/use-delegation-events";
import type { DelegationEventType } from "@/hooks/use-delegation-events";
import type { PipelinePhase } from "@/hooks/use-phase-autonomy";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function urgencyFromTime(createdAt: string): "normal" | "yellow" | "red" {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const hours = elapsed / 3600000;
  if (hours > 4) return "red";
  if (hours > 1) return "yellow";
  return "normal";
}

const URGENCY_BADGE: Record<
  "normal" | "yellow" | "red",
  { label: string; className: string }
> = {
  normal: {
    label: "Pendente",
    className:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  },
  yellow: {
    label: ">1h pendente",
    className:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  },
  red: {
    label: ">4h pendente",
    className:
      "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
};

const PHASE_LABELS: Record<string, string> = {
  brainstorming: "Brainstorming",
  specs: "Specs",
  prps: "PRPs",
  implementation: "Implementacao",
  review: "Review",
  merge: "Merge",
};

// ----------------------------------------------------------------
// ConfidenceBar
// ----------------------------------------------------------------

interface ConfidenceBarProps {
  confidence: number; // 0-1
  threshold: number;  // 0-1
}

function ConfidenceBar({ confidence, threshold }: ConfidenceBarProps) {
  const confPct = Math.round(confidence * 100);
  const threshPct = Math.round(threshold * 100);

  const confColor =
    confidence >= threshold
      ? "bg-green-500"
      : confidence >= threshold - 0.1
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Confianca do agente</span>
        <span
          className={cn(
            "font-semibold",
            confidence >= threshold
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {confPct}%
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        {/* Confidence fill */}
        <div
          className={cn("h-full rounded-full transition-all", confColor)}
          style={{ width: `${Math.min(confPct, 100)}%` }}
        />
      </div>
      {/* Threshold marker rendered outside the overflow-hidden div */}
      <div className="relative h-2 w-full">
        <div
          className="absolute top-0 h-2 w-0.5 bg-foreground/50"
          style={{ left: `calc(${threshPct}% - 1px)` }}
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground">
            Threshold: {threshPct}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// ApprovalGateDialog
// ----------------------------------------------------------------

export interface ApprovalGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phase: PipelinePhase;
  agentConfidence: number;
  confidenceThreshold: number;
  outputSummary?: string;
  onDecision?: (eventType: DelegationEventType) => void;
}

export function ApprovalGateDialog({
  open,
  onOpenChange,
  projectId,
  phase,
  agentConfidence,
  confidenceThreshold,
  outputSummary,
  onDecision,
}: ApprovalGateDialogProps) {
  const createEvent = useCreateDelegationEvent(projectId);

  async function handleDecision(eventType: DelegationEventType) {
    await createEvent.mutateAsync({
      phase,
      event_type: eventType,
      agent_confidence: agentConfidence,
      details: `Decisao via approval gate dialog: ${eventType}`,
    });
    onDecision?.(eventType);
    onOpenChange(false);
  }

  const phaseLabel = PHASE_LABELS[phase] ?? phase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Aprovacao necessaria — {phaseLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Output summary */}
          {outputSummary && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Sumario do output
              </p>
              <p className="text-sm">{outputSummary}</p>
            </div>
          )}

          {/* Confidence bar with threshold */}
          <ConfidenceBar
            confidence={agentConfidence}
            threshold={confidenceThreshold}
          />

          {/* Status summary */}
          <div className="rounded-md border px-3 py-2 text-sm">
            {agentConfidence >= confidenceThreshold ? (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confianca acima do threshold. Aprovacao recomendada.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Confianca abaixo do threshold. Revisao recomendada.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleDecision("review_requested")}
            disabled={createEvent.isPending}
            className="gap-1.5 border-blue-500/40 text-blue-700 hover:bg-blue-500/10 dark:text-blue-400"
          >
            <Eye className="h-4 w-4" />
            Revisar antes
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDecision("approval_denied")}
            disabled={createEvent.isPending}
            className="gap-1.5 border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400"
          >
            <XCircle className="h-4 w-4" />
            Rejeitar
          </Button>
          <Button
            onClick={() => handleDecision("approval_granted")}
            disabled={createEvent.isPending}
            className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aprovar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// EscalationBanner
// ----------------------------------------------------------------

export interface EscalationBannerProps {
  projectId: string;
}

export function EscalationBanner({ projectId }: EscalationBannerProps) {
  const { data: eventsData } = useDelegationEvents(projectId, {
    event_type: "escalated",
    limit: 10,
  });
  const createEvent = useCreateDelegationEvent(projectId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const escalations = (eventsData?.events ?? []).filter(
    (e) => !dismissed.has(e.id)
  );

  if (escalations.length === 0) return null;

  // Show the oldest (most urgent) unresolved escalation
  const escalation = escalations[escalations.length - 1]!;
  const urgency = urgencyFromTime(escalation.created_at);
  const badge = URGENCY_BADGE[urgency];
  const phaseLabel = PHASE_LABELS[escalation.phase] ?? escalation.phase;

  async function handleAction(eventType: DelegationEventType) {
    await createEvent.mutateAsync({
      phase: escalation.phase,
      event_type: eventType,
      agent_confidence: escalation.agent_confidence,
      details: `Acao via escalation banner: ${eventType}`,
    });
    setDismissed((prev) => new Set([...prev, escalation.id]));
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        urgency === "red"
          ? "border-red-500/50 bg-red-500/10"
          : urgency === "yellow"
            ? "border-yellow-500/50 bg-yellow-500/10"
            : "border-orange-500/50 bg-orange-500/10"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AlertTriangle
            className={cn(
              "h-4 w-4 shrink-0",
              urgency === "red"
                ? "text-red-500"
                : urgency === "yellow"
                  ? "text-yellow-500"
                  : "text-orange-500"
            )}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                Escalacao pendente — {phaseLabel}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                  badge.className
                )}
              >
                {badge.label}
              </span>
              {escalations.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  (+{escalations.length - 1} mais)
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Confianca: {Math.round(escalation.agent_confidence * 100)}%
              {escalation.details ? ` — ${escalation.details}` : ""}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("review_requested")}
            disabled={createEvent.isPending}
            className="h-7 gap-1 text-xs"
          >
            <Eye className="h-3 w-3" />
            Revisar output
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("approval_granted")}
            disabled={createEvent.isPending}
            className="h-7 gap-1 text-xs border-green-500/40 text-green-700 hover:bg-green-500/10 dark:text-green-400"
          >
            <CheckCircle2 className="h-3 w-3" />
            Aprovar mesmo assim
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("approval_denied")}
            disabled={createEvent.isPending}
            className="h-7 gap-1 text-xs border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400"
          >
            <XCircle className="h-3 w-3" />
            Rejeitar e re-executar
          </Button>
        </div>
      </div>
    </div>
  );
}
