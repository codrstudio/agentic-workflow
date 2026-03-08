import { useState, useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { FileText, Search, Plus, Upload } from "lucide-react";
import { useSpecs, useCreateSpec, type SpecDocument, type SpecStatus } from "@/hooks/use-specs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "implementing", label: "Implementing" },
  { value: "completed", label: "Completed" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_COLORS: Record<SpecStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  review: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  implementing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  superseded: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function SpecListPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/specs",
  });
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const apiFilters =
    statusFilter !== "all" ? { status: statusFilter } : undefined;
  const { data: specs, isLoading, isError, error } = useSpecs(projectId, apiFilters);
  const createMutation = useCreateSpec(projectId);

  const filtered = useMemo(() => {
    if (!specs) return [];
    const q = search.trim().toLowerCase();
    if (!q) return specs;
    return specs.filter(
      (s) =>
        s.slug.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [specs, search]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const doc = await createMutation.mutateAsync({ title: newTitle.trim() });
    setCreating(false);
    setNewTitle("");
    navigate({
      to: "/projects/$projectId/specs/$specId",
      params: { projectId, specId: doc.id },
    });
  }

  return (
    <div className="relative flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Specs</h1>
          <p className="text-sm text-muted-foreground">
            Specification documents driving feature development
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {/* import markdown — placeholder */}}
          >
            <Upload className="h-4 w-4" />
            Importar Markdown
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
            Nova Spec
          </Button>
        </div>
      </div>

      {/* Inline create form */}
      {creating && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <Input
            autoFocus
            placeholder="Título da spec..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewTitle(""); }
            }}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newTitle.trim() || createMutation.isPending}
          >
            Criar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setCreating(false); setNewTitle(""); }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar specs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load specs: {error.message}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && specs && specs.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No specs found"
          description="Specification documents define features and guide implementation."
          className="min-h-[50vh]"
        />
      )}

      {/* No results */}
      {!isLoading && !isError && specs && specs.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No specs match your search or filters.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Título</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Features</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Review Score</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((spec) => (
                <SpecRow
                  key={spec.id}
                  spec={spec}
                  onClick={() =>
                    navigate({
                      to: "/projects/$projectId/specs/$specId",
                      params: { projectId, specId: spec.id },
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SpecRow({ spec, onClick }: { spec: SpecDocument; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b transition-colors hover:bg-muted/30 last:border-b-0"
    >
      <td className="px-4 py-3 font-mono text-xs font-semibold">{spec.slug}</td>
      <td className="px-4 py-3 font-medium max-w-xs truncate">{spec.title}</td>
      <td className="px-4 py-3">
        <SpecStatusBadge status={spec.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {spec.derived_features.length > 0 ? (
          <Badge variant="secondary">{spec.derived_features.length}</Badge>
        ) : (
          <span className="text-xs">0</span>
        )}
      </td>
      <td className="px-4 py-3">
        {spec.review_score !== null ? (
          <ReviewScoreBadge score={spec.review_score} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(spec.updated_at).toLocaleDateString()}
      </td>
    </tr>
  );
}

export function SpecStatusBadge({ status }: { status: SpecStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status],
      )}
    >
      {status}
    </span>
  );
}

export function ReviewScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      : score >= 60
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        color,
      )}
    >
      {score}/100
    </span>
  );
}
