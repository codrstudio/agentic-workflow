import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePatchCognitiveDebtGate } from "@/hooks/use-cognitive-debt";
import type { ComprehensionGate, AutoDetectedRisk } from "@/hooks/use-cognitive-debt";

// ---- Helpers ----

const RISK_BADGE: Record<
  AutoDetectedRisk,
  { label: string; className: string }
> = {
  low: {
    label: "low",
    className:
      "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  },
  medium: {
    label: "medium",
    className:
      "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  },
  high: {
    label: "high",
    className:
      "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  },
};

const LOAD_LABELS: Record<number, string> = {
  1: "Tranquilo",
  2: "Ok",
  3: "Moderado",
  4: "Pesado",
  5: "Perdido",
};

// ---- CognitiveLoadSlider ----

interface CognitiveLoadSliderProps {
  value: number;
  onChange: (v: number) => void;
}

function CognitiveLoadSlider({ value, onChange }: CognitiveLoadSliderProps) {
  const pct = ((value - 1) / 4) * 100;
  const trackColor =
    value <= 2
      ? "accent-green-500"
      : value === 3
        ? "accent-yellow-500"
        : "accent-red-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>1 — Tranquilo</span>
        <span className="font-medium text-foreground">
          {value} — {LOAD_LABELS[value]}
        </span>
        <span>5 — Perdido</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted", trackColor)}
        style={{
          background: `linear-gradient(to right, ${
            value <= 2 ? "#22c55e" : value === 3 ? "#eab308" : "#ef4444"
          } 0%, ${
            value <= 2 ? "#22c55e" : value === 3 ? "#eab308" : "#ef4444"
          } ${pct}%, hsl(var(--muted)) ${pct}%, hsl(var(--muted)) 100%)`,
        }}
      />
      <div className="flex justify-between">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "text-xs w-6 h-6 rounded-full border transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground font-bold"
                : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- ComprehensionGateModal ----

export interface ComprehensionGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  gate: ComprehensionGate;
  onDone?: (gate: ComprehensionGate) => void;
}

export function ComprehensionGateModal({
  open,
  onOpenChange,
  projectId,
  gate,
  onDone,
}: ComprehensionGateModalProps) {
  const [response, setResponse] = useState(gate.response ?? "");
  const [cognitiveLoad, setCognitiveLoad] = useState<number>(
    gate.cognitive_load_score ?? 3,
  );
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);

  const patchGate = usePatchCognitiveDebtGate(projectId);

  const riskBadge = RISK_BADGE[gate.auto_detected_risk];

  async function handleConfirm() {
    const updated = await patchGate.mutateAsync({
      gateId: gate.id,
      body: {
        response: response.trim() || undefined,
        cognitive_load_score: cognitiveLoad,
        completed: true,
        completed_at: new Date().toISOString(),
      },
    });
    onDone?.(updated);
    onOpenChange(false);
  }

  async function handleBypassConfirm() {
    const updated = await patchGate.mutateAsync({
      gateId: gate.id,
      body: {
        bypassed: true,
        completed_at: new Date().toISOString(),
      },
    });
    setBypassDialogOpen(false);
    onDone?.(updated);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Comprehension Check
              <span className="text-muted-foreground font-normal text-sm">
                — {gate.phase}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Risk level badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Cognitive risk:
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold",
                  riskBadge.className,
                )}
              >
                {riskBadge.label}
              </span>
            </div>

            {/* Comprehension question */}
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-sm leading-relaxed">{gate.prompt}</p>
            </div>

            {/* Response textarea */}
            <div className="space-y-1.5">
              <Label htmlFor="comprehension-response" className="text-sm">
                Sua resposta
              </Label>
              <Textarea
                id="comprehension-response"
                placeholder="Descreva o que foi implementado e seu entendimento..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Cognitive load slider */}
            <div className="space-y-1.5">
              <Label className="text-sm">Cognitive Load</Label>
              <CognitiveLoadSlider
                value={cognitiveLoad}
                onChange={setCognitiveLoad}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setBypassDialogOpen(true)}
              disabled={patchGate.isPending}
              className="gap-1.5 border-orange-500/40 text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 sm:order-first"
            >
              Bypass
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={patchGate.isPending}
              className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
            >
              {patchGate.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bypass warning dialog */}
      <AlertDialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-orange-500" />
              Bypass do Comprehension Gate
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao fazer bypass, voce pula a verificacao de compreensao desta
              fase. Isso aumenta o cognitive debt e sera registrado nos
              indicadores. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={patchGate.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBypassConfirm}
              disabled={patchGate.isPending}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {patchGate.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar Bypass
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
