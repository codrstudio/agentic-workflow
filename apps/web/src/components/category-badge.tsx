import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceCategory } from "@/hooks/use-sources";

const categoryStyles: Record<SourceCategory, string> = {
  general: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  frontend: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  backend: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  business: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
  reference: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  config: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const categoryLabels: Record<SourceCategory, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  business: "Business",
  reference: "Reference",
  config: "Config",
};

interface CategoryBadgeProps {
  category: SourceCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0 font-medium",
        categoryStyles[category],
        className,
      )}
    >
      {categoryLabels[category]}
    </Badge>
  );
}
