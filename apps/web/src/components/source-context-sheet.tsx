import { useState, useMemo, useEffect, useCallback } from "react";
import { FileText, Code, Link, FileType, File, Settings, ChevronDown, ChevronRight, Pin, Sparkles, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/category-badge";
import { ContextBudgetBar } from "@/components/context-budget-bar";
import { ManageProfilesDialog } from "@/components/manage-profiles-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRecommendedSources, useCompressSource } from "@/hooks/use-sources";
import type { Source, SourceCategory, RecommendedSource, CompressionResult } from "@/hooks/use-sources";
import type { ContextProfile } from "@/hooks/use-context-profiles";

const typeIcons: Record<Source["type"], React.ComponentType<{ className?: string }>> = {
  markdown: FileText,
  text: FileType,
  pdf: File,
  url: Link,
  code: Code,
};

const CATEGORY_ORDER: SourceCategory[] = [
  "business",
  "backend",
  "frontend",
  "config",
  "reference",
  "general",
];

interface SourceContextSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: Source[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  projectSlug: string;
  sessionId: string | null;
  profiles: ContextProfile[];
  selectedProfileId: string | null;
  onProfileChange: (profileId: string | null) => void;
  compressedIds: string[];
  onCompressedIdsChange: (ids: string[]) => void;
  budget?: number;
}

function getRelevanceLevel(relevance: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (relevance >= 0.7) return { label: "Alta", variant: "default" };
  if (relevance >= 0.4) return { label: "Media", variant: "secondary" };
  return { label: "Baixa", variant: "outline" };
}

function RecommendedSourceItem({
  source,
  recommendation,
  checked,
  onToggle,
}: {
  source: Source;
  recommendation: RecommendedSource;
  checked: boolean;
  onToggle: () => void;
}) {
  const Icon = typeIcons[source.type] ?? FileText;
  const { label, variant } = getRelevanceLevel(recommendation.relevance);

  return (
    <Label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm">{source.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {recommendation.reason}
        </span>
      </div>
      <Badge variant={variant} className="shrink-0 text-[10px]">
        {label}
      </Badge>
    </Label>
  );
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `~${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `~${(tokens / 1_000).toFixed(1)}k`;
  return `~${tokens}`;
}

function CompressionToggle({
  source,
  isCompressed,
  compressionData,
  onToggle,
  isLoading,
}: {
  source: Source;
  isCompressed: boolean;
  compressionData: CompressionResult | null;
  onToggle: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 ml-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle();
              }}
              disabled={isLoading}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                isCompressed
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              } ${isLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
            >
              <Minimize2 className="h-3 w-3" />
              {isLoading ? "..." : "Comprimir"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">
              Compressao remove paragrafos explanatorios, mantendo headings, code blocks, tables e listas.
              Reduz tokens enviados ao AI sem perder informacao estrutural.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {isCompressed && compressionData && (
        <span className="text-[10px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
          {formatTokenCount(compressionData.original_tokens)} → {formatTokenCount(compressionData.compressed_tokens)}
          {" "}({Math.round((1 - compressionData.compressed_tokens / compressionData.original_tokens) * 100)}%)
        </span>
      )}
    </div>
  );
}

function SourceItem({
  source,
  checked,
  isPinned,
  onToggle,
  isCompressed,
  compressionData,
  onCompressionToggle,
  isCompressing,
}: {
  source: Source;
  checked: boolean;
  isPinned: boolean;
  onToggle: () => void;
  isCompressed: boolean;
  compressionData: CompressionResult | null;
  onCompressionToggle: () => void;
  isCompressing: boolean;
}) {
  const Icon = typeIcons[source.type] ?? FileText;

  return (
    <div className="rounded-md px-2 py-2.5 hover:bg-muted/50">
      <Label className="flex cursor-pointer items-center gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={isPinned ? undefined : onToggle}
          disabled={isPinned}
          className={isPinned ? "opacity-50 cursor-not-allowed" : ""}
        />
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {source.name}
        </span>
        {isPinned && (
          <Pin className="h-3 w-3 shrink-0 text-amber-500" />
        )}
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {source.type}
        </Badge>
      </Label>
      {checked && (
        <div className="ml-7 mt-1">
          <CompressionToggle
            source={source}
            isCompressed={isCompressed}
            compressionData={compressionData}
            onToggle={onCompressionToggle}
            isLoading={isCompressing}
          />
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  sources,
  selectedIds,
  onToggle,
  compressedIds,
  compressionData,
  compressingIds,
  onCompressionToggle,
}: {
  category: SourceCategory;
  sources: Source[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  compressedIds: string[];
  compressionData: Record<string, CompressionResult>;
  compressingIds: string[];
  onCompressionToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const selectedCount = sources.filter((s) => selectedIds.includes(s.id)).length;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <CategoryBadge category={category} />
        <span className="text-xs text-muted-foreground ml-auto">
          {selectedCount}/{sources.length}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 pl-2">
          {sources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              checked={selectedIds.includes(source.id)}
              isPinned={source.pinned}
              onToggle={() => onToggle(source.id)}
              isCompressed={compressedIds.includes(source.id)}
              compressionData={compressionData[source.id] ?? null}
              onCompressionToggle={() => onCompressionToggle(source.id)}
              isCompressing={compressingIds.includes(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SourceContextSheet({
  open,
  onOpenChange,
  sources,
  selectedIds,
  onSelectionChange,
  projectSlug,
  sessionId,
  profiles,
  selectedProfileId,
  onProfileChange,
  compressedIds,
  onCompressedIdsChange,
  budget,
}: SourceContextSheetProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const { data: recommendedSources } = useRecommendedSources(projectSlug, sessionId);
  const [recommendedApplied, setRecommendedApplied] = useState(false);
  const [compressionData, setCompressionData] = useState<Record<string, CompressionResult>>({});
  const [compressingIds, setCompressingIds] = useState<string[]>([]);
  const compressSource = useCompressSource(projectSlug);

  const handleCompressionToggle = useCallback((sourceId: string) => {
    if (compressedIds.includes(sourceId)) {
      // Deactivate compression
      onCompressedIdsChange(compressedIds.filter((id) => id !== sourceId));
      return;
    }

    // If we already have compression data, just activate
    if (compressionData[sourceId]) {
      onCompressedIdsChange([...compressedIds, sourceId]);
      return;
    }

    // Fetch compression estimate
    setCompressingIds((prev) => [...prev, sourceId]);
    compressSource.mutate(
      { sourceId },
      {
        onSuccess: (result) => {
          setCompressionData((prev) => ({ ...prev, [sourceId]: result }));
          onCompressedIdsChange([...compressedIds, sourceId]);
          setCompressingIds((prev) => prev.filter((id) => id !== sourceId));
        },
        onError: () => {
          setCompressingIds((prev) => prev.filter((id) => id !== sourceId));
        },
      }
    );
  }, [compressedIds, compressionData, compressSource, onCompressedIdsChange]);

  // Filter to sources with relevance > 0 and matching an existing source
  const recommendations = useMemo(() => {
    if (!recommendedSources || !sources.length) return [];
    return recommendedSources
      .filter((r) => r.relevance > 0 && sources.some((s) => s.id === r.source_id))
      .slice(0, 10);
  }, [recommendedSources, sources]);

  // Pre-select recommended sources on first load
  useEffect(() => {
    if (recommendedApplied || recommendations.length === 0) return;
    const recIds = recommendations.map((r) => r.source_id);
    const merged = [...new Set([...selectedIds, ...recIds])];
    if (merged.length !== selectedIds.length) {
      onSelectionChange(merged);
    }
    setRecommendedApplied(true);
  }, [recommendations, recommendedApplied, selectedIds, onSelectionChange]);

  // Separate pinned sources and group rest by category
  const pinnedSources = useMemo(
    () => sources.filter((s) => s.pinned),
    [sources],
  );

  const categorizedSources = useMemo(() => {
    const nonPinned = sources.filter((s) => !s.pinned);
    const groups: Partial<Record<SourceCategory, Source[]>> = {};
    for (const source of nonPinned) {
      const cat = source.category ?? "general";
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(source);
    }
    // Return in category order, only non-empty groups
    return CATEGORY_ORDER
      .filter((cat) => groups[cat] && groups[cat]!.length > 0)
      .map((cat) => ({ category: cat, sources: groups[cat]! }));
  }, [sources]);

  const toggleSource = (id: string) => {
    // Pinned sources cannot be deselected
    const source = sources.find((s) => s.id === id);
    if (source?.pinned) return;

    // When manually toggling, clear profile selection
    onProfileChange(null);
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleProfileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      onProfileChange(null);
      return;
    }
    const profile = profiles.find((p) => p.id === value);
    if (profile) {
      onProfileChange(profile.id);
      // Include profile sources + always include pinned and auto_include
      const pinnedIds = sources.filter((s) => s.pinned || s.auto_include).map((s) => s.id);
      const merged = [...new Set([...profile.source_ids, ...pinnedIds])];
      onSelectionChange(merged);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 sm:max-w-sm flex flex-col">
          <SheetHeader>
            <SheetTitle>Contexto de Sources</SheetTitle>
            <SheetDescription>
              Selecione os sources que o assistente deve usar como contexto.
            </SheetDescription>
          </SheetHeader>

          {/* Profile Selector */}
          <div className="px-4 pb-2 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Perfil de contexto</Label>
            <div className="relative">
              <select
                value={selectedProfileId ?? ""}
                onChange={handleProfileSelect}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm appearance-none cursor-pointer pr-8 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Nenhum (selecao manual)</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-7"
              onClick={() => setManageOpen(true)}
            >
              <Settings className="h-3 w-3 mr-1.5" />
              Gerenciar perfis
            </Button>
          </div>

          {/* Context Budget Bar */}
          <div className="px-4 pb-3">
            <ContextBudgetBar
              sources={sources}
              selectedIds={selectedIds}
              budget={budget ?? 50000}
            />
          </div>

          {/* Sources list */}
          <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4 flex-1">
            {sources.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum source disponivel neste projeto.
              </p>
            )}

            {/* Pinned sources section */}
            {pinnedSources.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Pin className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Fixados ({pinnedSources.length})
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 pl-2">
                  {pinnedSources.map((source) => (
                    <SourceItem
                      key={source.id}
                      source={source}
                      checked={selectedIds.includes(source.id)}
                      isPinned
                      onToggle={() => {}}
                      isCompressed={compressedIds.includes(source.id)}
                      compressionData={compressionData[source.id] ?? null}
                      onCompressionToggle={() => handleCompressionToggle(source.id)}
                      isCompressing={compressingIds.includes(source.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended sources */}
            {recommendations.length > 0 && (
              <>
                <div className="mb-1">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Recomendados ({recommendations.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {recommendations.map((rec) => {
                      const source = sources.find((s) => s.id === rec.source_id);
                      if (!source) return null;
                      return (
                        <RecommendedSourceItem
                          key={rec.source_id}
                          source={source}
                          recommendation={rec}
                          checked={selectedIds.includes(rec.source_id)}
                          onToggle={() => toggleSource(rec.source_id)}
                        />
                      );
                    })}
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="px-2 py-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Todos os sources
                  </span>
                </div>
              </>
            )}

            {/* Categorized sources */}
            {categorizedSources.map(({ category, sources: catSources }) => (
              <CategorySection
                key={category}
                category={category}
                sources={catSources}
                selectedIds={selectedIds}
                onToggle={toggleSource}
                compressedIds={compressedIds}
                compressionData={compressionData}
                compressingIds={compressingIds}
                onCompressionToggle={handleCompressionToggle}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ManageProfilesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        projectSlug={projectSlug}
        profiles={profiles}
        sources={sources}
      />
    </>
  );
}
