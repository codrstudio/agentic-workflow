import type { Source, SourceCategory } from "@/hooks/use-sources";

const CATEGORY_ORDER: SourceCategory[] = [
  "business",
  "backend",
  "frontend",
  "config",
  "reference",
  "general",
];

const CATEGORY_COLORS: Record<SourceCategory, string> = {
  business: "bg-purple-500",
  backend: "bg-green-500",
  frontend: "bg-blue-500",
  config: "bg-slate-500",
  reference: "bg-orange-500",
  general: "bg-gray-400",
};

const CATEGORY_LABELS: Record<SourceCategory, string> = {
  business: "Business",
  backend: "Backend",
  frontend: "Frontend",
  config: "Config",
  reference: "Reference",
  general: "General",
};

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
}

interface CategoryTokens {
  category: SourceCategory;
  tokens: number;
}

function computeCategoryTokens(
  sources: Source[],
  selectedIds: string[]
): CategoryTokens[] {
  const byCategory = new Map<SourceCategory, number>();

  for (const source of sources) {
    if (!selectedIds.includes(source.id)) continue;
    const cat = source.category ?? "general";
    const tokens = Math.ceil(source.size_bytes / 4);
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + tokens);
  }

  return CATEGORY_ORDER
    .filter((cat) => byCategory.has(cat))
    .map((cat) => ({ category: cat, tokens: byCategory.get(cat)! }));
}

interface ContextBudgetBarProps {
  sources: Source[];
  selectedIds: string[];
  budget: number;
}

export function ContextBudgetBar({
  sources,
  selectedIds,
  budget,
}: ContextBudgetBarProps) {
  const categoryTokens = computeCategoryTokens(sources, selectedIds);
  const totalTokens = categoryTokens.reduce((sum, ct) => sum + ct.tokens, 0);
  const percentage = Math.round((totalTokens / budget) * 100);
  const isOverBudget = totalTokens > budget;
  const barMax = Math.max(totalTokens, budget);

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between text-xs">
        <span className={isOverBudget ? "text-red-600 font-semibold" : "text-muted-foreground"}>
          {formatTokenCount(totalTokens)} / {formatTokenCount(budget)} tokens ({percentage}%)
        </span>
        {isOverBudget && (
          <span className="text-red-600 font-medium text-[11px]">
            Excedeu budget
          </span>
        )}
      </div>

      {/* Segmented progress bar */}
      <div
        className={`h-2.5 w-full rounded-full bg-muted overflow-hidden flex ${
          isOverBudget ? "ring-2 ring-red-500 ring-offset-1" : ""
        }`}
      >
        {categoryTokens.map((ct) => {
          const segmentWidth = (ct.tokens / barMax) * 100;
          return (
            <div
              key={ct.category}
              className={`h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full ${CATEGORY_COLORS[ct.category]}`}
              style={{ width: `${segmentWidth}%` }}
              title={`${CATEGORY_LABELS[ct.category]}: ${formatTokenCount(ct.tokens)} tokens`}
            />
          );
        })}
      </div>

      {/* Category legend */}
      {categoryTokens.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {categoryTokens.map((ct) => (
            <div key={ct.category} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[ct.category]}`} />
              <span className="text-[10px] text-muted-foreground">
                {CATEGORY_LABELS[ct.category]} {formatTokenCount(ct.tokens)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
