import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { Package, Plus, Search } from "lucide-react";
import { useArtifacts, type ArtifactType } from "@/hooks/use-artifacts";
import { ArtifactCard, ArtifactGridSkeleton } from "@/components/artifact-card";
import { ArtifactViewerSheet } from "@/components/artifact-viewer-sheet";
import { CreateArtifactDialog } from "@/components/create-artifact-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type QuickTab = "all" | "documents" | "code" | "data";

const QUICK_TABS: { value: QuickTab; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "documents", label: "Documentos" },
  { value: "code", label: "Codigo" },
  { value: "data", label: "Dados" },
];

const TAB_TYPE_MAP: Record<QuickTab, ArtifactType[] | null> = {
  all: null,
  documents: ["document"],
  code: ["code"],
  data: ["json", "config", "diagram"],
};

const ORIGIN_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All origins" },
  { value: "chat", label: "Chat" },
  { value: "harness", label: "Harness" },
  { value: "manual", label: "Manual" },
];

export function ProjectArtifactsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/artifacts",
  });
  const { data: artifacts, isLoading, isError, error } = useArtifacts(projectId);
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<QuickTab>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!artifacts) return [];
    let result = artifacts;

    // Quick tab filter
    const allowedTypes = TAB_TYPE_MAP[activeTab];
    if (allowedTypes) {
      result = result.filter((a) => allowedTypes.includes(a.type));
    }

    // Search by name
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }

    // Origin filter
    if (originFilter !== "all") {
      result = result.filter((a) => a.origin === originFilter);
    }

    return result;
  }, [artifacts, search, activeTab, originFilter]);

  const hasNoArtifacts =
    !isLoading && !isError && artifacts && artifacts.length === 0;
  const hasNoResults =
    !isLoading &&
    !isError &&
    artifacts &&
    artifacts.length > 0 &&
    filtered.length === 0;

  return (
    <div className="relative flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Artifacts</h1>
          <p className="text-sm text-muted-foreground">
            Documents, code, and structured data produced by your workflow
          </p>
        </div>
        {!isMobile && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Criar Artifact
          </Button>
        )}
      </div>

      {/* Quick tabs */}
      {!hasNoArtifacts && (
        <div className="flex gap-1 overflow-x-auto border-b">
          {QUICK_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      {!hasNoArtifacts && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search artifacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {ORIGIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && <ArtifactGridSkeleton />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load artifacts: {error.message}
        </div>
      )}

      {/* Empty State - no artifacts at all */}
      {hasNoArtifacts && (
        <EmptyState
          icon={Package}
          title="No artifacts yet"
          description="Artifacts are documents, code, and data produced by your AI conversations or created manually."
          actionLabel="Criar Artifact"
          onAction={() => setCreateOpen(true)}
          className="min-h-[50vh]"
        />
      )}

      {/* No results from filtering */}
      {hasNoResults && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No artifacts match your search or filters.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onClick={(a) => {
                setSelectedArtifactId(a.id);
                setSheetOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* FAB for mobile */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Criar Artifact"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Create artifact dialog */}
      <CreateArtifactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectSlug={projectId}
      />

      {/* Artifact viewer/editor sheet */}
      <ArtifactViewerSheet
        artifactId={selectedArtifactId}
        projectSlug={projectId}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedArtifactId(null);
        }}
      />
    </div>
  );
}
