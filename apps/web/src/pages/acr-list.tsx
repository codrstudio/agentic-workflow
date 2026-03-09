import { useState, useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { Shield, Search, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useACRs, type ACR, type ACRStatus, type ACRCategory, type ACRViolation, acrKeys } from "@/hooks/use-acrs";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { ACRFormDialog } from "@/components/acr-form-dialog";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "superseded", label: "Superseded" },
  { value: "deprecated", label: "Deprecated" },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "structure", label: "Structure" },
  { value: "pattern", label: "Pattern" },
  { value: "dependency", label: "Dependency" },
  { value: "technology", label: "Technology" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Performance" },
  { value: "convention", label: "Convention" },
  { value: "other", label: "Other" },
];

const STATUS_VARIANT: Record<ACRStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  superseded: "secondary",
  deprecated: "outline",
};

const CATEGORY_COLORS: Record<ACRCategory, string> = {
  structure: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  pattern: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  dependency: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  technology: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  security: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  performance: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  convention: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function ACRListPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/artifacts/acrs",
  });
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // Fetch all ACRs (apply server-side status/category filters)
  const apiFilters: { status?: string; category?: string } = {};
  if (statusFilter !== "all") apiFilters.status = statusFilter;
  if (categoryFilter !== "all") apiFilters.category = categoryFilter;

  const { data: acrs, isLoading, isError, error } = useACRs(projectId, apiFilters);

  // We need violation counts — fetch all ACRs' violations via /acrs/context
  const filtered = useMemo(() => {
    if (!acrs) return [];
    if (!search.trim()) return acrs;
    const q = search.trim().toLowerCase();
    return acrs.filter(
      (a) =>
        a.slug.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.constraint.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [acrs, search]);

  return (
    <div className="relative flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ACRs</h1>
          <p className="text-sm text-muted-foreground">
            Architectural Constraint Records — governance rules for your codebase
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova ACR
        </Button>
      </div>

      {/* ACR Form Dialog */}
      <ACRFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        projectSlug={projectId}
      />

      {/* Search + Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search ACRs..."
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
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {CATEGORY_OPTIONS.map((o) => (
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
            <div
              key={i}
              className="h-12 animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load ACRs: {error.message}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && acrs && acrs.length === 0 && (
        <EmptyState
          icon={Shield}
          title="No ACRs found"
          description="Architectural Constraint Records define governance rules for your project."
          className="min-h-[50vh]"
        />
      )}

      {/* No results from search */}
      {!isLoading && !isError && acrs && acrs.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No ACRs match your search or filters.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Title
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Open Violations
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((acr) => (
                <ACRRow
                  key={acr.id}
                  acr={acr}
                  projectId={projectId}
                  onClick={() =>
                    navigate({
                      to: "/projects/$projectId/artifacts/acrs/$acrId",
                      params: { projectId, acrId: acr.id },
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

function ACRRow({
  acr,
  projectId,
  onClick,
}: {
  acr: ACR;
  projectId: string;
  onClick: () => void;
}) {
  // Fetch open violations count for this ACR
  const { data: violations } = useACRViolationsCount(projectId, acr.id);
  const openCount = violations ?? 0;

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b transition-colors hover:bg-muted/30 last:border-b-0"
    >
      <td className="px-4 py-3 font-mono text-xs font-semibold">
        {acr.slug}
      </td>
      <td className="px-4 py-3 font-medium">{acr.title}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            CATEGORY_COLORS[acr.category],
          )}
        >
          {acr.category}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[acr.status]}>{acr.status}</Badge>
      </td>
      <td className="px-4 py-3">
        {openCount > 0 ? (
          <Badge variant="destructive">{openCount} open</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {new Date(acr.updated_at).toLocaleDateString()}
      </td>
    </tr>
  );
}

function useACRViolationsCount(projectSlug: string, acrId: string): { data: number | undefined } {
  const query = useQuery({
    queryKey: [...acrKeys.violations(projectSlug, acrId), "open-count"],
    queryFn: async () => {
      const violations = await apiFetch<ACRViolation[]>(
        `/hub/projects/${projectSlug}/acrs/${acrId}/violations?resolution=open`,
      );
      return violations.length;
    },
  });
  return { data: query.data };
}
