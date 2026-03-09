import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const FEEDBACK_REASONS = [
  { value: "resposta_incorreta", label: "Resposta incorreta" },
  { value: "sem_contexto", label: "Sem contexto" },
  { value: "incompleta", label: "Incompleta" },
  { value: "tom_inadequado", label: "Tom inadequado" },
  { value: "outro", label: "Outro" },
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["value"];

interface FeedbackReasonPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (reason: FeedbackReason) => void;
  children: React.ReactNode;
}

export function FeedbackReasonPopover({
  open,
  onOpenChange,
  onSelect,
  children,
}: FeedbackReasonPopoverProps) {
  const [selected, setSelected] = useState<FeedbackReason | null>(null);

  function handleConfirm() {
    if (!selected) return;
    onSelect(selected);
    setSelected(null);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(null);
    onOpenChange(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent className="w-52 p-3" align="start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Motivo da avaliação negativa
        </p>
        <div className="flex flex-col gap-1">
          {FEEDBACK_REASONS.map((reason) => (
            <button
              key={reason.value}
              type="button"
              onClick={() => setSelected(reason.value)}
              className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                selected === reason.value
                  ? "bg-accent font-medium"
                  : "text-foreground"
              }`}
            >
              {reason.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={!selected}
          onClick={handleConfirm}
        >
          Confirmar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
