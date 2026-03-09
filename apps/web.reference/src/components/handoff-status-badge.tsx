import type { HandoffStatus } from "@/hooks/use-handoff-requests";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  HandoffStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  draft: {
    label: "Rascunho",
    className:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  generating_spec: {
    label: "Gerando Spec",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
    pulse: true,
  },
  spec_ready: {
    label: "Spec Pronta",
    className:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  },
  generating_prp: {
    label: "Gerando PRP",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
    pulse: true,
  },
  prp_ready: {
    label: "PRP Pronto",
    className:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  },
  enqueued: {
    label: "Concluido",
    className:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-red-100 text-red-700 border-red-200 line-through dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  },
};

interface HandoffStatusBadgeProps {
  status: HandoffStatus;
  className?: string;
}

export function HandoffStatusBadge({ status, className }: HandoffStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.className,
        config.pulse && "animate-pulse",
        className,
      )}
    >
      {config.label}
    </span>
  );
}
