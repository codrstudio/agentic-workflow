import { useState } from "react";
import { CheckCircle, XCircle, Loader2, ShieldAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  GateTransition,
  GateStatus,
  CheckResult,
  QualityGate,
} from "@/hooks/use-quality-gates";
import {
  resolveGateStatus,
  useQualityGate,
  useEvaluateGate,
  useOverrideGate,
} from "@/hooks/use-quality-gates";

const TRANSITION_LABELS: Record<GateTransition, string> = {
  brainstorming_to_specs: "Brainstorming \u2192 Specs",
  specs_to_prps: "Specs \u2192 PRPs",
  prps_to_features: "PRPs \u2192 Features",
};

const STATUS_BADGE: Record<GateStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  passing: { label: "Passing", variant: "default" },
  failing: { label: "Failing", variant: "destructive" },
  not_evaluated: { label: "Nao avaliado", variant: "secondary" },
  overridden: { label: "Override", variant: "outline" },
};

interface GateDetailSheetProps {
  projectSlug: string;
  sprintNumber: number;
  transition: GateTransition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GateDetailSheet({
  projectSlug,
  sprintNumber,
  transition,
  open,
  onOpenChange,
}: GateDetailSheetProps) {
  const { data: gate } = useQualityGate(projectSlug, sprintNumber, transition);
  const evaluateMutation = useEvaluateGate(projectSlug, sprintNumber);
  const overrideMutation = useOverrideGate(projectSlug, sprintNumber);

  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  if (!transition) return null;

  const status: GateStatus = gate ? resolveGateStatus(gate) : "not_evaluated";
  const checks: CheckResult[] = gate?.checks ?? [];
  const badgeConfig = STATUS_BADGE[status];

  const handleEvaluate = () => {
    evaluateMutation.mutate(transition);
  };

  const handleOverrideConfirm = () => {
    if (!overrideReason.trim()) return;
    overrideMutation.mutate(
      { transition, reason: overrideReason.trim() },
      {
        onSuccess: () => {
          setOverrideDialogOpen(false);
          setOverrideReason("");
        },
      },
    );
  };

  const hasFailingChecks = checks.some((c) => !c.passed);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {TRANSITION_LABELS[transition]}
              <Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>
            </SheetTitle>
            <SheetDescription>
              {gate?.evaluated_at
                ? `Avaliado em ${new Date(gate.evaluated_at).toLocaleString("pt-BR")}`
                : "Gate ainda nao avaliado"}
            </SheetDescription>
            {gate?.overridden && gate.override_reason && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0 text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">Override ativo</p>
                  <p className="text-muted-foreground">{gate.override_reason}</p>
                </div>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            {checks.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum check disponivel. Clique em &quot;Avaliar&quot; para executar.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {checks.map((check) => (
                <CheckCard key={check.id} check={check} />
              ))}
            </div>
          </div>

          <SheetFooter>
            {status === "passing" && !hasFailingChecks && checks.length > 0 ? (
              <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
                Pronto para avancar
              </p>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleEvaluate}
                  disabled={evaluateMutation.isPending}
                >
                  {evaluateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Avaliar novamente
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setOverrideDialogOpen(true)}
                  disabled={overrideMutation.isPending}
                >
                  Override
                </Button>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override do gate</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo para fazer override deste gate. O gate sera marcado
              como &quot;overridden&quot; e permitira o avanco.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            placeholder="Motivo do override..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className="min-h-[80px]"
          />

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOverrideReason("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideConfirm}
              disabled={!overrideReason.trim() || overrideMutation.isPending}
            >
              {overrideMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CheckCard({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => check.details && setExpanded(!expanded)}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        check.passed
          ? "border-green-500/20 bg-green-500/5"
          : "border-red-500/20 bg-red-500/5",
        check.details && "cursor-pointer hover:bg-accent/50",
      )}
    >
      <div className="flex items-start gap-2">
        {check.passed ? (
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{check.description}</p>
          <p className="text-xs text-muted-foreground">
            {check.check_type} &middot; {check.target}
          </p>
          {!check.passed && check.details && expanded && (
            <p className="mt-2 rounded border bg-background p-2 text-xs text-red-600 dark:text-red-400">
              {check.details}
            </p>
          )}
          {!check.passed && check.details && !expanded && (
            <p className="mt-1 text-xs text-muted-foreground">
              Clique para ver detalhes
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
