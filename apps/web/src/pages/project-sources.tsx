import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { FileText, Plus, Search } from "lucide-react";
import { useSources, useUpdateSource, type Source, type SourceCategory } from "@/hooks/use-sources";
import { useSourceDensity } from "@/hooks/use-context-density";
import { SourceCard, SourceGridSkeleton } from "@/components/source-card";
import { CodebaseGraphSourceCard } from "@/components/codebase-graph-source-card";
// import { SourceViewerSheet } from "@/components/source-viewer-sheet";
import { SourceSettingsSheet } from "@/components/source-settings-sheet";
import { AddSourceDialog } from "@/components/add-source-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";

const SOURCE_TYPES: { value: Source["type"] | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Text" },
  { value: "pdf", label: "PDF" },
  { value: "url", label: "URL" },
  { value: "code", label: "Code" },
  { value: "codebase_graph", label: "Codebase Graph" },
];

type SortKey = "default" | "density" | "tokens" | "usage" | "relevance";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "density", label: "Density" },
  { value: "tokens", label: "Tokens" },
  { value: "usage", label: "Usage" },
  { value: "relevance", label: "Relevance" },
];

export function ProjectSourcesPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/sources",
  });
  const { data: sources, isLoading, isError, error } = useSources(projectId);
  const { data: densityMetrics } = useSourceDensity(projectId);
  const updateSource = useUpdateSource(projectId);
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Source["type"] | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsSource, setSettingsSource] = useState<Source | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const densityMap = useMemo(() => {
    if (!densityMetrics) return new Map();
    return new Map(densityMetrics.map((d) => [d.source_id, d]));
  }, [densityMetrics]);

  const handleSourceClick = (source: Source) => {
    setSelectedSourceId(source.id);
    setViewerOpen(true);
  };

  const handleConfigureContext = (source: Source) => {
    setSettingsSource(source);
    setSettingsOpen(true);
  };

  const handleSaveSettings = (sourceId: string, updates: {
    category: SourceCategory;
    pinned: boolean;
    auto_include: boolean;
    relevance_tags: string[];
  }) => {
    updateSource.mutate({ id: sourceId, ...updates }, {
      onSuccess: () => setSettingsOpen(false),
    });
  };

  const filtered = useMemo(() => {
    if (!sources) return [];
    let result = sources;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }

    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }

    if (sortBy !== "default" && densityMetrics) {
      result = [...result].sort((a, b) => {
        const ma = densityMap.get(a.id);
        const mb = densityMap.get(b.id);
        if (sortBy === "density") {
          return (mb?.information_density ?? 0) - (ma?.information_density ?? 0);
        }
        if (sortBy === "tokens") {
          return (mb?.token_count ?? 0) - (ma?.token_count ?? 0);
        }
        if (sortBy === "usage") {
          return (mb?.usage_count ?? 0) - (ma?.usage_count ?? 0);
        }
        if (sortBy === "relevance") {
          return (mb?.relevance_score ?? 0) - (ma?.relevance_score ?? 0);
        }
        return 0;
      });
    }

    return result;
  }, [sources, search, typeFilter, sortBy, densityMetrics, densityMap]);

  const hasNoSources = !isLoading && !isError && sources && sources.length === 0;
  const hasNoResults = !isLoading && !isError && sources && sources.length > 0 && filtered.length === 0;

  return (
    <div className="relative flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sources</h1>
          <p className="text-sm text-muted-foreground">
            Reference materials and documents
          </p>
        </div>
        {!isMobile && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Source
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      {!hasNoSources && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as Source["type"] | "all")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && <SourceGridSkeleton />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load sources: {error.message}
        </div>
      )}

      {/* Empty State - no sources at all */}
      {hasNoSources && (
        <EmptyState
          icon={FileText}
          title="No sources yet"
          description="Add reference materials, documents, or notes to provide context for your AI conversations."
          actionLabel="Add Source"
          onAction={() => setAddDialogOpen(true)}
          className="min-h-[50vh]"
        />
      )}

      {/* No results from filtering */}
      {hasNoResults && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No sources match your search or filters.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((source) =>
            source.type === "codebase_graph" ? (
              <CodebaseGraphSourceCard key={source.id} source={source} />
            ) : (
              <SourceCard
                key={source.id}
                source={source}
                onClick={handleSourceClick}
                onConfigureContext={handleConfigureContext}
                densityMetrics={densityMap.get(source.id)}
              />
            )
          )}
        </div>
      )}

      {/* FAB for mobile */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Add Source"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Source viewer/editor sheet - TODO: implement SourceViewerSheet component */}
      {/* <SourceViewerSheet
        sourceId={selectedSourceId}
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open);
          if (!open) setSelectedSourceId(null);
        }}
      /> */}

      {/* Add source dialog */}
      <AddSourceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        projectSlug={projectId}
      />

      {/* Source settings sheet */}
      <SourceSettingsSheet
        source={settingsSource}
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSource(null);
        }}
        onSave={handleSaveSettings}
        saving={updateSource.isPending}
      />
    </div>
  );
}
