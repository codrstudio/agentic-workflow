import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessionTimerStore } from "@/stores/session-timer.store";
import { useGuardrails, GUARDRAILS_DEFAULTS } from "@/hooks/use-guardrails";

export function SessionDurationAlert({
  projectSlug,
}: {
  projectSlug: string;
}) {
  const { data: guardrails } = useGuardrails(projectSlug);
  const limitMinutes =
    guardrails?.session_duration_limit ??
    GUARDRAILS_DEFAULTS.session_duration_limit;

  const sessionStartedAt = useSessionTimerStore((s) => s.sessionStartedAt);
  const sessionAlertDismissed = useSessionTimerStore(
    (s) => s.sessionAlertDismissed,
  );
  const dismissSessionAlert = useSessionTimerStore(
    (s) => s.dismissSessionAlert,
  );

  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsedMinutes(Math.floor((Date.now() - sessionStartedAt) / 60_000));
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  const exceedsLimit = elapsedMinutes >= limitMinutes;
  const exceedsExtended = elapsedMinutes >= limitMinutes * 1.5;

  if (!exceedsLimit || sessionAlertDismissed) return null;

  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  const durationText =
    hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ""}` : `${mins}min`;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-sm border-b animate-in fade-in slide-in-from-top-1 duration-300 ${
        exceedsExtended
          ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800"
          : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
      }`}
    >
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">
        Sessao ativa ha{" "}
        <span className="font-medium">{durationText}</span> (limite:{" "}
        {limitMinutes}min)
      </span>
      <Badge
        variant="outline"
        className={
          exceedsExtended
            ? "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
            : "border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
        }
      >
        {exceedsExtended ? "Muito longa" : "Longa"}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={dismissSessionAlert}
        aria-label="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
