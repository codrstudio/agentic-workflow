import { useState, useMemo } from "react";
import { FileText, Code, Link, FileType, File, Settings, ChevronDown, ChevronRight, Pin } from "lucide-react";
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
import { ManageProfilesDialog } from "@/components/manage-profiles-dialog";
import type { Source, SourceCategory } from "@/hooks/use-sources";
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
  profiles: ContextProfile[];
  selectedProfileId: string | null;
  onProfileChange: (profileId: string | null) => void;
}

function estimateTokens(sources: Source[], selectedIds: string[]): number {
  return sources
    .filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + Math.ceil(s.size_bytes / 4), 0);
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `~${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `~${(tokens / 1_000).toFixed(1)}k`;
  return `~${tokens}`;
}

function getTokenBarColor(tokens: number): string {
  if (tokens > 50_000) return "bg-red-500";
  if (tokens >= 20_000) return "bg-yellow-500";
  return "bg-green-500";
}

function TokenEstimator({ tokens }: { tokens: number }) {
  const maxTokens = 80_000; // scale reference for the bar
  const percentage = Math.min((tokens / maxTokens) * 100, 100);
  const barColor = getTokenBarColor(tokens);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTokenCount(tokens)} tokens estimados</span>
        {tokens > 50_000 && (
          <span className="text-red-500 font-medium">Alto</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SourceItem({
  source,
  checked,
  isPinned,
  onToggle,
}: {
  source: Source;
  checked: boolean;
  isPinned: boolean;
  onToggle: () => void;
}) {
  const Icon = typeIcons[source.type] ?? FileText;

  return (
    <Label
      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50"
    >
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
  );
}

function CategorySection({
  category,
  sources,
  selectedIds,
  onToggle,
}: {
  category: SourceCategory;
  sources: Source[];
  selectedIds: string[];
  onToggle: (id: string) => void;
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
  profiles,
  selectedProfileId,
  onProfileChange,
}: SourceContextSheetProps) {
  const [manageOpen, setManageOpen] = useState(false);

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

  const estimatedTokens = useMemo(
    () => estimateTokens(sources, selectedIds),
    [sources, selectedIds],
  );

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

          {/* Token Estimator */}
          <div className="px-4 pb-3">
            <TokenEstimator tokens={estimatedTokens} />
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
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Categorized sources */}
            {categorizedSources.map(({ category, sources: catSources }) => (
              <CategorySection
                key={category}
                category={category}
                sources={catSources}
                selectedIds={selectedIds}
                onToggle={toggleSource}
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
