import { Shield, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GateStatus, GateTransition } from "@/hooks/use-quality-gates";

interface GateIndicatorProps {
  transition: GateTransition;
  status: GateStatus;
  onClick?: (transition: GateTransition) => void;
}

const statusConfig: Record<
  GateStatus,
  { icon: typeof Shield; color: string; title: string }
> = {
  passing: {
    icon: ShieldCheck,
    color: "text-green-500",
    title: "Gate passing",
  },
  failing: {
    icon: ShieldX,
    color: "text-red-500",
    title: "Gate failing",
  },
  not_evaluated: {
    icon: Shield,
    color: "text-muted-foreground",
    title: "Gate not evaluated",
  },
  overridden: {
    icon: ShieldAlert,
    color: "text-yellow-500",
    title: "Gate overridden",
  },
};

export function GateIndicator({ transition, status, onClick }: GateIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => onClick?.(transition)}
      className={cn(
        "flex items-center justify-center",
        "h-6 w-6 rounded-full",
        "hover:bg-accent transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "cursor-pointer shrink-0"
      )}
      title={config.title}
    >
      <Icon className={cn("h-3.5 w-3.5", config.color)} />
    </button>
  );
}
