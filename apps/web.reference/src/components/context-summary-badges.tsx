import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Source, SourceCategory } from "@/hooks/use-sources";

const CATEGORY_ORDER: SourceCategory[] = [
  "business",
  "backend",
  "frontend",
  "config",
  "reference",
  "general",
];

const categoryStyles: Record<SourceCategory, string> = {
  general: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  frontend: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  backend: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  business: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  reference: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  config: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const categoryLabels: Record<SourceCategory, string> = {
  general: "general",
  frontend: "frontend",
  backend: "backend",
  business: "business",
  reference: "reference",
  config: "config",
};

interface ContextSummaryBadgesProps {
  sources: Source[];
  selectedIds: string[];
  onClick?: () => void;
}

export function ContextSummaryBadges({
  sources,
  selectedIds,
  onClick,
}: ContextSummaryBadgesProps) {
  const grouped = useMemo(() => {
    const selected = sources.filter((s) => selectedIds.includes(s.id));
    const map = new Map<SourceCategory, Source[]>();
    for (const s of selected) {
      const cat = s.category ?? "general";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    // Return in priority order, only categories with sources
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, sources: map.get(cat)! }));
  }, [sources, selectedIds]);

  if (grouped.length === 0) return null;

  return (
    <TooltipProvider>
      <div
        className="flex cursor-pointer items-center gap-1 flex-wrap"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick?.();
        }}
      >
        {grouped.map(({ category, sources: catSources }) => (
          <Tooltip key={category}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-medium border-0 ${categoryStyles[category]}`}
              >
                {catSources.length} {categoryLabels[category]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs font-semibold mb-1 capitalize">{categoryLabels[category]}</p>
              <ul className="text-xs space-y-0.5">
                {catSources.map((s) => (
                  <li key={s.id} className="text-muted-foreground">
                    {s.name}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
