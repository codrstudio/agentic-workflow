import { useEffect, useRef } from "react";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionTimerStore } from "@/stores/session-timer.store";
import { useGuardrails, GUARDRAILS_DEFAULTS } from "@/hooks/use-guardrails";

export function BreakReminder({ projectSlug }: { projectSlug: string }) {
  const { data: guardrails } = useGuardrails(projectSlug);
  const intervalMinutes =
    guardrails?.break_reminder_interval ??
    GUARDRAILS_DEFAULTS.break_reminder_interval;

  const lastBreakReminderAt = useSessionTimerStore(
    (s) => s.lastBreakReminderAt,
  );
  const breakRemindersDisabledToday = useSessionTimerStore(
    (s) => s.breakRemindersDisabledToday,
  );
  const disabledDate = useSessionTimerStore((s) => s.disabledDate);
  const breakReminderVisible = useSessionTimerStore(
    (s) => s.breakReminderVisible,
  );
  const showBreakReminder = useSessionTimerStore((s) => s.showBreakReminder);
  const dismissBreakReminder = useSessionTimerStore(
    (s) => s.dismissBreakReminder,
  );
  const disableBreakRemindersToday = useSessionTimerStore(
    (s) => s.disableBreakRemindersToday,
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if disabled date is still today
  const isDisabledToday =
    breakRemindersDisabledToday &&
    disabledDate === new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isDisabledToday) return;

    const intervalMs = intervalMinutes * 60 * 1000;

    // Check every 30 seconds if it's time to show the reminder
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastBreakReminderAt;
      if (elapsed >= intervalMs) {
        showBreakReminder();
      }
    }, 30_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMinutes, lastBreakReminderAt, isDisabledToday, showBreakReminder]);

  if (!breakReminderVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto animate-in fade-in duration-500 max-w-sm w-full mx-4">
        <div className="rounded-xl border bg-card shadow-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Coffee className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Hora de uma pausa</h3>
              <p className="text-xs text-muted-foreground">
                Voce esta trabalhando ha {intervalMinutes} minutos
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Pausas regulares ajudam a manter o foco e prevenir fadiga. Que tal
            se levantar, alongar ou tomar um cafe?
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={disableBreakRemindersToday}
            >
              Desativar hoje
            </Button>
            <Button variant="ghost" size="sm" onClick={dismissBreakReminder}>
              Continuar
            </Button>
            <Button size="sm" onClick={dismissBreakReminder}>
              Fazer pausa
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
