import type { ComplexityLevel } from "@/hooks/use-task-complexity";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LEVEL_CONFIG: Record<
  ComplexityLevel,
  { label: string; color: string; bg: string }
> = {
  trivial: {
    label: "Trivial",
    color: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
  },
  small: {
    label: "Small",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-600",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-100 border-yellow-300 dark:bg-yellow-900 dark:border-yellow-600",
  },
  large: {
    label: "Large",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-100 border-purple-300 dark:bg-purple-900 dark:border-purple-600",
  },
};

interface ComplexityBadgeProps {
  level: ComplexityLevel;
  requiredSections?: string[];
  className?: string;
}

export function ComplexityBadge({
  level,
  requiredSections,
  className,
}: ComplexityBadgeProps) {
  const config = LEVEL_CONFIG[level];

  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        config.bg,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );

  if (!requiredSections || requiredSections.length === 0) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs bg-popover text-popover-foreground border shadow-md"
      >
        <p className="font-semibold mb-1">Secoes obrigatorias:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          {requiredSections.map((section) => (
            <li key={section} className="text-xs">
              {section}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
